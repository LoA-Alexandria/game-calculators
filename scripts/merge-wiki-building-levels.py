"""Extract building stage arts and level tables from the wiki Buildings page."""

from __future__ import annotations

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "lib" / "data" / "building-levels.json"
BUILDINGS_PATH = ROOT / "lib" / "data" / "buildings.json"
OUT_DIR = ROOT / "public" / "buildings" / "stages"
TMP = ROOT / "scripts" / "tmp-wiki-building-stages"
TMP.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
REFERER = "https://pop-epoch-help.fandom.com/"

NAME_TO_ID = {
    "Seafarer's Home": "seafarers-home",
    "Spice Workshop": "spice-workshop",
    "Coal Plant": "coal-plant",
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

WIKI_RESOURCE = {
    "Land": "land",
    "Wood": "wood",
    "Food": "food",
    "Stone": "stone",
    "Copper": "copper",
    "Iron": "iron",
    "Cloth": "cloth",
    "Horse": "horses",
    "Horses": "horses",
    "Wine": "alcohol",
    "Alcohol": "alcohol",
    "Leather": "leather",
    "Glass": "glass",
    "Paper": "paper",
    "Artwork": "creations",
    "Creations": "creations",
    "Steel": "steel",
    "Gunpowder": "gunpowder",
    "Lemon": "lemons",
    "Lemons": "lemons",
    "Coffee Bean": "coffee",
    "Coffee": "coffee",
    "Coal": "coal",
    "Precision Parts": "precisionParts",
    "Oil": "oil",
    "Information": "information",
}


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
    cached = Path(r"C:\Users\futor\AppData\Local\Temp\wiki-buildings2.json")
    if cached.exists() and cached.stat().st_size > 100_000:
        return json.loads(cached.read_text(encoding="utf-8"))["parse"]["wikitext"]
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
    data = curl_json(url)
    cached.write_text(json.dumps(data), encoding="utf-8")
    return data["parse"]["wikitext"]


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


def download_webp(filename: str, dest: Path, max_side: int = 320) -> None:
    if dest.exists() and dest.stat().st_size > 1500:
        head = dest.read_bytes()[:12]
        if head.startswith(b"RIFF") and head.endswith(b"WEBP"):
            return
    png = TMP / filename.replace(" ", "_")
    if png.exists():
        png.unlink()
    url = image_url(filename)
    print(f"GET {filename}", flush=True)
    subprocess.check_call(
        [
            "curl.exe",
            "-sL",
            "-A",
            UA,
            "-H",
            f"Referer: {REFERER}",
            "-H",
            "Accept: image/png,image/jpeg,image/webp,image/*,*/*;q=0.8",
            url,
            "-o",
            str(png),
        ]
    )
    raw = png.read_bytes()[:16]
    if raw.startswith(b"<!DOC") or raw.startswith(b"<html") or len(png.read_bytes()) < 500:
        raise RuntimeError(f"bad download for {filename}: {raw!r}")
    img = Image.open(png).convert("RGBA")
    w, h = img.size
    scale = min(1, max_side / max(w, h))
    if scale < 1:
        img = img.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    img.save(dest, "WEBP", quality=86, method=6)


COST_RE = re.compile(
    r'<span class="pe-build__cost">\[\[File:[^\]]+?alt=([^\]]+)\]\]\s*([^<]+?)</span>'
)


def parse_costs(cell: str) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for match in COST_RE.finditer(cell):
        alt = match.group(1).strip()
        rest = match.group(2).strip()
        amount_m = re.search(r"(\d[\d,.]*(?:\.\d+)?[KMBT]?)\s*$", rest, re.I)
        amount = amount_m.group(1) if amount_m else rest
        resource = WIKI_RESOURCE.get(alt, slugify(alt))
        out.append({"resource": resource, "amount": amount})
    return out


def parse_number_cell(cell: str) -> str:
    return re.sub(r"<[^>]+>", "", cell).strip()


def parse_card(card: str, category: str) -> dict | None:
    name_m = re.search(r'pe-build__name">\[\[([^|\]]+)', card)
    if not name_m:
        return None
    name = name_m.group(1).strip()
    bid = building_id(name)

    # Stage files: Building B#### N.png — keep ascending stage numbers.
    arts = re.findall(r"\[\[File:(Building B\d+ (\d+)\.png)", card)
    by_stage: dict[int, str] = {}
    for full, num in arts:
        by_stage[int(num)] = full
    stage_nums = sorted(by_stage)
    stages: list[str] = []
    for num in stage_nums:
        filename = by_stage[num]
        dest = OUT_DIR / f"{bid}-{num}.webp"
        download_webp(filename, dest)
        stages.append(f"buildings/stages/{bid}-{num}.webp")

    levels: list[dict] = []
    for rm in re.finditer(
        r'class="pe-build__row" data-level="(\d+)"[^>]*>\n\|[^\n]+\n',
        card,
    ):
        pass  # placeholder — use fuller regex below

    for rm in re.finditer(
        r'class="pe-build__row" data-level="(\d+)"[^\n]*\n\| (.+?)(?=\n\|-|\n\|\})',
        card,
        re.S,
    ):
        level = int(rm.group(1))
        cells = [c.strip() for c in rm.group(2).split(" || ")]
        # cells[0] is level again
        row: dict = {"level": level}
        if category == "population":
            # Level | pop | civ | upgrade
            if len(cells) >= 4:
                row["population"] = parse_number_cell(cells[1])
                row["civIndex"] = parse_number_cell(cells[2])
                row["upgrade"] = parse_costs(cells[3])
        elif category == "military":
            # Level | capacity | troopLv | civ | upgrade
            if len(cells) >= 5:
                row["troopCapacity"] = parse_number_cell(cells[1])
                row["troopLevel"] = parse_number_cell(cells[2])
                row["civIndex"] = parse_number_cell(cells[3])
                row["upgrade"] = parse_costs(cells[4])
        else:
            # Level | civ | upgrade | upkeep
            if len(cells) >= 4:
                row["civIndex"] = parse_number_cell(cells[1])
                row["upgrade"] = parse_costs(cells[2])
                row["upkeep"] = parse_costs(cells[3])
        levels.append(row)

    return {"id": bid, "name": name, "category": category, "stages": stages, "levels": levels}


def main() -> None:
    print("Fetching Buildings wikitext…", flush=True)
    wt = fetch_wikitext()
    catalog: dict[str, dict] = {}
    for section_title, category in [
        ("Population buildings", "population"),
        ("Production buildings", "production"),
        ("Military buildings", "military"),
    ]:
        match = re.search(rf"== {re.escape(section_title)} ==(.+?)(?=\n== |\Z)", wt, re.S)
        if not match:
            raise SystemExit(f"missing {section_title}")
        cards = re.split(r'<div class="pe-build__card', match.group(1))[1:]
        for card in cards:
            parsed = parse_card(card, category)
            if not parsed:
                continue
            print(
                f"{parsed['id']}: {len(parsed['stages'])} stages, {len(parsed['levels'])} levels",
                flush=True,
            )
            catalog[parsed["id"]] = {
                "stages": parsed["stages"],
                "levels": parsed["levels"],
            }

    DATA_PATH.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {DATA_PATH} ({len(catalog)} buildings, {DATA_PATH.stat().st_size // 1024} KB)", flush=True)

    # Point Spice Workshop portrait at wiki stage art instead of the old cafe cutout.
    buildings = json.loads(BUILDINGS_PATH.read_text(encoding="utf-8"))
    for building in buildings["buildings"]:
        if building["id"] == "spice-workshop":
            building["image"] = "buildings/stages/spice-workshop-5.webp"
            building["name"] = "Spice Workshop"
    BUILDINGS_PATH.write_text(json.dumps(buildings, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Updated spice-workshop portrait path")


if __name__ == "__main__":
    main()
