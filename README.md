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

### ✅ Phase 1 — Foundation
- Campaign management: create, list, delete campaigns
- Character management: add/remove characters per campaign; hand size from character templates
- Scenario setup: pick adventure + scenario, auto-select locations by player count, location deck guides
- Session creation + persistence; resume across browser close
- Play board: location grid, blessing deck timer, character bar
- Turn management: end-turn advances player, decrements blessings, resets hand count
- Move action: reassign characters between locations

### ✅ Phase 2 — Game Data
- Full YAML game data for all 7 adventures (B + 1–6), 35 scenarios, 62 locations, 11 characters
- Location deck compositions from physical location cards: exact card-type counts
- Location rule text: `at_location`, `to_close`, `when_closed` effects loaded from data
- All 11 character starting decks from the rulebook (15 cards each, verified)
- Character selection guide with starting deck display in setup

### ✅ Phase 3 — Encounters, Dice & Narrative
- Encounter panel with card-name autocomplete search (searches all ~700 card entries)
- Card info display: type, subtype, traits, checks-to-defeat, powers text
- Villain and henchman banners with relevant reminders
- Dice roller: animated tumble, configurable dice pool (d4/d6/d8/d10/d12/d20), blessings
- Lore system: Adventure Journal narrative entries shown for cards that have them
- Contextual rules chips: surface relevant rules (barrier, henchman, villain, closing, etc.)
- Damage recorder: apply damage (discard cards) to any character, with low-hand warnings
- `at_location` passive effect banner in every encounter panel
- Post-scenario view: win/loss screen with campaign advancement

### ✅ Phase 4 — Hybrid Deck Mode & Win/Loss Logic
- **Hybrid mode toggle** in scenario setup footer
- **Virtual deck building**: villain placed randomly in one location; henchmen distributed
  across other locations; remaining slots typed placeholders (`{type: "monster", name: null}`)
- **Explore action** pops the top card from the virtual deck and returns it as `_revealed_card`;
  EncounterPanel auto-fills the card search for villain/henchman names
- **Villain escape fix**: escape targets determined by `is_open` flag — temp-closed locations
  correctly block the villain even though they aren't permanently closed
- **Temporary close**: "Temp Close" button lets a character close a location for the current turn only
- **Henchman close prompt**: defeating a henchman shows an inline "Close this location?" dialog
- **`has_villain` indicator**: `⚡` badge on location cards in hybrid mode when the villain is hiding
- **Win condition**: villain defeated with no open escape locations → session marked `won`

### ✅ Phase 5 — Character Progression, Deck Rebuilding & Deck Tracking
- Post-scenario feat recording: skill feat, card feat, power feat per character
- Role card selection prompt at Adventure 3+
- Draw-to-hand-size reminder in the character bar (pulsing hint before End Turn)
- Campaign `current_scenario` / `current_adventure` advancement after each scenario
- **Deck rebuild editor**: guided per-character deck editor after each victory — add/remove cards,
  with card search filtered to the feat type chosen; feat badge shows when the card feat requirement is met
- **Character deck depth tracker**: `🂠` count on each character chip; `−` button records permanent
  card removal (banish/bury); amber at ≤5 cards, pulsing red at ≤2

### ✅ Phase 5b — Complete Lore System
- `GET /api/lore` query endpoint with `trigger`, `scenario`, `adventure` filter params
- **`LoreBriefingModal`**: full-screen parchment-styled narrative overlay, multi-entry pagination
- **Campaign prologue**: `before_campaign` lore shown when creating a new campaign (once per campaign)
- **Adventure briefing**: `before_adventure` prologue shown at first scenario of each adventure
- **Scenario briefing**: `before_scenario` lore shown at session start (once per session)
- **`after_defeating` interstitial**: Adventure Journal entry surfaces after defeating any card
- **`after_acquiring` interstitial**: flavour text shown when a boon card is acquired
- **`when_appears` / `when triggered`**: pre-encounter interstitial shown when a matching card is
  selected — flavour text displayed with a "Begin Encounter" button before dice are rolled
