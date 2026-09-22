"""Merge Pop Epoch Wiki Buildings page into buildings.json and fetch missing arts.

Roster + highest-stage art only — no per-level cost tables.
https://pop-epoch-help.fandom.com/wiki/Buildings
"""

from __future__ import annotations

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "lib" / "data" / "buildings.json"
PROD_CUTOUTS = ROOT / "public" / "production-buildings"
OUT_DIR = ROOT / "public" / "buildings"
TMP = ROOT / "scripts" / "tmp-wiki-buildings"
TMP.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
REFERER = "https://pop-epoch-help.fandom.com/"

# Wiki display name -> roster id (production keeps Discord ids where possible).
NAME_TO_ID = {
    "Seafarer's Home": "seafarers-home",
    "Spice Workshop": "spice-workshop",  # was cafe
    "Coal Plant": "coal-plant",  # was coal-mine
    "Precision Parts Plant": "precision-parts-plant",
    "Oil Plant": "oil-plant",
    "Communications Bureau": "communications-bureau",
    "Pikeman Barracks": "pikeman-barracks",
    "Archer Barracks": "archer-barracks",
    "Shieldman Barracks": "shieldman-barracks",
    "Cavalry Barracks": "cavalry-barracks",
    "Guard Barracks": "guard-barracks",
    "Musket Barracks": "musket-barracks",
    "Iron Wall Barracks": "iron-wall-barracks",
    "Mounted Police Station": "mounted-police-station",
    "Worker Dormitory": "worker-dormitory",
    "Tram Apartment": "tram-apartment",
    "Country Villa": "country-villa",
    "Noble Manor": "noble-manor",
    "Lumber Mill": "lumber-mill",
    "Copper Mine": "copper-mine",
    "Glass Workshop": "glass-workshop",
    "Paper Mill": "paper-mill",
    "Art Workshop": "art-workshop",
    "Steel Plant": "steel-plant",
    "Firearm Workshop": "firearm-workshop",
}

# Existing production cutouts to keep (filename under public/production-buildings/).
PROD_CUTOUT_BY_ID = {
    "lumber-mill": "lumber-mill.webp",
    "farm": "farm.webp",
    "quarry": "quarry.webp",
    "copper-mine": "copper-mine.webp",
    "blacksmith": "blacksmith.webp",
    "weavery": "weavery.webp",
    "pasture": "pasture.webp",
    "brewery": "brewery.webp",
    "tannery": "tannery.webp",
    "glass-workshop": "glass-workshop.webp",
    "paper-mill": "paper-mill.webp",
    "art-workshop": "art-workshop.webp",
    "steel-plant": "steel-plant.webp",
    "firearm-workshop": "firearm-workshop.webp",
    "plantation": "plantation.webp",
    "spice-workshop": "cafe.webp",  # keep cutout; rename id only
}

