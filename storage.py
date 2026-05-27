import json
import os
import random
import sqlite3
import uuid
from datetime import datetime, timezone

import config


def _now():
    return datetime.now(timezone.utc).isoformat()


_JSON_CHAR_FIELDS = ("deck_list", "deck_contents", "feats", "skills", "powers")
_JSON_CHAR_DEFAULTS = {"deck_list": {}, "feats": {}, "skills": {}, "deck_contents": [], "powers": []}


def _parse_char(c):
    """Parse JSON text fields on a character dict so the frontend receives objects."""
    c = dict(c) if not isinstance(c, dict) else dict(c)
    for k in _JSON_CHAR_FIELDS:
        if isinstance(c.get(k), str):
            try:
                c[k] = json.loads(c[k])
            except (json.JSONDecodeError, TypeError):
                c[k] = _JSON_CHAR_DEFAULTS.get(k, {})
    return c


def _connect():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                current_adventure TEXT,
                current_scenario  TEXT
            );

            CREATE TABLE IF NOT EXISTS campaign_characters (
                id              TEXT PRIMARY KEY,
                campaign_id     TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                name            TEXT NOT NULL,
                character_type  TEXT NOT NULL DEFAULT '',
                role            TEXT,
                hand_size       INTEGER NOT NULL DEFAULT 5,
                deck_list       TEXT NOT NULL DEFAULT '{}',
                deck_contents   TEXT NOT NULL DEFAULT '[]',
                feats           TEXT NOT NULL DEFAULT '{}',
                skills          TEXT NOT NULL DEFAULT '{}',
                powers          TEXT NOT NULL DEFAULT '[]',
                is_dead         INTEGER NOT NULL DEFAULT 0,
                sort_order      INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS game_sessions (
                id                  TEXT PRIMARY KEY,
                campaign_id         TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                scenario_id         TEXT NOT NULL,
                status              TEXT NOT NULL DEFAULT 'setup',
                started_at          TEXT NOT NULL,
                finished_at         TEXT,
                blessings_remaining INTEGER NOT NULL DEFAULT 30,
                blessings_total     INTEGER NOT NULL DEFAULT 30,
                current_turn        INTEGER NOT NULL DEFAULT 1,
                current_player_id   TEXT,
                current_phase       TEXT NOT NULL DEFAULT 'explore',
                turn_order          TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS session_locations (
                id                    TEXT PRIMARY KEY,
                session_id            TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
                location_name         TEXT NOT NULL,
                is_open               INTEGER NOT NULL DEFAULT 1,
                is_permanently_closed INTEGER NOT NULL DEFAULT 0,
                deck                  TEXT NOT NULL DEFAULT '[]',
                characters_here       TEXT NOT NULL DEFAULT '[]',
                cards_remaining       INTEGER NOT NULL DEFAULT 0,
                sort_order            INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS turn_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id   TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
                turn_number  INTEGER NOT NULL,
                character_id TEXT,
                action_type  TEXT NOT NULL,
                details      TEXT NOT NULL DEFAULT '{}',
                created_at   TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_characters_campaign ON campaign_characters(campaign_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_campaign ON game_sessions(campaign_id);
            CREATE INDEX IF NOT EXISTS idx_locations_session ON session_locations(session_id);
            CREATE INDEX IF NOT EXISTS idx_log_session ON turn_log(session_id);
        """)
        # Schema migrations — safe to run on every startup
        for migration in [
            "ALTER TABLE game_sessions ADD COLUMN char_hand_counts TEXT NOT NULL DEFAULT '{}'",
            "ALTER TABLE game_sessions ADD COLUMN is_hybrid INTEGER NOT NULL DEFAULT 0",
        ]:
            try:
                conn.execute(migration)
            except Exception:
                pass


# ── Campaigns ──────────────────────────────────────────────────────────────────

def get_campaigns():
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM campaigns ORDER BY created_at DESC"
        ).fetchall()
        return [_campaign_with_chars(conn, dict(r)) for r in rows]


def get_campaign(campaign_id):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM campaigns WHERE id = ?", (campaign_id,)
        ).fetchone()
        if not row:
            return None
        return _campaign_with_chars(conn, dict(row))


def _campaign_with_chars(conn, campaign):
    chars = conn.execute(
        "SELECT * FROM campaign_characters WHERE campaign_id = ? ORDER BY sort_order",
        (campaign["id"],),
    ).fetchall()
    campaign["characters"] = [_parse_char(c) for c in chars]
    campaign["character_count"] = len(campaign["characters"])
    return campaign


def create_campaign(name):
    campaign_id = str(uuid.uuid4())
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO campaigns (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (campaign_id, name, now, now),
        )
    return get_campaign(campaign_id)


def update_campaign(campaign_id, **kwargs):
    allowed = {"name", "current_adventure", "current_scenario"}
    fields = {k: v for k, v in kwargs.items() if k in allowed}
    if not fields:
        return get_campaign(campaign_id)
    fields["updated_at"] = _now()
    sql = "UPDATE campaigns SET " + ", ".join(f"{k}=?" for k in fields) + " WHERE id=?"
    with _connect() as conn:
        conn.execute(sql, list(fields.values()) + [campaign_id])
    return get_campaign(campaign_id)


def delete_campaign(campaign_id):
    with _connect() as conn:
        conn.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))


# ── Characters ─────────────────────────────────────────────────────────────────

def add_character(campaign_id, name, character_type="", hand_size=5):
    char_id = str(uuid.uuid4())
    with _connect() as conn:
        max_order = conn.execute(
            "SELECT MAX(sort_order) FROM campaign_characters WHERE campaign_id = ?",
            (campaign_id,),
        ).fetchone()[0] or 0
        conn.execute(
            """INSERT INTO campaign_characters
               (id, campaign_id, name, character_type, hand_size, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (char_id, campaign_id, name, character_type, hand_size, max_order + 1),
        )
        update_campaign(campaign_id)
    return dict(conn.execute(
        "SELECT * FROM campaign_characters WHERE id = ?", (char_id,)
    ).fetchone()) if False else _get_character(char_id)


def _get_character(char_id):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM campaign_characters WHERE id = ?", (char_id,)
        ).fetchone()
        return dict(row) if row else None


def update_character(char_id, **kwargs):
    allowed = {"name", "character_type", "role", "hand_size", "is_dead",
               "deck_list", "deck_contents", "feats", "skills", "powers"}
    fields = {k: v for k, v in kwargs.items() if k in allowed}
    for k in ("deck_list", "deck_contents", "feats", "skills", "powers"):
        if k in fields and not isinstance(fields[k], str):
            fields[k] = json.dumps(fields[k])
    if not fields:
        return _get_character(char_id)
    sql = "UPDATE campaign_characters SET " + ", ".join(f"{k}=?" for k in fields) + " WHERE id=?"
    with _connect() as conn:
        conn.execute(sql, list(fields.values()) + [char_id])
    return _get_character(char_id)


def delete_character(char_id):
    with _connect() as conn:
        conn.execute("DELETE FROM campaign_characters WHERE id = ?", (char_id,))


# ── Sessions ───────────────────────────────────────────────────────────────────

def create_session(campaign_id, scenario_id, location_configs, character_locations,
                   is_hybrid=False):
    """
    location_configs: [{"name": "Catacombs", "cards_remaining": 9, "deck": [...]}, ...]
    character_locations: {"char_id": "Catacombs", ...}
    is_hybrid: if True, virtual decks are stored and explore pops from them
    """
    session_id = str(uuid.uuid4())
    now = _now()

    chars = get_campaign(campaign_id)["characters"]
    turn_order = [c["id"] for c in chars if not c["is_dead"]]
    first_player = turn_order[0] if turn_order else None
    initial_hand_counts = json.dumps({c["id"]: c["hand_size"] for c in chars})

    with _connect() as conn:
        conn.execute(
            """INSERT INTO game_sessions
               (id, campaign_id, scenario_id, status, started_at,
                blessings_remaining, blessings_total, current_turn,
                current_player_id, current_phase, turn_order, char_hand_counts, is_hybrid)
               VALUES (?, ?, ?, 'playing', ?, 30, 30, 1, ?, 'explore', ?, ?, ?)""",
            (session_id, campaign_id, scenario_id, now, first_player,
             json.dumps(turn_order), initial_hand_counts, 1 if is_hybrid else 0),
        )

        for idx, loc_cfg in enumerate(location_configs):
            loc_id = str(uuid.uuid4())
            chars_here = [
                cid for cid, loc_name in character_locations.items()
                if loc_name == loc_cfg["name"]
            ]
            deck = loc_cfg.get("deck", [])
            conn.execute(
                """INSERT INTO session_locations
                   (id, session_id, location_name, cards_remaining, deck,
                    characters_here, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (loc_id, session_id, loc_cfg["name"],
                 loc_cfg["cards_remaining"], json.dumps(deck),
                 json.dumps(chars_here), idx),
            )

        _log_action(conn, session_id, 0, None, "session_created",
                    {"scenario_id": scenario_id, "is_hybrid": is_hybrid})

    return get_session(session_id)


def get_session(session_id):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM game_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not row:
            return None
        session = dict(row)
        session["turn_order"] = json.loads(session["turn_order"])

        locs = conn.execute(
            "SELECT * FROM session_locations WHERE session_id = ? ORDER BY sort_order",
            (session_id,),
        ).fetchall()
        session["locations"] = []
        for loc in locs:
            l = dict(loc)
            l["characters_here"] = json.loads(l["characters_here"])
            l["deck"] = json.loads(l["deck"])
            l["name"] = l["location_name"]  # alias for frontend
            # Flag whether the villain card is currently hiding in this location's deck
            l["has_villain"] = any(
                isinstance(card, dict) and card.get("type") == "villain"
                for card in l["deck"]
            )
            session["locations"].append(l)

        chars = conn.execute(
            """SELECT cc.* FROM campaign_characters cc
               JOIN game_sessions gs ON gs.campaign_id = cc.campaign_id
               WHERE gs.id = ? ORDER BY cc.sort_order""",
            (session_id,),
        ).fetchall()
        hand_counts = json.loads(session.get("char_hand_counts") or "{}")
        session["characters"] = []
        for c in chars:
            char = _parse_char(c)
            char["cards_in_hand"] = hand_counts.get(char["id"], char["hand_size"])
            session["characters"].append(char)

        # Normalize field names for the frontend
        session["current_player"] = session.get("current_player_id")
        session["turn_number"] = session.get("current_turn", 1)

        return session


def get_sessions_for_campaign(campaign_id):
    with _connect() as conn:
        rows = conn.execute(
            """SELECT id, scenario_id, status, started_at, finished_at,
                      blessings_remaining, current_turn
               FROM game_sessions WHERE campaign_id = ? ORDER BY started_at DESC""",
            (campaign_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def _log_action(conn, session_id, turn_number, character_id, action_type, details):
    conn.execute(
        """INSERT INTO turn_log (session_id, turn_number, character_id,
           action_type, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, turn_number, character_id,
         action_type, json.dumps(details), _now()),
    )


# ── Game Actions ───────────────────────────────────────────────────────────────

def action_explore(session_id, location_id):
    with _connect() as conn:
        sess = conn.execute(
            "SELECT current_turn, current_player_id FROM game_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        loc = conn.execute(
            "SELECT cards_remaining, deck FROM session_locations WHERE id = ? AND session_id = ?",
            (location_id, session_id),
        ).fetchone()
        if not loc or loc["cards_remaining"] <= 0:
            return None, "Location has no cards remaining"

        deck = json.loads(loc["deck"] or "[]")
        revealed_card = None

        if deck:  # Hybrid mode — pop top card from virtual deck
            revealed_card = deck.pop(0)
            new_count = len(deck)
            conn.execute(
                "UPDATE session_locations SET deck = ?, cards_remaining = ? WHERE id = ?",
                (json.dumps(deck), new_count, location_id),
            )
        else:  # Physical mode — decrement counter
            new_count = loc["cards_remaining"] - 1
            conn.execute(
                "UPDATE session_locations SET cards_remaining = ? WHERE id = ?",
                (new_count, location_id),
            )

        _log_action(conn, session_id, sess["current_turn"],
                    sess["current_player_id"], "explore",
                    {"location_id": location_id, "cards_remaining": new_count,
                     "revealed_card": revealed_card})

    session = get_session(session_id)
    if revealed_card:
        session["_revealed_card"] = revealed_card
    return session, None


def action_move(session_id, character_id, to_location_id):
    with _connect() as conn:
        sess = conn.execute(
            "SELECT current_turn, current_player_id FROM game_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()

        locs = conn.execute(
            "SELECT id, characters_here FROM session_locations WHERE session_id = ?",
            (session_id,),
        ).fetchall()

        for loc in locs:
            chars = json.loads(loc["characters_here"])
            if character_id in chars:
                chars.remove(character_id)
                conn.execute(
                    "UPDATE session_locations SET characters_here = ? WHERE id = ?",
                    (json.dumps(chars), loc["id"]),
                )
                break

        dest = conn.execute(
            "SELECT characters_here FROM session_locations WHERE id = ? AND session_id = ?",
            (to_location_id, session_id),
        ).fetchone()
        if not dest:
            return None, "Location not found"

        dest_chars = json.loads(dest["characters_here"])
        if character_id not in dest_chars:
            dest_chars.append(character_id)
        conn.execute(
            "UPDATE session_locations SET characters_here = ? WHERE id = ?",
            (json.dumps(dest_chars), to_location_id),
        )

        _log_action(conn, session_id, sess["current_turn"],
                    character_id, "move",
                    {"to_location_id": to_location_id})

    return get_session(session_id), None


def action_end_turn(session_id):
    with _connect() as conn:
        sess = conn.execute(
            "SELECT * FROM game_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        sess = dict(sess)
        turn_order = json.loads(sess["turn_order"])

        if not turn_order:
            return get_session(session_id), None

        new_blessings = sess["blessings_remaining"] - 1
        status = "lost" if new_blessings <= 0 else sess["status"]
        finished_at = _now() if status == "lost" else sess["finished_at"]

        current_idx = turn_order.index(sess["current_player_id"]) if sess["current_player_id"] in turn_order else -1
        next_idx = (current_idx + 1) % len(turn_order)
        next_player = turn_order[next_idx]
        new_turn = sess["current_turn"] + (1 if next_idx == 0 else 0)

        # Reset the ending player's hand count to their hand_size (they draw back up)
        hand_counts = json.loads(sess.get("char_hand_counts") or "{}")
        if sess["current_player_id"]:
            curr_char = conn.execute(
                "SELECT hand_size FROM campaign_characters WHERE id = ?",
                (sess["current_player_id"],),
            ).fetchone()
            if curr_char:
                hand_counts[sess["current_player_id"]] = curr_char["hand_size"]

        conn.execute(
            """UPDATE game_sessions SET
               blessings_remaining = ?, current_player_id = ?,
               current_turn = ?, status = ?, finished_at = ?,
               char_hand_counts = ?
               WHERE id = ?""",
            (new_blessings, next_player, new_turn, status, finished_at,
             json.dumps(hand_counts), session_id),
        )

        # Re-open any temporarily closed locations (is_open=0 but not permanently closed)
        conn.execute(
            """UPDATE session_locations SET is_open = 1
               WHERE session_id = ? AND is_open = 0 AND is_permanently_closed = 0""",
            (session_id,),
        )

        _log_action(conn, session_id, sess["current_turn"],
                    sess["current_player_id"], "end_turn",
                    {"blessings_remaining": new_blessings, "next_player": next_player})

    return get_session(session_id), None


def action_close_location(session_id, location_id):
    with _connect() as conn:
        sess = conn.execute(
            "SELECT current_turn, current_player_id FROM game_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        conn.execute(
            """UPDATE session_locations
               SET is_permanently_closed = 1, is_open = 0
               WHERE id = ? AND session_id = ?""",
            (location_id, session_id),
        )
        _log_action(conn, session_id, sess["current_turn"],
                    sess["current_player_id"], "close_location",
                    {"location_id": location_id})

    return get_session(session_id), None


def action_temp_close_location(session_id, location_id):
    """Temporarily close a location to block villain escape.

    Sets is_open=0 without touching is_permanently_closed.
    action_end_turn() will re-open these at the end of the current player's turn.
    """
    with _connect() as conn:
        sess = conn.execute(
            "SELECT current_turn, current_player_id FROM game_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        conn.execute(
            """UPDATE session_locations SET is_open = 0
               WHERE id = ? AND session_id = ? AND is_permanently_closed = 0""",
            (location_id, session_id),
        )
        _log_action(conn, session_id, sess["current_turn"],
                    sess["current_player_id"], "temp_close_location",
                    {"location_id": location_id})
    return get_session(session_id), None


def action_encounter(session_id, location_id, card_name, result, dice_total=None,
                     is_villain=False):
    """Record encounter result. result: 'defeated' | 'evaded' | 'failed'

    Card count bookkeeping:
      action_explore() already decremented the count when the card was drawn.
      - defeated / evaded: card is gone for good — no additional change needed.
      - failed: card returns to the location deck — increment count by 1 (and in
        hybrid mode push the card back to the bottom of the virtual deck).

    When is_villain=True and result='defeated':
      - Only open locations can receive the villain (temp-closed blocks escape).
      - No open locations OTHER than the current one → session wins.
      - Open locations remain → villain shuffles into a random open one.
    """
    escaped_to = None

    with _connect() as conn:
        sess = conn.execute(
            "SELECT current_turn, current_player_id, is_hybrid FROM game_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        is_hybrid = bool(sess["is_hybrid"])

        # Failed: card goes back into the location deck
        if result == "failed" and location_id:
            if is_hybrid and card_name:
                # Push the card to the bottom of the virtual deck
                loc = conn.execute(
                    "SELECT cards_remaining, deck FROM session_locations"
                    " WHERE id = ? AND session_id = ?",
                    (location_id, session_id),
                ).fetchone()
                if loc:
                    deck = json.loads(loc["deck"] or "[]")
                    deck.append({"name": card_name, "type": "unknown"})
                    conn.execute(
                        "UPDATE session_locations SET deck = ?, cards_remaining = ?"
                        " WHERE id = ?",
                        (json.dumps(deck), len(deck), location_id),
                    )
            else:
                conn.execute(
                    "UPDATE session_locations"
                    " SET cards_remaining = cards_remaining + 1"
                    " WHERE id = ? AND session_id = ?",
                    (location_id, session_id),
                )

        # Villain-defeat logic
        if result == "defeated" and is_villain:
            all_locs = conn.execute(
                "SELECT id, location_name, is_open, deck, cards_remaining"
                " FROM session_locations WHERE session_id = ?",
                (session_id,),
            ).fetchall()

            # Only truly-open locations (not temp-closed) can receive the villain
            escape_targets = [
                l for l in all_locs
                if l["is_open"] and l["id"] != location_id
            ]

            if not escape_targets:
                # Victory — villain cornered with no escape route
                conn.execute(
                    "UPDATE game_sessions SET status = 'won', finished_at = ? WHERE id = ?",
                    (_now(), session_id),
                )
            else:
                # Villain escapes into a random open location
                target = random.choice(escape_targets)
                if is_hybrid:
                    # Shuffle the villain card back into the target deck
                    deck = json.loads(target["deck"] or "[]")
                    villain_entry = {"name": card_name, "type": "villain"}
                    insert_pos = random.randint(0, len(deck))
                    deck.insert(insert_pos, villain_entry)
                    conn.execute(
                        "UPDATE session_locations SET deck = ?, cards_remaining = ?"
                        " WHERE id = ?",
                        (json.dumps(deck), len(deck), target["id"]),
                    )
                else:
                    conn.execute(
                        "UPDATE session_locations"
                        " SET cards_remaining = cards_remaining + 1 WHERE id = ?",
                        (target["id"],),
                    )
                escaped_to = target["location_name"]

        _log_action(conn, session_id, sess["current_turn"],
                    sess["current_player_id"], f"encounter_{result}",
                    {"card_name": card_name, "location_id": location_id,
                     "dice_total": dice_total, "is_villain": is_villain,
                     "escaped_to": escaped_to})

    session = get_session(session_id)
    if escaped_to:
        session["_escaped_to"] = escaped_to
    return session, None


def action_damage(session_id, char_id, amount):
    """Reduce a character's hand by `amount` cards (minimum 0)."""
    with _connect() as conn:
        sess = conn.execute(
            "SELECT current_turn, current_player_id, char_hand_counts FROM game_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        if not sess:
            return None, "Session not found"
        counts = json.loads(sess["char_hand_counts"] or "{}")
        char = conn.execute(
            "SELECT hand_size FROM campaign_characters WHERE id = ?", (char_id,)
        ).fetchone()
        current = counts.get(char_id, char["hand_size"] if char else 5)
        new_count = max(0, current - amount)
        counts[char_id] = new_count
        conn.execute(
            "UPDATE game_sessions SET char_hand_counts = ? WHERE id = ?",
            (json.dumps(counts), session_id),
        )
        _log_action(conn, session_id, sess["current_turn"],
                    char_id, "damage",
                    {"amount": amount, "cards_in_hand": new_count})
    return get_session(session_id), None


def action_set_hand(session_id, char_id, count):
    """Manually set a character's hand count (used for +/− adjustments in the UI)."""
    with _connect() as conn:
        sess = conn.execute(
            "SELECT current_turn, current_player_id, char_hand_counts FROM game_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        if not sess:
            return None, "Session not found"
        counts = json.loads(sess["char_hand_counts"] or "{}")
        new_count = max(0, int(count))
        counts[char_id] = new_count
        conn.execute(
            "UPDATE game_sessions SET char_hand_counts = ? WHERE id = ?",
            (json.dumps(counts), session_id),
        )
        _log_action(conn, session_id, sess["current_turn"],
                    char_id, "set_hand", {"cards_in_hand": new_count})
    return get_session(session_id), None


def get_turn_log(session_id, limit=50):
    with _connect() as conn:
        rows = conn.execute(
            """SELECT * FROM turn_log WHERE session_id = ?
               ORDER BY id DESC LIMIT ?""",
            (session_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]
