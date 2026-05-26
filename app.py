import glob
import json
import os

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
    data = {"adventures": [], "characters": [], "locations": [], "lore": []}

    for adv_file in sorted(glob.glob(os.path.join(config.DATA_DIR, "adventures", "*.yaml"))):
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

    return data


GAME_DATA = _load_game_data()

_location_map = {loc["name"]: loc for loc in GAME_DATA["locations"]}
_adventure_map = {adv["id"]: adv for adv in GAME_DATA["adventures"]}


def _location_card_count(location_name):
    loc = _location_map.get(location_name)
    if loc and loc.get("deck_list"):
        return sum(v for v in loc["deck_list"].values() if isinstance(v, int))
    return 9


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
            loc_details = []
            for loc_name in scenario.get("locations", []):
                loc = _location_map.get(loc_name, {})
                loc_details.append({
                    "name": loc_name,
                    "cards_remaining": _location_card_count(loc_name),
                    "deck_list": loc.get("deck_list", {}),
                    "when_closing": loc.get("when_closing", ""),
                    "at_location": loc.get("at_location", ""),
                })
            return jsonify({**scenario, "location_details": loc_details})
    return jsonify({"error": "not found"}), 404


@app.route("/api/characters")
def list_characters():
    return jsonify(GAME_DATA["characters"])


@app.route("/api/lore/<path:card_name>")
def get_lore(card_name):
    entries = [e for e in GAME_DATA["lore"] if e.get("card_name") == card_name]
    return jsonify(entries)


# ── Session API ────────────────────────────────────────────────────────────────

@app.route("/api/sessions", methods=["POST"])
def create_session():
    body = request.get_json(force=True)
    campaign_id = body.get("campaign_id")
    scenario_id = body.get("scenario_id")
    # Accept either "locations" (list of dicts) or "location_names" (list of strings)
    locations = body.get("locations") or body.get("location_names", [])
    character_locations = body.get("character_locations", {})

    if not campaign_id or not scenario_id:
        return jsonify({"error": "campaign_id and scenario_id required"}), 400

    location_configs = []
    for loc in locations:
        name = loc if isinstance(loc, str) else loc["name"]
        location_configs.append({
            "name": name,
            "cards_remaining": loc.get("cards_remaining", _location_card_count(name))
            if isinstance(loc, dict) else _location_card_count(name),
        })

    session = storage.create_session(
        campaign_id, scenario_id, location_configs, character_locations
    )
    return jsonify(session), 201


@app.route("/api/sessions/<session_id>")
def get_session(session_id):
    sess = storage.get_session(session_id)
    if not sess:
        return jsonify({"error": "not found"}), 404
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


if __name__ == "__main__":
    storage.init_db()
    app.run(host="0.0.0.0", port=config.PORT, debug=config.DEBUG)
