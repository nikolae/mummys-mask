import glob
import json
import os
import random

import yaml
from flask import Flask, jsonify, render_template, request

import config
import storage

app = Flask(__name__)


# ── Game Data (loaded from YAML once at startup) ───────────────────────────────

def _load_yaml(path):
    with open(path) as f:
        return yaml.safe_load(f)


def _load_game_data():
    data = {"adventures": [], "characters": [], "locations": [], "lore": [], "cards": [], "rules": []}

    def _adv_sort_key(p):
        stem = os.path.splitext(os.path.basename(p))[0]
        return (0, 0) if stem == "B" else (1, int(stem))

    for adv_file in sorted(glob.glob(os.path.join(config.DATA_DIR, "adventures", "*.yaml")), key=_adv_sort_key):
        adv = _load_yaml(adv_file)
        data["adventures"].append(adv)

    chars_file = os.path.join(config.DATA_DIR, "characters", "all_characters.yaml")
    if os.path.exists(chars_file):
        data["characters"] = _load_yaml(chars_file).get("characters", [])

    locs_file = os.path.join(config.DATA_DIR, "cards", "locations.yaml")
    if os.path.exists(locs_file):
        data["locations"] = _load_yaml(locs_file).get("locations", [])

    lore_file = os.path.join(config.DATA_DIR, "lore", "entries.yaml")
    if os.path.exists(lore_file):
        data["lore"] = _load_yaml(lore_file).get("entries", [])

    rules_file = os.path.join(config.DATA_DIR, "rules", "core.yaml")
    if os.path.exists(rules_file):
        data["rules"] = _load_yaml(rules_file).get("topics", [])

    # Load all card types (banes + boons + support, skip locations)
    for card_file in glob.glob(os.path.join(config.DATA_DIR, "cards", "**", "*.yaml")):
        if "locations" in os.path.basename(card_file):
            continue
        file_data = _load_yaml(card_file)
        if isinstance(file_data, dict) and "cards" in file_data:
            data["cards"].extend(file_data["cards"])

    return data


GAME_DATA = _load_game_data()

_location_map = {loc["name"]: loc for loc in GAME_DATA["locations"]}
_adventure_map = {adv["id"]: adv for adv in GAME_DATA["adventures"]}
_card_map = {c["name"].lower(): c for c in GAME_DATA["cards"]}
_rules_map = {r["id"]: r for r in GAME_DATA["rules"]}
_lore_map = {}
for entry in GAME_DATA["lore"]:
    key = (entry.get("card_name") or "").lower()
    _lore_map.setdefault(key, []).append(entry)


def _get_scenario_villain(scenario_id):
    """Return the villain card name for a scenario id like '1-1', or None."""
    if not scenario_id:
        return None
    adv_id, *_ = str(scenario_id).split("-")
    adv = _adventure_map.get(adv_id)
    if not adv:
        return None
    for scenario in adv.get("scenarios", []):
        if str(scenario.get("id")) == str(scenario_id):
            return scenario.get("villain")
    return None


# Ordered list of all scenario IDs across all adventures: B-1, B-2, ..., 1-1, 1-2, ...
_ALL_SCENARIO_IDS = [
    str(s["id"])
    for adv in sorted(GAME_DATA["adventures"], key=lambda a: (0 if str(a["id"]) == "B" else int(str(a["id"]))))
    for s in adv.get("scenarios", [])
]


def _next_scenario_id(current_scenario_id):
    """Return the scenario ID that follows current_scenario_id, or None if it's the last."""
    try:
        idx = _ALL_SCENARIO_IDS.index(str(current_scenario_id))
        return _ALL_SCENARIO_IDS[idx + 1] if idx + 1 < len(_ALL_SCENARIO_IDS) else None
    except ValueError:
        return None


def _scenario_adventure_id(scenario_id):
    """Return the adventure ID for a given scenario ID."""
    if not scenario_id:
        return None
    return str(scenario_id).split("-")[0]


def _location_card_count(location_name):
    loc = _location_map.get(location_name)
    if loc and loc.get("deck_list"):
        return sum(v for v in loc["deck_list"].values() if isinstance(v, int))
    return 9