- **`when permanently closed` / `after_closing`**: location lore shown via modal after a henchman
  defeats a location (e.g. Great Library of Tephu, Vault of Hidden Wisdom)
- **Epilogue lore**: shown automatically after winning the final scenario of each adventure
  (`*-5`); each adventure's epilogue fires once (tracked in localStorage)
- All lore filtered by current scenario so the right entries fire at the right time

### ✅ Phase 6 — Rules Reference, Guided Mode & Game Aids
- Searchable rules reference drawer (`?` button on play board)
- Context-sensitive rules chips in encounter panel
- Guided mode banner: step-by-step instructions derived from current game state
- "How to Play" game teacher walkthrough overlay
- **Scenario briefing modal** on session start: villain, henchmen, special rules, reward, tips
- **Villain-spotted broadcast**: full-screen alert when villain is encountered; lists every open
  location with its closing condition and characters present
- **Blessing urgency banner**: yellow at ≤10 blessings, pulsing red crisis banner at ≤5
- **Turn phase stepper**: `🎴 Explore → 🏁 End Turn` pill sequence in the character bar
- **"What now?" chip**: lightweight context prompt when guided mode is off
- **Skill check calculator**: resolves card check skill names to character bonuses, shows
  flat bonus, difficulty, and colour-coded roll-needed badge

### ✅ Content Ownership Settings
- ⚙ gear button on Campaign Home opens an ownership modal
- Products: Base Set (required), Class Decks, Character Add-On Deck, Adventure Decks 1–6
- Character picker filters to characters from owned products only
- Card search filters results to cards whose source codes match owned products
- Settings persisted in SQLite; loaded from server on app startup

### ✅ Setup Guidance Improvements
- **ScenarioSetupGuide**: numbered physical setup checklist (build decks → place villain →
  place henchmen → blessings deck → draw hands)
- Per-location deck breakdown with bane/boon chips and adventure deck badge
- **Boon/bane ratio hint**: orange ⚠ callout when a location deck is >55% banes
- **Scenario tips**: optional `tips` field in scenario YAML — shown in setup detail row
  and scenario briefing modal (Adventure B fully authored; framework in place for 1–6)
- Hybrid mode shows green "skip" callouts on villain/henchman placement steps
- Scenario detail (villain, henchmen, during rules, tips) shown inline after selection

### ✅ Phase 7 — Audio, Polish & PWA
- **PWA manifest** + Apple home screen meta tags (`manifest.json`, `icon.svg` ankh icon)
- **Session timer**: running clock (MM:SS / H:MM:SS) from `started_at` in top bar
- **Villain escape history**: `villain_last_seen` stores `{"location": "…", "turn": N}`;
  top bar shows `⚡ Tarworks (T4)` chip when villain has fled
- **Per-turn action log drawer**: 📋 button in top bar opens a slide-out panel grouped by
  turn, newest-first
- **Theme support**: Dark / Parchment / High Contrast via `data-theme` on `<body>`;
  CSS variable overrides; `ThemeToggle` button available on every screen
- **Ambient soundscape engine** (`audio.js`): all 35 scenarios mapped to 8 environment
  tags (tomb, desert, city, storm, fire, underground, temple, sky); fully synthesised via
  Web Audio API — no external files, works offline; crossfades between environments
- **AudioToggle** button available on every screen; shows 🔊/🔇; taps to mute/unmute
- **Audio settings**: enabled toggle + volume slider in ⚙ Settings modal; persisted in
  localStorage; volume changes take effect immediately
- **Reward explainer**: post-victory screen parses reward text (Traders / Loot / Feats /
  Role card / Random draw) into typed cards with step-by-step instructions
- **Scenario briefing modal** reward hint: contextual one-liner for each reward type

### ✅ Gameplay Guardrails
- **End Turn confirmation**: tapping End Turn before exploring shows an inline
  "Haven't explored yet — end turn?" prompt with Cancel / End anyway
