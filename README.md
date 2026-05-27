# Mummy's Mask PACG GM App

A browser-based Game Master companion for the **Pathfinder Adventure Card Game: Mummy's Mask**.
Runs on iPad Pro via Docker. Tracks sessions, location decks, encounters, blessings, character hands,
and surfaces narrative text at the right moments during play.

---

## Quick Start

```bash
docker-compose up --build
```

Open `http://<host>:5050` in a browser (Safari on iPad recommended).

**Environment variables** (all optional, defaults shown):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5050` | Port Flask listens on |
| `DB_PATH` | `/data/mummys_mask.db` | SQLite database path (inside the volume) |
| `FLASK_DEBUG` | `0` | Set to `1` for hot-reload during development |

Campaign data persists in a Docker volume (`mummys-mask-data`) across restarts.

---

## What It Does

The app serves as a digital overlay on top of a **physical card game**. Players still handle
real cards; the app tracks state the physical game can't: blessings remaining, character hands,
which characters are where, and when/how the villain escapes.

**Two modes:**

| Mode | Description |
|------|-------------|
| **Physical** | App is a counter/tracker. Players draw physical cards; they tap the card name into the app to record the encounter. |
| **Hybrid** | App shuffles a virtual deck for each location, places villain and henchmen randomly, and reveals each card digitally when a player explores. Physical cards still used for actual resolution. |

---

## Feature Status

### ✅ Phase 1 — Foundation (complete)
- Campaign management: create, list, delete campaigns
- Character management: add/remove characters per campaign; hand size from character templates
- Scenario setup: pick adventure + scenario, auto-select locations by player count, location deck guides
- Session creation + persistence; resume across browser close
- Play board: location grid, blessing deck timer, character bar
- Turn management: end-turn advances player, decrements blessings, resets hand count
- Move action: reassign characters between locations

### ✅ Phase 2 — Game Data (complete)
- Full YAML game data for all 7 adventures (B + 1–6), 35 scenarios, 62 locations, 11 characters
- Location deck compositions from physical location cards: exact card-type counts
- Location rule text: `at_location`, `to_close`, `when_closed` effects loaded from data
- All 11 character starting decks from the rulebook (15 cards each, verified)
- Character selection guide with starting deck display in setup

### ✅ Phase 3 — Encounters, Dice & Narrative (complete)
- Encounter panel with card-name autocomplete search (searches all ~700 card entries)
- Card info display: type, subtype, traits, checks-to-defeat, powers text
- Villain and henchman banners with relevant reminders
- Dice roller: animated tumble, configurable dice pool (d4/d6/d8/d10/d12/d20), blessings
- Lore system: Adventure Journal narrative entries shown for cards that have them
- Contextual rules chips: surface relevant rules (barrier, henchman, villain, closing, etc.)
- Damage recorder: apply damage (discard cards) to any character, with low-hand warnings
- `at_location` passive effect banner in every encounter panel
- Post-scenario view: win/loss screen with campaign advancement

### ✅ Phase 4 — Hybrid Deck Mode & Win/Loss Logic (complete)
- **Hybrid mode toggle** in scenario setup footer
- **Virtual deck building**: villain placed randomly in one location; henchmen distributed
  across other locations; remaining slots typed placeholders (`{type: "monster", name: null}`)
- **Explore action** pops the top card from the virtual deck and returns it as `_revealed_card`;
  EncounterPanel auto-fills the card search for villain/henchman names
- **Villain escape fix**: escape targets determined by `is_open` flag — temp-closed locations
  correctly block the villain even though they aren't permanently closed
- **Failed encounter**: card returns to the location deck (increments count, or pushes to bottom
  of virtual deck in hybrid mode)
- **Temporary close**: "Temp Close" button on location cards lets a character close a location
  for the current turn only, blocking villain escape. Locations re-open automatically at end of turn.
- **Henchman close prompt**: defeating a henchman now shows an inline "Close this location?"
  dialog with the closing condition and reward before dismissing the encounter panel
- **`has_villain` indicator**: `⚡` badge on location cards in hybrid mode when the villain is
  currently hiding in that deck (GM-visible only)
- **Win condition**: villain defeated with no open escape locations → session marked `won`
- **`action_encounter` double-decrement fix**: explore decrements on draw; encounter no longer
  also decrements on defeat/evade

### ✅ Phase 5 (partial) — Rules Reference & Guided Mode (complete)
- Searchable rules reference drawer (`?` button on play board)
- Context-sensitive rules chips in encounter panel (barrier, henchman, villain, closing, etc.)
- Guided mode banner: step-by-step instructions derived from current game state; appears on
  setup and play screens and updates as state progresses
- "How to Play" game teacher walkthrough overlay
- New game guide for character selection

### 🔲 Upcoming
- Character progression: post-scenario feat/card rewards, deck rebuilding, role card selection
- Audio: ambient soundscapes per scenario, SFX, TTS narration of lore entries
- Content ownership settings (base set vs. add-on vs. adventure decks)
- PWA manifest for iPad home screen install

---

## Architecture

```
mummys-mask/
  app.py              Flask app + all API routes
  config.py           Port, DB path, debug flag
  storage.py          SQLite schema, migrations, all game-action functions
  requirements.txt    Flask + PyYAML

  data/
    adventures/       B.yaml … 6.yaml  (7 adventure files, 35 scenarios)
    characters/       all_characters.yaml  (11 characters + starting decks)
    cards/
      locations.yaml  (62 locations, deck compositions, rule text)
      banes/          Monster + barrier cards
      boons/          Weapon, spell, armor, item, ally, blessing cards
      support/        Adventure-deck support cards
    lore/             entries.yaml  (Adventure Guide narrative triggers)
    rules/            core.yaml  (rules reference topics)

  static/
    css/
      main.css        Variables, themes, base styles
      components.css  All component-level styles
      layout.css      Grid layouts (play board, setup, campaign)
    js/
      vendor/         Preact + HTM + hooks (vendored, no build step)
      app.js          Entry point + client-side router
      api.js          fetch() wrappers for every API endpoint
      state.js        Global app state (Preact context)
      components/
        campaign/     CampaignHome
        setup/        SetupView (scenario + location + character setup)
        play/         PlayBoard, LocationCard, BlessingDeck, CharacterBar,
                      PostScenarioView
        encounter/    EncounterPanel, DiceRoller
        character/    CharacterSheet
        common/       Modal, Toast, RulesPanel, RulesChip, GameTeacher,
                      GuidedBanner, NewGameGuide

  templates/
    index.html        Single HTML shell (loads Preact app)

  Dockerfile
  docker-compose.yml