# Discord production metadata keyed by new id.
PRODUCTION_META: dict[str, dict] = {
    "lumber-mill": {
        "group": "basic",
        "produces": "wood",
        "requires": ["wood", "stone"],
        "priority": 2,
        "tags": ["pikemanBarracks"],
    },
    "farm": {
        "group": "basic",
        "produces": "food",
        "requires": ["wood", "stone"],
        "priority": 1,
        "tags": [],
    },
    "quarry": {
        "group": "basic",
        "produces": "stone",
        "requires": ["wood", "stone"],
        "priority": 2,
        "tags": ["archerBarracksExploration"],
    },
    "copper-mine": {
        "group": "basic",
        "produces": "copper",
        "requires": ["stone", "copper"],
        "priority": 2,
        "tags": ["shieldBarracks"],
    },
    "blacksmith": {
        "group": "basic",
        "produces": "iron",
        "requires": ["copper", "iron"],
        "priority": 3,
        "tags": ["allSoldiersExploration", "replacesWoodExplorationPikemen"],
    },
    "weavery": {
        "group": "advanced",
        "produces": "cloth",
        "requires": ["wood", "copper"],
        "priority": 0,
        "tags": ["researchRenaissance", "goldGeneration"],
    },
    "pasture": {
        "group": "advanced",
        "produces": "horses",
        "requires": ["food", "copper"],
        "priority": 1,
        "tags": ["cavalryBarracksExploration"],
    },
    "brewery": {
        "group": "luxury",
        "produces": "alcohol",
        "requires": ["wood", "iron"],
        "priority": 0,
        "tags": ["researchEarlyExploration"],
    },
    "tannery": {
        "group": "luxury",
        "produces": "leather",
        "requires": ["iron", "leather"],
        "priority": 2,
        "tags": ["luxuryExplorationBasis"],
    },
    "glass-workshop": {
        "group": "luxury",
        "produces": "glass",
        "requires": ["stone", "leather"],
        "priority": 0,
        "tags": ["researchEarlyExploration"],
    },
    "paper-mill": {
        "group": "luxury",
        "produces": "paper",
        "requires": ["leather", "paper"],
        "priority": 2,
        "tags": ["researchMidExploration"],
    },
    "art-workshop": {
        "group": "luxury",
        "produces": "creations",
        "requires": ["copper", "paper"],
        "priority": 0,
        "tags": ["researchLateExplorationEnlightenment"],
    },
    "steel-plant": {
        "group": "exploration",
        "produces": "steel",
        "requires": ["iron", "leather"],
        "priority": 3,
        "tags": ["soldiersAfterExploration", "explorationResourcesBasis"],
    },
    "firearm-workshop": {
        "group": "exploration",
        "produces": "gunpowder",
        "requires": ["paper", "steel"],
        "priority": 1,
        "tags": ["explorationArchersCavalry"],
    },
    "plantation": {
        "group": "enlightenment",
        "produces": "lemons",
        "requires": ["paper", "lemons"],
        "priority": 1,
        "tags": [],
    },
    "spice-workshop": {
        "group": "enlightenment",
        "produces": "coffee",
        "requires": ["steel", "lemons"],
        "priority": 0,
        "tags": [],
    },
    "coal-plant": {
        "group": "steam",
        "produces": "coal",
        "requires": ["paper", "coal"],
        "priority": 1,
        "tags": ["lignite"],
    },
    "precision-parts-plant": {
        "group": "steam",
        "produces": "precisionParts",
        "requires": ["iron", "lemons", "precisionParts"],
        "priority": 0,
        "tags": [],
    },
    "oil-plant": {
        "group": "steam",
        "produces": "oil",
        "requires": ["steel", "oil"],
        "priority": 0,
        "tags": [],
    },
    "communications-bureau": {
        "group": "steam",
        "produces": "information",
        "requires": ["coal", "information"],
        "priority": 0,
        "tags": [],
    },
}

# Production order follows Discord age groups, not wiki card order.
PRODUCTION_ORDER = [
    "lumber-mill",
    "farm",
    "quarry",
    "copper-mine",
    "blacksmith",
    "weavery",
    "pasture",
    "brewery",
    "tannery",
    "glass-workshop",
    "paper-mill",
    "art-workshop",
    "steel-plant",
    "firearm-workshop",
    "plantation",
    "spice-workshop",
    "coal-plant",
    "precision-parts-plant",
    "oil-plant",
    "communications-bureau",
]


def slugify(name: str) -> str:
    text = name.casefold()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def building_id(name: str) -> str:
    return NAME_TO_ID.get(name, slugify(name))


def curl_json(url: str) -> dict:
    raw = subprocess.check_output(
        ["curl.exe", "-sL", "-A", UA, "-H", f"Referer: {REFERER}", url],
        text=True,
        encoding="utf-8",
    )
    return json.loads(raw)


def fetch_wikitext() -> str:
    url = (
        "https://pop-epoch-help.fandom.com/api.php?"
        + urllib.parse.urlencode(
            {
                "action": "parse",
                "page": "Buildings",
                "prop": "wikitext",
                "formatversion": "2",
                "format": "json",
            }
        )
    )
    return curl_json(url)["parse"]["wikitext"]


def image_url(filename: str) -> str:
    title = filename.replace(" ", "_")
    api = (
        "https://pop-epoch-help.fandom.com/api.php?"
        + urllib.parse.urlencode(
            {
                "action": "query",
                "titles": f"File:{title}",
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json",
            }
        )
    )
    data = curl_json(api)
    page = next(iter(data["query"]["pages"].values()))
    return page["imageinfo"][0]["url"]


