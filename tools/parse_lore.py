#!/usr/bin/env python3
"""
Parse Adventure Guide PDFs into structured lore entry YAML.

Extracts narrative entries with their trigger conditions (read when encountering,
read after defeating, etc.) keyed by card name and scenario.

Usage:
    python tools/parse_lore.py [--input assets/PACG_Mummy_Text_v101.pdf] [--output data/lore/entries.yaml]
"""

import argparse
import os
import re
import subprocess
import yaml


def extract_pdf_text(pdf_path):
    result = subprocess.run(
        ["pdftotext", pdf_path, "-"],
        capture_output=True, text=True,
    )
    return result.stdout


def parse_trigger(trigger_text):
    """Normalize trigger text into a standard trigger type."""
    trigger_text = trigger_text.lower().strip()
    if "encountering" in trigger_text or "examining" in trigger_text:
        return "when_encountering"
    if "defeating" in trigger_text:
        return "after_defeating"
    if "acquiring" in trigger_text:
        return "after_acquiring"
    if "first appears" in trigger_text:
        return "when_appears"
    if "closing" in trigger_text:
        return "after_closing"
    if "before" in trigger_text:
        return "before_scenario"
    return trigger_text


def parse_lore_entries(text):
    lines = text.split("\n")
    entries = []
    current_scenario = None
    current_adventure = None

    scenario_pattern = re.compile(
        r'^Scenario\s+([B\d]-\d):\s+(.+)$'
    )
    adventure_pattern = re.compile(
        r'^Adventure\s+([B\d]):\s+(.+?)(?:\s+Prologue)?$'
    )
    adventure_path_pattern = re.compile(
        r'^Adventure Path:\s+(.+?)(?:\s+Prologue)?$'
    )
    entry_pattern = re.compile(
        r'^(.+?)\s*\(read\s+(.+?)\)$'
    )
    scenario_intro_pattern = re.compile(
        r'^\(Now read the Scenario card\.\)$'
    )

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line or line.startswith("Page ") or line == "Continued…":
            i += 1
            continue

        adv_path_match = adventure_path_pattern.match(line)
        if adv_path_match:
            current_adventure = "prologue"
            text_block = collect_text_block(lines, i + 1)
            if text_block:
                entries.append({
                    "type": "prologue",
                    "adventure": "prologue",
                    "title": adv_path_match.group(1),
                    "trigger": "before_campaign",
                    "text": text_block,
                })
            i += 1
            continue

        adv_match = adventure_pattern.match(line)
        if adv_match:
            current_adventure = adv_match.group(1)
            text_block = collect_text_block(lines, i + 1)
            if text_block:
                entries.append({
                    "type": "adventure_prologue",
                    "adventure": current_adventure,
                    "title": adv_match.group(2),
                    "trigger": "before_adventure",
                    "text": text_block,
                })
            i += 1
            continue

        scen_match = scenario_pattern.match(line)
        if scen_match:
            current_scenario = scen_match.group(1)
            scenario_name = scen_match.group(2)
            text_block = collect_scenario_intro(lines, i + 1)
            if text_block:
                entries.append({
                    "type": "scenario_intro",
                    "scenario": current_scenario,
                    "adventure": current_adventure,
                    "card_name": scenario_name,
                    "trigger": "before_scenario",
                    "text": text_block,
                })
            i += 1
            continue

        entry_match = entry_pattern.match(line)
        if entry_match:
            card_name = entry_match.group(1).strip()
            trigger = parse_trigger(entry_match.group(2))
            text_block = collect_text_block(lines, i + 1)
            if text_block:
                entries.append({
                    "type": "card_entry",
                    "scenario": current_scenario,
                    "adventure": current_adventure,
                    "card_name": card_name,
                    "trigger": trigger,
                    "text": text_block,
                })
            i += 1
            continue

        i += 1

    return entries


def collect_text_block(lines, start_idx):
    """Collect text until we hit an entry header, scenario header, or page break."""
    block_lines = []
    i = start_idx

    scenario_pattern = re.compile(r'^Scenario\s+[B\d]-\d:')
    adventure_pattern = re.compile(r'^Adventure\s+[B\d]:')
    adventure_path_pattern = re.compile(r'^Adventure Path:')
    entry_pattern = re.compile(r'^.+?\s*\(read\s+.+?\)$')
    now_read_pattern = re.compile(r'^\(Now read the (?:Scenario|Adventure Deck) card\.\)$')

    while i < len(lines):
        line = lines[i].strip()

        if line.startswith("Page "):
            i += 1
            continue

        if line == "Continued…":
            i += 1
            continue

        if not line:
            if block_lines:
                block_lines.append("")
            i += 1
            continue

        if scenario_pattern.match(line) or adventure_pattern.match(line) or \
           adventure_path_pattern.match(line) or entry_pattern.match(line) or \
           now_read_pattern.match(line):
            break

        block_lines.append(line)
        i += 1

    text = "\n".join(block_lines).strip()
    while text.endswith("\n"):
        text = text[:-1]
    return text


def collect_scenario_intro(lines, start_idx):
    """Collect scenario intro text until '(Now read the Scenario card.)' or next entry."""
    block_lines = []
    i = start_idx

    while i < len(lines):
        line = lines[i].strip()

        if line.startswith("Page "):
            i += 1
            continue

        if line == "Continued…":
            i += 1
            continue

        if re.match(r'^\(Now read the (?:Scenario|Adventure Deck) card\.\)$', line):
            break

        if re.match(r'^.+?\s*\(read\s+.+?\)$', line):
            break

        if re.match(r'^Scenario\s+[B\d]-\d:', line):
            break

        if not line:
            if block_lines:
                block_lines.append("")
            i += 1
            continue

        block_lines.append(line)
        i += 1

    return "\n".join(block_lines).strip()


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


def main():
    parser = argparse.ArgumentParser(description="Parse Adventure Guide PDF into lore YAML")
    parser.add_argument(
        "--input",
        default="assets/PACG_Mummy_Text_v101.pdf",
        help="Path to the Adventure Guide PDF",
    )
    parser.add_argument(
        "--output",
        default="data/lore/entries.yaml",
        help="Output YAML file path",
    )
    args = parser.parse_args()

    print(f"Extracting text from {args.input}...")
    text = extract_pdf_text(args.input)
    print(f"  Extracted {len(text)} characters, {len(text.splitlines())} lines")

    print("Parsing lore entries...")
    entries = parse_lore_entries(text)

    by_type = {}
    for entry in entries:
        etype = entry["type"]
        by_type[etype] = by_type.get(etype, 0) + 1

    print(f"  Found {len(entries)} entries:")
    for etype, count in sorted(by_type.items()):
        print(f"    {etype}: {count}")

    by_adventure = {}
    for entry in entries:
        adv = entry.get("adventure", "unknown")
        by_adventure[adv] = by_adventure.get(adv, 0) + 1
    print("  By adventure:")
    for adv in sorted(by_adventure.keys()):
        print(f"    Adventure {adv}: {by_adventure[adv]} entries")

    print(f"\nWriting to {args.output}...")
    write_yaml({"entries": entries}, args.output)
    print("Done!")


if __name__ == "__main__":
    main()