def _location_detail(loc_name):
    """Return full location detail dict for API responses."""
    loc = _location_map.get(loc_name, {})
    deck_list = loc.get("deck_list") or {}
    return {
        "name":          loc_name,
        "flavor":        loc.get("flavor", ""),
        "at_location":   loc.get("at_location", ""),
        "to_close":      loc.get("when_closing", ""),
        "when_closed":   loc.get("when_closed", ""),
        "deck_list":     deck_list,
        "cards_remaining": sum(v for v in deck_list.values() if isinstance(v, int)) or 9,
    }


def _build_virtual_decks(scenario, selected_location_names):
    """Build shuffled virtual decks for hybrid mode.

    Each deck is a list of card-entry dicts:
      {"name": "Sand Thief",   "type": "villain"}   ← actual villain
      {"name": "Warrior Dolls","type": "henchman"}  ← actual henchman
      {"name": None,           "type": "monster"}   ← physical card drawn by player

    Placement rules (mirrors physical setup):
      - Villain: placed in exactly one randomly chosen location.
      - Henchmen: each henchman placed in a different location (round-robin across
        locations that don't already have the villain, cycling if more henchmen
        than locations).
      - Remaining slots: typed placeholders in deck_list proportions.

    Returns dict: {location_name: [card_entry, ...]}
    """
    villain_name = scenario.get("villain")
    henchmen = scenario.get("henchmen") or []

    # Build typed placeholder decks from each location's deck_list
    decks = {}
    for loc_name in selected_location_names:
        loc_data = _location_map.get(loc_name, {})
        deck_list = loc_data.get("deck_list") or {}
        entries = []
        for card_type, count in deck_list.items():
            if isinstance(count, int):
                for _ in range(count):
                    entries.append({"name": None, "type": card_type})
        random.shuffle(entries)
        decks[loc_name] = entries

    if not selected_location_names:
        return decks

    # Place villain in one randomly chosen location
    villain_loc = None
    if villain_name:
        villain_loc = random.choice(selected_location_names)
        deck = decks[villain_loc]
        insert_pos = random.randint(0, len(deck))
        deck.insert(insert_pos, {"name": villain_name, "type": "villain"})

    # Distribute henchmen: prefer locations without the villain first
    non_villain_locs = [l for l in selected_location_names if l != villain_loc]
    if not non_villain_locs:
        non_villain_locs = list(selected_location_names)
    random.shuffle(non_villain_locs)

    for i, henchman in enumerate(henchmen):
        target = non_villain_locs[i % len(non_villain_locs)]
        deck = decks[target]
        insert_pos = random.randint(0, len(deck))
        deck.insert(insert_pos, {"name": henchman, "type": "henchman"})

    return decks


# ── Frontend ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── Campaign API ───────────────────────────────────────────────────────────────

@app.route("/api/campaigns", methods=["GET"])
def list_campaigns():
    return jsonify(storage.get_campaigns())