def download_webp(filename: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 2000:
        head = dest.read_bytes()[:12]
        if head.startswith(b"RIFF") and head.endswith(b"WEBP"):
            return
    png = TMP / filename.replace(" ", "_")
    url = image_url(filename)
    print(f"GET {filename}")
    subprocess.check_call(
        [
            "curl.exe",
            "-sL",
            "-A",
            UA,
            "-H",
            f"Referer: {REFERER}",
            "-H",
            "Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            url,
            "-o",
            str(png),
        ]
    )
    img = Image.open(png).convert("RGBA")
    w, h = img.size
    scale = min(1, 280 / max(w, h))
    if scale < 1:
        img = img.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    img.save(dest, "WEBP", quality=88, method=6)


def parse_roster(wikitext: str) -> list[dict]:
    rows: list[dict] = []
    for section_title, category in [
        ("Population buildings", "population"),
        ("Production buildings", "production"),
        ("Military buildings", "military"),
    ]:
        match = re.search(rf"== {re.escape(section_title)} ==(.+?)(?=\n== |\Z)", wikitext, re.S)
        if not match:
            raise SystemExit(f"missing section {section_title}")
        cards = re.split(r'<div class="pe-build__card', match.group(1))[1:]
        for card in cards:
            name_m = re.search(r'pe-build__name">\[\[([^|\]]+)', card)
            art_m = re.search(r"\[\[File:([^\|\]]+)", card)
            levels_m = re.search(r"Levels:'''\s*([^<]+)", card)
            if not name_m or not art_m:
                continue
            name = name_m.group(1).strip()
            level_raw = (levels_m.group(1) if levels_m else "").replace("\u2013", "-").replace("\u2014", "-")
            level_m = re.search(r"(\d+)\s*-\s*(\d+)", level_raw)
            rows.append(
                {
                    "category": category,
                    "name": name,
                    "id": building_id(name),
                    "art": art_m.group(1).strip(),
                    "levelMax": int(level_m.group(2)) if level_m else None,
                }
            )
    return rows


def main() -> None:
    print("Fetching Buildings wikitext…")
    wiki_rows = parse_roster(fetch_wikitext())
    by_id = {row["id"]: row for row in wiki_rows}
    assert len(by_id) == len(wiki_rows), "duplicate ids"

    buildings: list[dict] = []

    # Population in wiki order
    for row in wiki_rows:
        if row["category"] != "population":
            continue
        bid = row["id"]
        dest = OUT_DIR / f"{bid}.webp"
        download_webp(row["art"], dest)
        buildings.append(
            {
                "id": bid,
                "name": row["name"],
                "category": "population",
                "levelMax": row["levelMax"],
                "image": f"buildings/{bid}.webp",
            }
        )

    # Production in Discord group order
    for bid in PRODUCTION_ORDER:
        row = by_id[bid]
        meta = PRODUCTION_META[bid]
        cutout = PROD_CUTOUT_BY_ID.get(bid)
        if cutout and (PROD_CUTOUTS / cutout).exists():
            image = f"production-buildings/{cutout}"
        else:
            dest = OUT_DIR / f"{bid}.webp"
            download_webp(row["art"], dest)
            image = f"buildings/{bid}.webp"
        buildings.append(
            {
                "id": bid,
                "name": row["name"],
                "category": "production",
                "levelMax": row["levelMax"],
                "image": image,
                "group": meta["group"],
                "produces": meta["produces"],
                "requires": meta["requires"],
                "priority": meta["priority"],
                "tags": meta["tags"],
            }
        )

    # Military in wiki order
    for row in wiki_rows:
        if row["category"] != "military":
            continue
        bid = row["id"]
        dest = OUT_DIR / f"{bid}.webp"
        download_webp(row["art"], dest)
        buildings.append(
            {
                "id": bid,
                "name": row["name"],
                "category": "military",
                "levelMax": row["levelMax"],
                "image": f"buildings/{bid}.webp",
            }
        )

    assert len(buildings) == 37, len(buildings)
    DATA_PATH.write_text(json.dumps({"buildings": buildings}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {DATA_PATH} ({len(buildings)} buildings)")


if __name__ == "__main__":
    main()
