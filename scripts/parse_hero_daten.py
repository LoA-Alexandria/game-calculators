"""Parse Desktop/Heroes daten.txt files into a JSON dump for import."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"C:\Users\futor\Desktop\Heroes")
OUT = Path(r"C:\Users\futor\Desktop\PopEpoch\scripts\_hero-daten.json")

FOLDER_TO_ID = {
    "Achilles": "achilles",
    "Alexander der Große": "alexander-the-great",
    "Alfred der Große": "alfred-the-great",
    "Augustus": "augustus",
    "Billy the Kid": "billy-the-kid",
    "Björn Eisenseite": "bjorn-ironside",
    "Blackbeard": "blackbeard",
    "Caesar": "caesar",
    "Circe": "circe",
    "Da Vinci": "da-vinci",
    "Dante": "dante",
    "Eleonore von Aquitanien": "eleanor-of-aquitaine",
    "Galileo Galilei": "galileo-galilei",
    "Gawain": "garwain",
    "Gilgamesch": "gilgamesh",
    "Guinevere": "guinevere",
    "Hammurabi": "hammurabi",
    "Hector": "hector",
    "Herakles": "heracles",
    "Hermes": "hermes",
    "Isaac Newton": "isaac-newton",
    "Jeanne d'Arc": "joan-of-arc",
    "Karl der Große": "charles-the-great",
    "Kleopatra": "cleopatra",
    "Konfuzius": "confucius",
    "König Artus": "king-arthur",
    "Königin Victoria": "queen-victoria",
    "Lagertha": "lagertha",
    "Lancelot": "lancelot",
    "Merlin": "merlin",
    "Napoleon Bonaparte": "napoleon-bonaparte",
    "Odysseus": "odysseus",
    "Pompejus": "pompey",
    "Ragnar Lodbrok": "ragnar-lodbrok",
    "Richard I": "richard-i",
    "Sokrates": "socrates",
    "Spartacus": "spartacus",
    "Tutanchamun": "tutankhamun",
    "William Shakespeare": "william-shakespeare",
}

HEADING = re.compile(
    r"^(Skill|Buff|Produktion)(?:\s*\((Normal|Skin)\))?\s*—\s*(.+)$",
    re.I,
)
ST_LINE = re.compile(
    r"^St\.(\d+)\s+(?:(\d+)\s+Sterne\s+)?(?:X=([0-9.]+))?(.*)$",
)
PCT_LINE = re.compile(
    r"^St\.(\d+)\s+(?:(\d+)\s+Sterne\s+)?\+([0-9.]+)%\s*$",
)
KV = re.compile(r"([A-Za-zÄÖÜäöü]+)=([0-9.]+)")


def parse_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    lines = [ln.rstrip() for ln in text.splitlines()]
    meta = {"folder": path.parent.name, "raw_header": []}
    i = 0
    while i < len(lines) and not HEADING.match(lines[i]) and not lines[i].startswith("Skill"):
        if lines[i]:
            meta["raw_header"].append(lines[i])
        i += 1

    abilities = []
    while i < len(lines):
        m = HEADING.match(lines[i])
        if not m:
            i += 1
            continue
        kind, variant, name = m.group(1).lower(), (m.group(2) or "normal").lower(), m.group(3).strip()
        if kind == "produktion":
            kind = "production"
        i += 1
        body = []
        while i < len(lines) and not HEADING.match(lines[i]) and not lines[i].startswith("St."):
            if lines[i]:
                body.append(lines[i])
            i += 1
        levels = []
        while i < len(lines) and lines[i].startswith("St."):
            line = lines[i]
            pct = PCT_LINE.match(line)
            if pct:
                levels.append(
                    {
                        "level": int(pct.group(1)),
                        "stars": int(pct.group(2)) if pct.group(2) else None,
                        "vars": {"Z": pct.group(3)},
                    }
                )
            else:
                vars_ = {k: v for k, v in KV.findall(line)}
                st = re.match(r"^St\.(\d+)\s+(?:(\d+)\s+Sterne)?", line)
                levels.append(
                    {
                        "level": int(st.group(1)) if st else len(levels) + 1,
                        "stars": int(st.group(2)) if st and st.group(2) else None,
                        "vars": vars_,
                        "line": line,
                    }
                )
            i += 1
        notes = []
        while i < len(lines) and not HEADING.match(lines[i]):
            if lines[i] and not lines[i].startswith("Cutouts") and not lines[i].startswith("- Cutouts"):
                notes.append(lines[i])
            if HEADING.match(lines[i]):
                break
            i += 1
        abilities.append(
            {
                "kind": kind,
                "variant": variant,
                "name": name,
                "body": body,
                "levels": levels,
                "notes": notes,
            }
        )
    return {"meta": meta, "abilities": abilities}


def main() -> None:
    rows = []
    for folder, hid in FOLDER_TO_ID.items():
        path = ROOT / folder / "daten.txt"
        if not path.exists():
            print("missing", folder)
            continue
        parsed = parse_file(path)
        parsed["id"] = hid
        rows.append(parsed)
        kinds = [f"{a['kind']}/{a['variant']}:{len(a['levels'])}" for a in parsed["abilities"]]
        print(f"{hid:24} {kinds}")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT, "heroes", len(rows))


if __name__ == "__main__":
    main()