```

**Tech stack**: Python 3.13 + Flask · Preact + HTM (no build step) · SQLite · Vanilla CSS

---

## API Reference

### Campaigns
```
GET    /api/campaigns
POST   /api/campaigns                  { name }
GET    /api/campaigns/:id
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id
POST   /api/campaigns/:id/characters   { name, character_type, hand_size }
PUT    /api/campaigns/:id/characters/:cid
DELETE /api/campaigns/:id/characters/:cid
```

### Game Data
```
GET  /api/adventures
GET  /api/adventures/:adv_id
GET  /api/adventures/:adv_id/scenarios/:scenario_id
GET  /api/locations
GET  /api/locations/:name
GET  /api/characters
GET  /api/cards/search?q=
GET  /api/cards/:name
GET  /api/lore/:card_name
GET  /api/rules
GET  /api/rules/:topic_id
```

### Sessions
```
POST /api/sessions                    { campaign_id, scenario_id, location_names,
                                        character_locations, hybrid? }
GET  /api/sessions/:id
GET  /api/sessions/:id/log
```

### Session Actions
```
POST /api/sessions/:id/actions/explore         { location_id }
POST /api/sessions/:id/actions/move            { character_id, location_id }
POST /api/sessions/:id/actions/encounter       { location_id, card_name, result, dice_total? }
POST /api/sessions/:id/actions/close-location  { location_id }
POST /api/sessions/:id/actions/temp-close      { location_id }
POST /api/sessions/:id/actions/end-turn
POST /api/sessions/:id/actions/damage          { character_id, amount }
POST /api/sessions/:id/actions/set-hand        { character_id, count }
```

`result` for `/encounter` is one of: `defeated` | `evaded` | `failed`

---

## Data Notes

### Location deck compositions (`data/cards/locations.yaml`)
Each location entry includes:
- `deck_list`: exact card-type counts pulled from the physical location cards
- `at_location`: passive rule that applies during every encounter there
- `when_closing` (`to_close` in API): condition required to close the location
- `when_closed`: reward/effect that triggers when the location is permanently closed
- `flavor`: flavor text from the location card

### Character starting decks (`data/characters/all_characters.yaml`)
All 11 base-game characters (Ahmotep, Channa Ti, Drelm, Ezren, Harsk, Mavaro, Mummy's Mask
Seoni, Simoun, Tarlin, Yoon, Zadim) with verified 15-card starting decks from the rulebook.

### Hybrid deck building
When a session is created with `hybrid: true`, each location deck is assembled as:
1. Typed placeholder cards (`{name: null, type: "monster"}`) per `deck_list` counts
2. Villain inserted at a random position in a randomly chosen location
3. Each henchman inserted at a random position in a different location (non-villain locations preferred)

This mirrors the physical setup rules while letting the app know where each special card hides.
