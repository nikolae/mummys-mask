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

### ✅ Phase 5 (core) — Character Progression & Lore System (complete)
- Post-scenario feat recording: skill feat, card feat, power feat per character
- Role card selection prompt at Adventure 3+
- Draw-to-hand-size reminder in the character bar (pulsing hint before End Turn)
- Campaign `current_scenario` / `current_adventure` advancement after each scenario

### ✅ Phase 5b — Complete Lore System (complete)
- `GET /api/lore` query endpoint with `trigger`, `scenario`, `adventure` filter params
- **`LoreBriefingModal`**: full-screen parchment-styled narrative overlay, supports multi-entry pagination
- **Campaign prologue**: `before_campaign` lore shown as cinematic moment when creating a new campaign (shown once, tracked per campaign in localStorage)
- **Adventure briefing**: `before_adventure` prologue shown at first scenario of each adventure
- **Scenario briefing**: `before_scenario` lore shown at session start (shown once per session, tracked in sessionStorage)
- **`after_defeating` interstitial**: Adventure Journal entry surfaces after defeating any non-henchman card
- **`after_acquiring` interstitial**: flavour text shown when a boon card is acquired; "Defeated" button relabelled "Acquired" for boon cards
- **Lore bug fix**: `when_encountering` lore no longer falls back to entries with wrong trigger types

### ✅ Phase 6 — Rules Reference, Guided Mode & Game Aids (complete)
- Searchable rules reference drawer (`?` button on play board)
- Context-sensitive rules chips in encounter panel (barrier, henchman, villain, closing, etc.)
- Guided mode banner: step-by-step instructions derived from current game state
- "How to Play" game teacher walkthrough overlay
- New game guide for character selection
- **Guided mode toggle** 🎓 button in play board top bar and setup screen — re-enable mid-scenario without leaving
- **Scenario briefing modal** on session start: villain, henchmen, special rules, reward (once per session)
- **Villain-spotted broadcast**: full-screen alert when villain is encountered (hybrid or physical);
  lists every open location with its closing condition and characters present; stays until dismissed
- **Blessing urgency banner**: persistent yellow banner at ≤10 blessings, pulsing red crisis banner at ≤5
- **`explored_this_turn` enforcement**: Explore button changes to "✓ Explored" after first explore; resets on End Turn
- **Low-hand token highlights**: character tokens on location cards turn red with ⚠ when ≤2 cards in hand

### ✅ Content Ownership Settings (complete)
- ⚙ gear button on Campaign Home opens an ownership modal
- Products: Base Set (always required), Class Decks, Character Add-On Deck, Adventure Decks 1–6
- Defaults: Base + Class Decks on; Character Add-On and Adventure Decks 1–6 off
- Character picker in setup filters to characters from owned products only
- Card search (`/api/cards/search`) accepts `sets` param and filters results to cards
  whose source codes (`MM-B`, `MM-C`, `MM-1`…`MM-6`) match owned products
- Settings persisted in SQLite; loaded from server on app startup
- Adventure deck tiles are tap-to-toggle buttons (no native checkboxes)

### ✅ Setup Guidance Improvements (complete)
- **ScenarioSetupGuide**: numbered physical setup checklist shown below location/character
  columns — build decks → place villain → place henchmen → blessings deck → draw hands
- Per-location deck breakdown with bane/boon chips and adventure deck badge
- Hybrid mode shows green "skip" callouts on villain/henchman placement steps
- Henchmen placement instruction adapts to available locations: "one remaining deck" /
  "distribute evenly" / "a different deck each" based on actual location count
- Scenario detail (villain name, henchmen tags, special during rules) shown inline after selection
- Hybrid explore reveals: named villain/henchman shows a red banner; typed placeholder
  (e.g. monster) pre-fills the card search with the card type

### 🔲 Upcoming
- Phase 5 remaining: deck rebuilding between scenarios, character deck depth warning
- Audio: ambient soundscapes per scenario, SFX, TTS narration of lore entries
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
                      GuidedBanner, NewGameGuide, LoreBriefingModal, SettingsModal

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
GET  /api/cards/search?q=&sets=   (sets: comma-separated product IDs, filters by MM source code)
GET  /api/cards/:name
GET  /api/lore/:card_name
GET  /api/lore?trigger=&scenario=&adventure=   (flexible query; trigger e.g. before_scenario)
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

### Settings
```
GET /api/settings
PUT /api/settings   { owned_products: ["base", "class_deck", "adv_1", ...] }
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
All 11 characters (Ahmotep, Alahazra, Channa Ti, Damiel, Drelm, Estra, Ezren, Mavaro, Simoun,
Yoon, Zadim) with verified 15-card starting decks from the rulebook. Each character has a
`source` field (`base` / `character_addon` / `class_deck`) used by the content ownership filter.

### Hybrid deck building
When a session is created with `hybrid: true`, each location deck is assembled as:
1. Typed placeholder cards (`{name: null, type: "monster"}`) per `deck_list` counts
2. Villain inserted at a random position in a randomly chosen location
3. Each henchman inserted at a random position in a different location (non-villain locations preferred)

This mirrors the physical setup rules while letting the app know where each special card hides.