- **Move timing note**: when the active player moved this turn but hasn't explored,
  a blue note "🚶 Moved this turn — you may still explore once" appears below the
  What Now chip (tracked via `moved_this_turn` column, cleared on End Turn)

---

## Architecture

```
mummys-mask/
  app.py              Flask app + all API routes
  config.py           Port, DB path, debug flag
  storage.py          SQLite schema, migrations, all game-action functions
  requirements.txt    Flask + PyYAML

  data/
    adventures/       B.yaml … 6.yaml  (7 adventure files, 35 scenarios; tips field on B)
    characters/       all_characters.yaml  (11 characters + starting decks)
    cards/
      locations.yaml  (62 locations, deck compositions, rule text)
      banes/          Monster + barrier cards
      boons/          Weapon, spell, armor, item, ally, blessing cards
      support/        Adventure-deck support cards
    lore/             entries.yaml  (208 Adventure Guide narrative entries)
    rules/            core.yaml  (rules reference topics)

  static/
    css/
      main.css        Variables, themes (dark/light/high-contrast), base styles
      components.css  All component-level styles
      layout.css      Grid layouts (play board, setup, campaign)
    js/
      vendor/         Preact + HTM + hooks (vendored, no build step)
      app.js          Entry point + client-side router
      api.js          fetch() wrappers for every API endpoint
      state.js        Global app state (Preact context); theme + audio settings
      audio.js        Web Audio API ambient engine (8 environments, AudioManager)
      components/
        campaign/     CampaignHome
        setup/        SetupView (scenario + location + character setup)
        play/         PlayBoard, LocationCard, BlessingDeck, CharacterBar,
                      PostScenarioView, DeckRebuildView, VillainBroadcast,
                      ScenarioBriefModal, TurnLogDrawer
        encounter/    EncounterPanel, DiceRoller
        character/    CharacterSheet
        common/       Modal, Toast, RulesPanel, RulesChip, GameTeacher,
                      GuidedBanner, NewGameGuide, LoreBriefingModal, SettingsModal,
                      ThemeToggle, AudioToggle

  templates/
    index.html        Single HTML shell (loads Preact app)
    manifest.json     PWA manifest

  Dockerfile
  docker-compose.yml
```

**Tech stack**: Python 3.13 + Flask · Preact + HTM (no build step) · SQLite · Vanilla CSS · Web Audio API

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
GET  /api/lore?trigger=&scenario=&adventure=   (flexible query)
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
POST /api/sessions/:id/actions/set-deck-count  { character_id, count }
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

### Character starting decks (`data/characters/all_characters.yaml`)
All 11 characters with verified 15-card starting decks from the rulebook. Each character has a
`source` field (`base` / `character_addon` / `class_deck`) used by the content ownership filter.

### Lore system (`data/lore/entries.yaml`)
208 narrative entries from the Adventure Guide, each tagged with:
- `trigger`: `before_campaign` · `before_adventure` · `before_scenario` · `after_defeating` ·
  `after_acquiring` · `when_encountering` · `when_appears` · `when triggered` ·
  `when permanently closed` · `after_closing`
- `scenario` and/or `adventure` scoping fields
- `card_name` for card-level entries (used by `GET /api/lore/:card_name`)

### Ambient audio (`static/js/audio.js`)
All 35 scenarios are mapped to one of 8 environment tags. Each environment is built from
layered noise buffers (brown/pink/white) and oscillators synthesised at runtime via Web Audio API —
no external audio files, works fully offline. The `AudioManager` singleton handles crossfades
(2.5 s linear ramp), master enable/disable, and volume control.

### Hybrid deck building
When a session is created with `hybrid: true`, each location deck is assembled as:
1. Typed placeholder cards (`{name: null, type: "monster"}`) per `deck_list` counts
2. Villain inserted at a random position in a randomly chosen location
3. Each henchman inserted at a random position in a different location (non-villain preferred)

This mirrors the physical setup rules while letting the app know where each special card hides.