@app.route("/api/campaigns", methods=["POST"])
def create_campaign():
    body = request.get_json(force=True)
    name = body.get("name", "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    return jsonify(storage.create_campaign(name)), 201


@app.route("/api/campaigns/<campaign_id>", methods=["GET"])
def get_campaign(campaign_id):
    c = storage.get_campaign(campaign_id)
    if not c:
        return jsonify({"error": "not found"}), 404
    c["sessions"] = storage.get_sessions_for_campaign(campaign_id)
    return jsonify(c)


@app.route("/api/campaigns/<campaign_id>", methods=["PUT"])
def update_campaign(campaign_id):
    body = request.get_json(force=True)
    return jsonify(storage.update_campaign(campaign_id, **body))


@app.route("/api/campaigns/<campaign_id>", methods=["DELETE"])
def delete_campaign(campaign_id):
    storage.delete_campaign(campaign_id)
    return "", 204


@app.route("/api/campaigns/<campaign_id>/characters", methods=["GET"])
def list_characters_for_campaign(campaign_id):
    campaign = storage.get_campaign(campaign_id)
    if not campaign:
        return jsonify({"error": "not found"}), 404
    return jsonify(campaign.get("characters", []))


@app.route("/api/campaigns/<campaign_id>/characters", methods=["POST"])
def add_character(campaign_id):
    body = request.get_json(force=True)
    name = body.get("name", "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    char_type = body.get("character_type", name)

    char_data = next(
        (c for c in GAME_DATA["characters"] if c["name"] == char_type), {}
    )
    hand_size = char_data.get("hand_size", 5)

    char = storage.add_character(campaign_id, name, char_type, hand_size)
    return jsonify(char), 201


@app.route("/api/campaigns/<campaign_id>/characters/<char_id>", methods=["PUT"])
def update_character(campaign_id, char_id):
    body = request.get_json(force=True)
    return jsonify(storage.update_character(char_id, **body))


@app.route("/api/campaigns/<campaign_id>/characters/<char_id>", methods=["DELETE"])
def delete_character(campaign_id, char_id):
    storage.delete_character(char_id)
    return "", 204


# ── Rules API ─────────────────────────────────────────────────────────────────

@app.route("/api/rules")
def list_rules():
    tag = request.args.get("tag")
    topics = GAME_DATA["rules"]
    if tag:
        topics = [t for t in topics if tag in t.get("tags", [])]
    # Return lightweight summaries for the list view
    return jsonify([
        {"id": t["id"], "title": t["title"], "icon": t.get("icon", "📖"),
         "short": t.get("short", ""), "tags": t.get("tags", [])}
        for t in topics
    ])


@app.route("/api/rules/<topic_id>")
def get_rule(topic_id):
    topic = _rules_map.get(topic_id)
    if not topic:
        return jsonify({"error": "not found"}), 404
    return jsonify(topic)


# ── Game Data API ──────────────────────────────────────────────────────────────

@app.route("/api/adventures")
def list_adventures():
    result = []
    for a in GAME_DATA["adventures"]:
        scenarios = [
            {"id": s["id"], "name": s["name"], "villain": s.get("villain", "")}
            for s in a.get("scenarios", [])
        ]
        result.append({
            "id": a["id"],
            "name": a["name"],
            "scenario_count": len(scenarios),
            "scenarios": scenarios,
        })
    return jsonify(result)


@app.route("/api/adventures/<adv_id>")
def get_adventure(adv_id):
    adv = _adventure_map.get(adv_id)
    if not adv:
        return jsonify({"error": "not found"}), 404
    return jsonify(adv)


@app.route("/api/adventures/<adv_id>/scenarios/<scenario_id>")
def get_scenario(adv_id, scenario_id):
    adv = _adventure_map.get(adv_id)
    if not adv:
        return jsonify({"error": "not found"}), 404
    for scenario in adv.get("scenarios", []):
        if scenario["id"] == scenario_id:
            loc_details = [_location_detail(n) for n in scenario.get("locations", [])]
            return jsonify({**scenario, "location_details": loc_details})
    return jsonify({"error": "not found"}), 404


@app.route("/api/locations")
def list_locations():
    return jsonify([_location_detail(loc["name"]) for loc in GAME_DATA["locations"]])


@app.route("/api/locations/<path:loc_name>")
def get_location(loc_name):
    if loc_name not in _location_map:
        return jsonify({"error": "not found"}), 404
    return jsonify(_location_detail(loc_name))


@app.route("/api/characters")
def list_characters():
    return jsonify(GAME_DATA["characters"])


@app.route("/api/lore")
def query_lore():
    """Flexible lore query by trigger, scenario, or adventure.
    e.g. /api/lore?trigger=before_scenario&scenario=B-1
         /api/lore?trigger=before_adventure&adventure=B
         /api/lore?trigger=before_campaign
    """
    trigger   = request.args.get("trigger",   "").strip()
    scenario  = request.args.get("scenario",  "").strip()
    adventure = request.args.get("adventure", "").strip()
    entries = GAME_DATA["lore"]
    if trigger:
        entries = [e for e in entries if e.get("trigger") == trigger]
    if scenario:
        entries = [e for e in entries if e.get("scenario") == scenario]
    elif adventure:
        entries = [e for e in entries if e.get("adventure") == adventure]
    return jsonify(entries)


@app.route("/api/lore/<path:card_name>")
def get_lore(card_name):
    entries = [e for e in GAME_DATA["lore"] if e.get("card_name") == card_name]
    return jsonify(entries)


# Maps owned_product IDs → MM source-code prefixes
_PRODUCT_SOURCE_MAP = {
    "base":            "MM-B",
    "character_addon": "MM-C",
    "adv_1":           "MM-1",
    "adv_2":           "MM-2",
    "adv_3":           "MM-3",
    "adv_4":           "MM-4",
    "adv_5":           "MM-5",
    "adv_6":           "MM-6",
}


def _card_is_owned(card, owned_mm_codes):
    """Return True if ANY of the card's source tokens are in owned_mm_codes."""
    if not owned_mm_codes:
        return True  # no filter applied
    raw = card.get("source", "")
    if not raw:
        return True  # no source tag → always include
    tokens = {t.strip() for t in str(raw).split(",")}
    return bool(tokens & owned_mm_codes)


@app.route("/api/cards/search")
def search_cards():
    q = request.args.get("q", "").strip().lower()
    if not q:
        return jsonify([])

    # Optional ownership filter: comma-separated product IDs, e.g. "base,class_deck,adv_1"
    sets_param = request.args.get("sets", "").strip()
    if sets_param:
        owned_products = {p.strip() for p in sets_param.split(",") if p.strip()}
        owned_mm_codes = {_PRODUCT_SOURCE_MAP[p] for p in owned_products if p in _PRODUCT_SOURCE_MAP}
    else:
        owned_mm_codes = set()  # empty = no filter

    results = [
        c for c in GAME_DATA["cards"]
        if q in c["name"].lower() and _card_is_owned(c, owned_mm_codes)
    ]
    # Exact match first, then alphabetical
    results.sort(key=lambda c: (0 if c["name"].lower().startswith(q) else 1, c["name"]))
    return jsonify(results[:20])


@app.route("/api/cards/<path:card_name>")
def get_card(card_name):
    card = _card_map.get(card_name.lower())
    if not card:
        return jsonify({"error": "not found"}), 404
    lore = _lore_map.get(card_name.lower(), [])
    return jsonify({**card, "lore": lore})


# ── Session API ────────────────────────────────────────────────────────────────

@app.route("/api/sessions", methods=["POST"])
def create_session():
    body = request.get_json(force=True)
    campaign_id = body.get("campaign_id")
    scenario_id = body.get("scenario_id")
    # Accept either "locations" (list of dicts) or "location_names" (list of strings)
    locations = body.get("locations") or body.get("location_names", [])
    character_locations = body.get("character_locations", {})
    is_hybrid = bool(body.get("hybrid", False) or body.get("is_hybrid", False))

    if not campaign_id or not scenario_id:
        return jsonify({"error": "campaign_id and scenario_id required"}), 400

    # Normalize location names list (used for deck building)
    selected_names = [loc if isinstance(loc, str) else loc["name"] for loc in locations]

    # In hybrid mode, build virtual decks (villain + henchmen placed randomly)
    virtual_decks = {}
    if is_hybrid:
        adv_id = _scenario_adventure_id(scenario_id)
        adv = _adventure_map.get(adv_id)
        scenario_data = None
        if adv:
            for s in adv.get("scenarios", []):
                if str(s.get("id")) == str(scenario_id):
                    scenario_data = s
                    break
        if scenario_data:
            virtual_decks = _build_virtual_decks(scenario_data, selected_names)

    location_configs = []
    for loc in locations:
        name = loc if isinstance(loc, str) else loc["name"]
        deck = virtual_decks.get(name, [])
        if deck:
            cards_remaining = len(deck)
        else:
            fallback = _location_card_count(name)
            cards_remaining = loc.get("cards_remaining", fallback) if isinstance(loc, dict) else fallback
        location_configs.append({
            "name": name,
            "cards_remaining": cards_remaining,
            "deck": deck,
        })

    session = storage.create_session(
        campaign_id, scenario_id, location_configs, character_locations,
        is_hybrid=is_hybrid,
    )
    # Record the campaign's current scenario if it isn't set yet
    campaign = storage.get_campaign(campaign_id)
    if campaign and not campaign.get("current_scenario"):
        storage.update_campaign(
            campaign_id,
            current_scenario=scenario_id,
            current_adventure=_scenario_adventure_id(scenario_id),
        )
    return jsonify(session), 201


@app.route("/api/sessions/<session_id>")
def get_session(session_id):
    sess = storage.get_session(session_id)
    if not sess:
        return jsonify({"error": "not found"}), 404
    # Enrich each location with rules text and deck data
    for loc in sess.get("locations", []):
        detail = _location_detail(loc["name"])
        loc.setdefault("at_location", detail["at_location"])
        loc.setdefault("to_close",    detail["to_close"])
        loc.setdefault("when_closed", detail["when_closed"])
    return jsonify(sess)


@app.route("/api/sessions/<session_id>/log")
def get_session_log(session_id):
    return jsonify(storage.get_turn_log(session_id))


# ── Game Actions ───────────────────────────────────────────────────────────────

def _action(session_id, fn, *args, **kwargs):
    sess = storage.get_session(session_id)
    if not sess:
        return jsonify({"error": "session not found"}), 404
    if sess["status"] not in ("playing",):
        return jsonify({"error": f"session is {sess['status']}"}), 400
    result, error = fn(session_id, *args, **kwargs)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(result)


@app.route("/api/sessions/<session_id>/actions/explore", methods=["POST"])
def action_explore(session_id):
    body = request.get_json(force=True)
    return _action(session_id, storage.action_explore, body["location_id"])


@app.route("/api/sessions/<session_id>/actions/move", methods=["POST"])
def action_move(session_id):
    body = request.get_json(force=True)
    return _action(session_id, storage.action_move,
                   body["character_id"], body["location_id"])


@app.route("/api/sessions/<session_id>/actions/end-turn", methods=["POST"])
def action_end_turn(session_id):
    return _action(session_id, storage.action_end_turn)


@app.route("/api/sessions/<session_id>/actions/close-location", methods=["POST"])
def action_close_location(session_id):
    body = request.get_json(force=True)
    return _action(session_id, storage.action_close_location, body["location_id"])


@app.route("/api/sessions/<session_id>/actions/damage", methods=["POST"])
def action_damage(session_id):
    body = request.get_json(force=True)
    return _action(session_id, storage.action_damage,
                   body["character_id"], int(body.get("amount", 1)))


@app.route("/api/sessions/<session_id>/actions/set-hand", methods=["POST"])
def action_set_hand(session_id):
    body = request.get_json(force=True)
    return _action(session_id, storage.action_set_hand,
                   body["character_id"], int(body.get("count", 0)))


@app.route("/api/sessions/<session_id>/actions/encounter", methods=["POST"])
def action_encounter(session_id):
    body = request.get_json(force=True)
    # Determine whether the card being resolved is the scenario villain
    sess = storage.get_session(session_id)
    if not sess:
        return jsonify({"error": "session not found"}), 404
    if sess["status"] not in ("playing",):
        return jsonify({"error": f"session is {sess['status']}"}), 400
    villain = _get_scenario_villain(sess.get("scenario_id"))
    card_name = body.get("card_name", "").strip()
    is_villain = bool(villain and card_name.lower() == villain.lower())
    result, error = storage.action_encounter(
        session_id,
        body.get("location_id"),
        card_name,
        body.get("result"),
        body.get("dice_total"),
        is_villain,
    )
    if error:
        return jsonify({"error": error}), 400

    # If the session just transitioned to 'won', advance the campaign's tracked scenario
    updated_sess = storage.get_session(session_id)
    if updated_sess and updated_sess.get("status") == "won":
        scenario_id = updated_sess.get("scenario_id")
        next_id = _next_scenario_id(scenario_id)
        storage.update_campaign(
            updated_sess["campaign_id"],
            current_scenario=next_id or scenario_id,  # stay on last if campaign complete
            current_adventure=_scenario_adventure_id(next_id or scenario_id),
        )

    return jsonify(result)


@app.route("/api/sessions/<session_id>/actions/temp-close", methods=["POST"])
def action_temp_close(session_id):
    body = request.get_json(force=True)
    return _action(session_id, storage.action_temp_close_location, body["location_id"])


# ── Settings API ───────────────────────────────────────────────────────────────

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(storage.get_settings())


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    body = request.get_json(force=True)
    return jsonify(storage.update_settings(body))


if __name__ == "__main__":
    storage.init_db()
    app.run(host="0.0.0.0", port=config.PORT, debug=config.DEBUG)
