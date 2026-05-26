#!/usr/bin/env python3
"""
Scrape PACG Fandom wiki for Mummy's Mask card data.

Fetches all card, scenario, location, and character pages via the MediaWiki API,
parses wikitext templates into structured data, and writes YAML files.

Usage:
    python tools/scrape_wiki.py [--output data/] [--delay 0.5]
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import yaml

BASE_URL = "https://pacg.fandom.com/api.php"
ADVENTURE_PAGES = [
    "Mummy's Mask",
    "The Half-Dead City",
    "Empty Graves",
    "Shifting Sands",
    "Secrets of the Sphinx",
    "The Slave Trenches of Hakotep",
    "Pyramid of the Sky Pharaoh",
    "Mummy's Mask Character Add-On Deck",
]

# Map adventure page names to adventure IDs
ADVENTURE_ID_MAP = {
    "Cross the Pharaoh's Land": "B",
    "The Half-Dead City": "1",
    "Empty Graves": "2",
    "Shifting Sands": "3",
    "Secrets of the Sphinx": "4",
    "The Slave Trenches of Hakotep": "5",
    "Pyramid of the Sky Pharaoh": "6",
}


def api_get(params):
    params["format"] = "json"
    query = "&".join(
        f"{k}={urllib.parse.quote(str(v), safe='')}" for k, v in params.items()
    )
    url = f"{BASE_URL}?{query}"
    import subprocess
    result = subprocess.run(
        ["curl", "-s", url],
        capture_output=True, text=True, timeout=30,
    )
    return json.loads(result.stdout)


def get_page_wikitext(title):
    data = api_get({"action": "parse", "page": title, "prop": "wikitext"})
    return data.get("parse", {}).get("wikitext", {}).get("*", "")


def get_page_links(title):
    data = api_get({"action": "parse", "page": title, "prop": "links"})
    links = data.get("parse", {}).get("links", [])
    return [
        link["*"]
        for link in links
        if link.get("ns", 0) == 0 and "exists" in link
    ]


def collect_all_page_names():
    all_pages = set()
    for page in ADVENTURE_PAGES:
        print(f"  Collecting links from {page}...")
        links = get_page_links(page)
        all_pages.update(links)
        time.sleep(0.3)
    return sorted(all_pages)


def parse_template_params(text, template_name=None):
    """Parse a wikitext template into key-value pairs.

    Handles nested templates by tracking brace depth.
    """
    params = {}
    if not text:
        return params

    if template_name:
        pattern = r'\{\{' + re.escape(template_name) + r'\s*\|'
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            pattern = r'\{\{[Tt]emplate:' + re.escape(template_name) + r'\s*\|'
            match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            return params
        start = match.end()
    else:
        match = re.search(r'\{\{[^|]+\|', text)
        if not match:
            return params
        start = match.end()

    depth = 1
    current = ""
    i = start
    segments = []

    while i < len(text) and depth > 0:
        if text[i:i+2] == "{{":
            depth += 1
            current += "{{"
            i += 2
        elif text[i:i+2] == "}}":
            depth -= 1
            if depth == 0:
                segments.append(current)
                break
            current += "}}"
            i += 2
        elif text[i] == "|" and depth == 1:
            segments.append(current)
            current = ""
            i += 1
        else:
            current += text[i]
            i += 1

    for seg in segments:
        seg = seg.strip()
        if "=" in seg:
            key, _, val = seg.partition("=")
            params[key.strip().lower()] = val.strip()

    return params


def parse_traits(traits_text):
    """Extract trait names from {{Traits|...}} template."""
    match = re.search(r'\{\{Traits\|(.+?)\}\}', traits_text, re.IGNORECASE)
    if match:
        return [t.strip() for t in match.group(1).split("|") if t.strip()]
    return []


def parse_check(check_text):
    """Extract check info from {{Check|skill|subskill|difficulty=N}}."""
    match = re.search(r'\{\{Check\|(.+?)\}\}', check_text, re.IGNORECASE)
    if match:
        parts = match.group(1).split("|")
        result = {}
        skills = []
        for part in parts:
            part = part.strip()
            if "=" in part:
                k, v = part.split("=", 1)
                result[k.strip()] = v.strip()
            else:
                skills.append(part)
        if skills:
            result["skills"] = skills
        return result
    return {}


def parse_deck_list(text):
    """Extract deck composition from {{Deck List|monster=2|...}}."""
    match = re.search(r'\{\{Deck List[\s|](.+?)\}\}', text, re.IGNORECASE | re.DOTALL)
    if match:
        deck = {}
        for pair in re.split(r'[|\n]', match.group(1)):
            pair = pair.strip()
            if "=" in pair:
                k, v = pair.split("=", 1)
                k, v = k.strip(), v.strip()
                try:
                    deck[k] = int(v)
                except ValueError:
                    deck[k] = v
        return deck
    return {}


def parse_henchmen(text):
    """Extract henchman names from {{Henchmen|...}} template."""
    match = re.search(r'\{\{Henchmen\|(.+?)\}\}', text, re.IGNORECASE)
    if match:
        return [h.strip() for h in match.group(1).split("|") if h.strip()]
    return []


def parse_locations_template(text):
    """Extract location names from {{Locations|...}} template."""
    match = re.search(r'\{\{Locations\|(.+?)\}\}', text, re.IGNORECASE)
    if match:
        return [loc.strip() for loc in match.group(1).split("|") if loc.strip()]
    return []


def strip_wiki_markup(text):
    """Remove common wikitext formatting."""
    text = re.sub(r"'''(.+?)'''", r"\1", text)
    text = re.sub(r"''(.+?)''", r"\1", text)
    text = re.sub(r'\[\[([^|\]]+)\|([^\]]+)\]\]', r'\2', text)
    text = re.sub(r'\[\[([^\]]+)\]\]', r'\1', text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


def classify_page(wikitext):
    """Determine what type of page this is based on its templates."""
    wt_lower = wikitext.lower()
    if "{{boon" in wt_lower or "{{template:boon" in wt_lower:
        return "boon"
    if "{{bane" in wt_lower or "{{template:bane" in wt_lower:
        return "bane"
    if "{{template:location" in wt_lower or "{{location" in wt_lower:
        if "decklist" in wt_lower or "whenclosing" in wt_lower:
            return "location"
    if "{{template:scenario" in wt_lower or "{{scenario" in wt_lower:
        return "scenario"
    if "{{infobox_adventure" in wt_lower:
        return "adventure"
    if "{{support" in wt_lower or "{{template:support" in wt_lower:
        return "support"
    if "=== skills ===" in wt_lower and ("hand size" in wt_lower or "proficient" in wt_lower):
        return "character"
    return "unknown"


def parse_boon(wikitext, name):
    params = parse_template_params(wikitext, "Boon")
    if not params:
        params = parse_template_params(wikitext, "Template:Boon")
    if not params:
        return None

    card = {
        "name": params.get("name", name),
        "category": "boon",
        "type": params.get("type", "unknown"),
        "source": strip_wiki_markup(params.get("source", "")),
    }

    if "traits" in params:
        card["traits"] = parse_traits(params["traits"])

    checks = []
    for i in range(1, 4):
        key = f"check{i}"
        if key in params:
            check = parse_check(params[key])
            if check:
                checks.append(check)
    if checks:
        card["checks"] = checks

    if "powers" in params:
        card["powers"] = strip_wiki_markup(params["powers"])

    return card


def parse_bane(wikitext, name):
    params = parse_template_params(wikitext, "Bane")
    if not params:
        params = parse_template_params(wikitext, "Template:Bane")
    if not params:
        return None

    card = {
        "name": params.get("name", name),
        "category": "bane",
        "type": params.get("type", "unknown"),
        "source": strip_wiki_markup(params.get("source", "")),
    }

    if "subtype" in params:
        card["subtype"] = params["subtype"]

    if "traits" in params:
        card["traits"] = parse_traits(params["traits"])

    checks = []
    for i in range(1, 4):
        key = f"check{i}"
        if key in params:
            check = parse_check(params[key])
            if check:
                checks.append(check)
    if checks:
        card["checks"] = checks

    if "powers" in params:
        card["powers"] = strip_wiki_markup(params["powers"])

    return card


def parse_location(wikitext, name):
    params = parse_template_params(wikitext, "Location")
    if not params:
        params = parse_template_params(wikitext, "Template:Location")
    if not params:
        return None

    loc = {
        "name": params.get("name", name),
        "category": "location",
        "source": strip_wiki_markup(params.get("source", "")),
    }

    if "fluff" in params:
        loc["flavor"] = strip_wiki_markup(params["fluff"])

    if "decklist" in params:
        loc["deck_list"] = parse_deck_list(params["decklist"])

    if "atlocation" in params:
        loc["at_location"] = strip_wiki_markup(params["atlocation"])

    if "whenclosing" in params:
        loc["when_closing"] = strip_wiki_markup(params["whenclosing"])

    if "whenclosed" in params:
        loc["when_closed"] = strip_wiki_markup(params["whenclosed"])

    return loc


def parse_scenario(wikitext, name):
    params = parse_template_params(wikitext, "Scenario")
    if not params:
        params = parse_template_params(wikitext, "Template:Scenario")
    if not params:
        return None

    scenario = {
        "name": params.get("name", name),
    }

    if "fluff" in params:
        scenario["flavor"] = strip_wiki_markup(params["fluff"])

    if "villain" in params:
        villain_text = params["villain"]
        villain_text = re.sub(r'\[\[([^\]|]+)\]\]', r'\1', villain_text)
        villain_text = re.sub(r'\[\[([^|]+)\|([^\]]+)\]\]', r'\2', villain_text)
        scenario["villain"] = villain_text.strip()

    if "henchmen" in params:
        scenario["henchmen"] = parse_henchmen(params["henchmen"])

    if "locations" in params:
        scenario["locations"] = parse_locations_template(params["locations"])

    if "during" in params:
        scenario["during"] = strip_wiki_markup(params["during"])

    if "reward" in params:
        scenario["reward"] = strip_wiki_markup(params["reward"])

    if "previous" in params:
        scenario["previous"] = strip_wiki_markup(params["previous"])

    if "next" in params:
        scenario["next"] = strip_wiki_markup(params["next"])

    return scenario


def parse_adventure(wikitext, name):
    params = parse_template_params(wikitext, "Infobox_adventure")
    if not params:
        return None

    adventure = {
        "name": name,
    }

    if "deck" in params:
        adventure["deck"] = strip_wiki_markup(params["deck"])

    if "reward" in params:
        adventure["reward"] = strip_wiki_markup(params["reward"])

    if "next" in params:
        adventure["next"] = strip_wiki_markup(params["next"])

    scenarios_section = re.search(
        r'==\s*Scenarios\s*==(.+?)(?:\n==\s*[^=]|\Z)', wikitext, re.DOTALL
    )
    if scenarios_section:
        table_match = re.search(
            r'\{\|(.+?)\|\}', scenarios_section.group(1), re.DOTALL
        )
        if table_match:
            rows = table_match.group(1).split("|-")
            scenario_names = []
            for row in rows:
                row = row.strip()
                if not row or row.startswith("!"):
                    continue
                first_link = re.search(r'\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]', row)
                if first_link:
                    scenario_names.append(first_link.group(1))
            if scenario_names:
                adventure["scenario_names"] = scenario_names

    during_match = re.search(
        r"'''During this adventure:?'''(.+?)(?:\n\n|\[\[Category)", wikitext, re.DOTALL
    )
    if not during_match:
        during_match = re.search(
            r"During this adventure:?\s*(.+?)(?:\n\n|\[\[Category)", wikitext, re.DOTALL
        )
    if during_match:
        adventure["during"] = strip_wiki_markup(during_match.group(1).strip())

    return adventure


def parse_character(wikitext, name):
    """Parse character data from wiki page."""
    char = {
        "name": name,
        "category": "character",
    }

    skills_section = re.search(
        r'===?\s*Skills\s*===?(.+?)(?:===?\s*[^=]|\Z)', wikitext, re.DOTALL
    )
    if skills_section:
        skills = {}
        rows = re.findall(
            r'\|-\s*\n\|(.+?)(?=\n\|-|\n\|\})', skills_section.group(1), re.DOTALL
        )
        for row in rows:
            cells = re.split(r'\n\|', row)
            cells = [c.strip().strip('!').strip() for c in cells]
            if len(cells) >= 2:
                skill_name = strip_wiki_markup(cells[0])
                die = strip_wiki_markup(cells[1]) if len(cells) > 1 else ""
                if re.match(r'd\d+', die):
                    skills[skill_name] = {"die": die}
                    if len(cells) > 2:
                        feats = cells[2].count("☐")
                        if feats:
                            skills[skill_name]["feat_slots"] = feats
                elif "+" in die:
                    derived = re.sub(r'colspan="?\d+"?\s*\|?\s*', '', die).strip()
                    skills[skill_name] = {"derived_from": derived}
        if skills:
            char["skills"] = skills

    hand_match = re.search(r'Hand Size\s*\n?\|?\s*(\d+)', wikitext)
    if hand_match:
        char["hand_size"] = int(hand_match.group(1))

    proficient_match = re.search(
        r'Proficient with\s*\n?\|?\s*(?:colspan="2"\s*\|)?\s*(.+?)(?:\n\|-|\n\|\})',
        wikitext,
    )
    if proficient_match:
        profs = strip_wiki_markup(proficient_match.group(1))
        char["proficiencies"] = [p.strip() for p in re.split(r'\s{2,}', profs) if p.strip()]

    class_match = re.search(r'\|([A-Za-z]+)\s*\n\|Base Set', wikitext)
    if not class_match:
        class_match = re.search(r'\|([A-Za-z]+)\s*\n\|Character Add-on', wikitext)
    if class_match:
        char["class"] = class_match.group(1)

    roles = re.findall(r'====\s*(.+?)\s*====', wikitext)
    if roles:
        char["roles"] = [strip_wiki_markup(r) for r in roles]

    return char


def parse_support(wikitext, name):
    params = parse_template_params(wikitext, "Support")
    if not params:
        params = parse_template_params(wikitext, "Template:Support")
    if not params:
        params = parse_template_params(wikitext, "support")
    if not params:
        return None

    card = {
        "name": params.get("name", name),
        "category": "support",
        "type": params.get("type", "unknown"),
        "source": strip_wiki_markup(params.get("source", "")),
    }

    if "traits" in params:
        card["traits"] = parse_traits(params["traits"])

    if "powers" in params:
        card["powers"] = strip_wiki_markup(params["powers"])

    return card


def parse_page(name, wikitext):
    page_type = classify_page(wikitext)

    if page_type == "boon":
        return "boon", parse_boon(wikitext, name)
    elif page_type == "bane":
        return "bane", parse_bane(wikitext, name)
    elif page_type == "location":
        return "location", parse_location(wikitext, name)
    elif page_type == "scenario":
        return "scenario", parse_scenario(wikitext, name)
    elif page_type == "adventure":
        return "adventure", parse_adventure(wikitext, name)
    elif page_type == "support":
        return "support", parse_support(wikitext, name)
    elif page_type == "character":
        return "character", parse_character(wikitext, name)
    else:
        return "unknown", {"name": name, "raw_type": "unparsed"}


def write_yaml(data, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    class YamlDumper(yaml.SafeDumper):
        pass

    def str_representer(dumper, data):
        if "\n" in data:
            return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
        return dumper.represent_scalar("tag:yaml.org,2002:str", data)

    YamlDumper.add_representer(str, str_representer)

    with open(filepath, "w") as f:
        yaml.dump(data, f, Dumper=YamlDumper, default_flow_style=False, allow_unicode=True, sort_keys=False)


def build_adventure_files(adventures, scenarios, output_dir):
    """Combine adventure and scenario data into per-adventure YAML files."""
    scenario_by_name = {s["name"]: s for s in scenarios}

    for adv_name, adv_data in adventures.items():
        adv_id = ADVENTURE_ID_MAP.get(adv_name)
        if not adv_id:
            continue

        adventure = {
            "id": adv_id,
            "name": adv_name,
        }

        if "reward" in adv_data:
            adventure["reward"] = adv_data["reward"]
        if "during" in adv_data:
            adventure["during"] = adv_data["during"]

        scenario_names = adv_data.get("scenario_names", [])
        adventure_scenarios = []
        for idx, sname in enumerate(scenario_names, 1):
            sid = f"{adv_id}-{idx}"
            sdata = scenario_by_name.get(sname, {})
            scenario_entry = {"id": sid, "name": sname}
            for key in ["flavor", "villain", "henchmen", "locations", "during", "reward"]:
                if key in sdata:
                    scenario_entry[key] = sdata[key]
            adventure_scenarios.append(scenario_entry)

        adventure["scenarios"] = adventure_scenarios
        write_yaml(adventure, os.path.join(output_dir, "adventures", f"{adv_id}.yaml"))
        print(f"  Wrote adventure {adv_id}: {adv_name} ({len(adventure_scenarios)} scenarios)")


def main():
    parser = argparse.ArgumentParser(description="Scrape PACG wiki for Mummy's Mask data")
    parser.add_argument("--output", default="data", help="Output directory")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between API requests")
    parser.add_argument("--skip-fetch", action="store_true", help="Skip fetching, use cached data")
    parser.add_argument("--cache-dir", default=".wiki_cache", help="Cache directory for raw wikitext")
    args = parser.parse_args()

    os.makedirs(args.cache_dir, exist_ok=True)
    os.makedirs(args.output, exist_ok=True)

    print("Phase 1: Collecting page names...")
    pages = collect_all_page_names()
    print(f"  Found {len(pages)} unique pages")

    print(f"\nPhase 2: Fetching wikitext for {len(pages)} pages...")
    raw_pages = {}
    for i, page_name in enumerate(pages):
        cache_file = os.path.join(args.cache_dir, urllib.parse.quote(page_name, safe="") + ".txt")

        if args.skip_fetch and os.path.exists(cache_file):
            with open(cache_file, "r") as f:
                wikitext = f.read()
        else:
            try:
                wikitext = get_page_wikitext(page_name)
                with open(cache_file, "w") as f:
                    f.write(wikitext)
                time.sleep(args.delay)
            except Exception as e:
                print(f"  ERROR fetching {page_name}: {e}")
                continue

        raw_pages[page_name] = wikitext

        if (i + 1) % 50 == 0:
            print(f"  Fetched {i + 1}/{len(pages)}...")

    print(f"  Fetched {len(raw_pages)} pages total")

    print("\nPhase 3: Parsing pages...")
    boons = []
    banes = []
    locations = []
    scenarios = []
    adventures = {}
    characters = []
    supports = []
    unknown = []

    for name, wikitext in raw_pages.items():
        ptype, data = parse_page(name, wikitext)
        if data is None:
            unknown.append({"name": name, "detected_type": ptype, "error": "parse_failed"})
            continue

        if ptype == "boon":
            boons.append(data)
        elif ptype == "bane":
            banes.append(data)
        elif ptype == "location":
            locations.append(data)
        elif ptype == "scenario":
            scenarios.append(data)
        elif ptype == "adventure":
            adventures[name] = data
        elif ptype == "support":
            supports.append(data)
        elif ptype == "character":
            characters.append(data)
        else:
            unknown.append(data)

    print(f"  Boons: {len(boons)}")
    print(f"  Banes: {len(banes)}")
    print(f"  Locations: {len(locations)}")
    print(f"  Scenarios: {len(scenarios)}")
    print(f"  Adventures: {len(adventures)}")
    print(f"  Support: {len(supports)}")
    print(f"  Characters: {len(characters)}")
    print(f"  Unknown/unparsed: {len(unknown)}")

    print("\nPhase 4: Writing YAML files...")

    boon_types = {}
    for boon in sorted(boons, key=lambda b: b["name"]):
        btype = boon.get("type", "unknown").lower()
        boon["type"] = btype
        boon_types.setdefault(btype, []).append(boon)

    for btype, cards in boon_types.items():
        write_yaml(
            {"type": btype, "cards": cards},
            os.path.join(args.output, "cards", "boons", f"{btype}s.yaml"),
        )
        print(f"  Wrote {len(cards)} {btype} boons")

    bane_types = {}
    for bane in sorted(banes, key=lambda b: b["name"]):
        btype = bane.get("type", "unknown").lower()
        bane["type"] = btype
        bane_types.setdefault(btype, []).append(bane)

    for btype, cards in bane_types.items():
        write_yaml(
            {"type": btype, "cards": cards},
            os.path.join(args.output, "cards", "banes", f"{btype}s.yaml"),
        )
        print(f"  Wrote {len(cards)} {btype} banes")

    write_yaml(
        {"locations": sorted(locations, key=lambda l: l["name"])},
        os.path.join(args.output, "cards", "locations.yaml"),
    )
    print(f"  Wrote {len(locations)} locations")

    write_yaml(
        {"characters": sorted(characters, key=lambda c: c["name"])},
        os.path.join(args.output, "characters", "all_characters.yaml"),
    )
    print(f"  Wrote {len(characters)} characters")

    support_types = {}
    for card in sorted(supports, key=lambda s: s["name"]):
        stype = card.get("type", "unknown")
        support_types.setdefault(stype, []).append(card)

    for stype, cards in support_types.items():
        write_yaml(
            {"type": stype, "cards": cards},
            os.path.join(args.output, "cards", "support", f"{stype}s.yaml"),
        )
        print(f"  Wrote {len(cards)} {stype} support cards")

    build_adventure_files(adventures, scenarios, args.output)

    if unknown:
        write_yaml(
            {"unparsed": unknown},
            os.path.join(args.output, "_unparsed.yaml"),
        )
        print(f"  Wrote {len(unknown)} unparsed entries to _unparsed.yaml")

    print("\nDone!")


if __name__ == "__main__":
    main()
