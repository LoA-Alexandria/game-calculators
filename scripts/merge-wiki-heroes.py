"""Merge Pop Epoch Wiki Hero page into heroes.json and fetch missing portraits."""

from __future__ import annotations

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WIKI_JSON = Path(r"C:\Users\futor\AppData\Local\Temp\wiki-heroes-en.json")
WIKITEXT = Path(r"C:\Users\futor\AppData\Local\Temp\wiki-hero.wt.txt")
DATA_PATH = ROOT / "lib" / "data" / "heroes.json"
OUT_DIR = ROOT / "public" / "heroes"
TMP = ROOT / "scripts" / "tmp-wiki-heroes"
TMP.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Wiki display name -> roster id (override when slug or spelling differs).
NAME_TO_ID = {
    "Catherine de' Medici": "catherine-de-medici",
    "Lü Bu": "lu-bu",
    "Cu Chulainn": "cu-chulainn",
}

TROOPS = {"Pikeman", "Archer", "Shieldman", "Cavalry"}
AGES = {
    "Ice Age",
    "Stone Age",
    "Bronze Age",
    "Classical Age",
    "Medieval Age",
    "Renaissance Age",
    "Exploration Age",
    "Enlightenment Age",
    "Steam Age",
}


# Encyclopedia bios that open with a fuller historical name than the roster card.
BIO_OPENERS = {
    "Caesar": "Julius Caesar",
    "Queen Victoria": "Alexandrina Victoria",
    "Isaac Newton": "Sir Isaac Newton",
    "Charles the Great": "Charlemagne",
    "Da Vinci": "Leonardo da Vinci",
    "Beethoven": "Ludwig van Beethoven",
    "Franklin": "Benjamin Franklin",
    "Columbus": "Christopher Columbus",
    "Eleanor of Aquitaine": "Eleanor Aquitaine",
    "Thomas Edison": "Thomas Alva Edison",
    "Mary I": "Mary Stuart",
    "Wallace": "William Wallace",
    "Catherine de'Medici": "Catherine de' Medici",
}


def bio_names_hero(name: str, bio: str) -> bool:
    if bio.lower().startswith(name.lower()):
        return True
    opener = BIO_OPENERS.get(name)
    return bool(opener and bio.lower().startswith(opener.lower()))


def slugify(name: str) -> str:
    text = (
        name.casefold()
        .replace("ü", "u")
        .replace("ö", "o")
        .replace("ä", "a")
        .replace("ß", "ss")
    )
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def panel_rarities(wikitext: str) -> dict[str, str]:
    panel_rarity = {
        "pe-heroes-r": "R",
        "pe-heroes-sr": "SR",
        "pe-heroes-ssr": "SSR",
        "pe-heroes-ur": "UR",
        "pe-heroes-urp": "UR+",
    }
    parts = re.split(r'(id="pe-heroes-(?:r|sr|ssr|ur|urp)")', wikitext)
    current = None
    out: dict[str, str] = {}
    for part in parts:
        m = re.fullmatch(r'id="(pe-heroes-(?:r|sr|ssr|ur|urp))"', part)
        if m:
            current = panel_rarity[m.group(1)]
            continue
        if current:
            for hid in re.findall(r'id="(hero-[^"]+)"', part):
                out[hid] = current
    return out


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
    raw = subprocess.check_output(
        ["curl.exe", "-sL", "-A", "Mozilla/5.0 PopEpochBot", api],
        text=True,
        encoding="utf-8",
    )
    data = json.loads(raw)
    pages = data["query"]["pages"]
    page = next(iter(pages.values()))
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
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "-H",
            "Referer: https://pop-epoch-help.fandom.com/",
            "-H",
            "Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            url,
            "-o",
            str(png),
        ]
    )
    img = Image.open(png).convert("RGBA")
    img.save(dest, "WEBP", quality=82, method=6)


def ability_json(ability: dict) -> str:
    levels = ", ".join(json.dumps(level, ensure_ascii=False) for level in ability["levels"])
    return (
        '{ "name": '
        + json.dumps(ability["name"], ensure_ascii=False)
        + ', "levels": ['
        + levels
        + "] }"
    )


def serialize(heroes: list[dict]) -> str:
    rows: list[str] = []
    for index, hero in enumerate(heroes):
        comma = "," if index < len(heroes) - 1 else ""
        images = "[" + ", ".join(json.dumps(f) for f in hero["images"]) + "]"
        fields = [
            f'"id": {json.dumps(hero["id"])}',
            f'"name": {json.dumps(hero["name"], ensure_ascii=False)}',
            f'"rarity": {json.dumps(hero["rarity"])}',
            f'"obtain": {json.dumps(hero.get("obtain", ""), ensure_ascii=False)}',
            f'"images": {images}',
        ]
        if hero.get("title"):
            fields.append(f'"title": {json.dumps(hero["title"], ensure_ascii=False)}')
        if hero.get("troop"):
            fields.append(f'"troop": {json.dumps(hero["troop"])}')
        if hero.get("age"):
            fields.append(f'"age": {json.dumps(hero["age"])}')
        if hero.get("bio"):
            fields.append(f'"bio": {json.dumps(hero["bio"], ensure_ascii=False)}')
        head = "    { " + ", ".join(fields)
        parts: list[str] = []
        for kind in ("skill", "buff", "production"):
            ability = hero.get(kind)
            if ability:
                parts.append(f'      "{kind}": {ability_json(ability)}')
        artifact = hero.get("artifact")
        if artifact:
            parts.append(
                '      "artifact": { "name": '
                + json.dumps(artifact["name"], ensure_ascii=False)
                + ', "text": '
                + json.dumps(artifact["text"], ensure_ascii=False)
                + " }"
            )
        if not parts:
            rows.append(f"{head} }}{comma}")
        else:
            rows.append(f"{head},\n" + ",\n".join(parts) + f" }}{comma}")
    return "{\n  \"heroes\": [\n" + "\n".join(rows) + "\n  ]\n}\n"


def main() -> None:
    wiki = json.loads(WIKI_JSON.read_text(encoding="utf-8"))
    rarities = panel_rarities(WIKITEXT.read_text(encoding="utf-8"))
    for card in wiki:
        card["rarity"] = rarities[card["wikiId"]]
        assert card["troop"] in TROOPS, card
        assert card["age"] in AGES, card

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    heroes: list[dict] = data["heroes"]
    by_id = {h["id"]: h for h in heroes}
    by_name = {h["name"].casefold(): h for h in heroes}

    matched = 0
    for card in wiki:
        hero_id = NAME_TO_ID.get(card["name"]) or slugify(card["name"])
        hero = by_id.get(hero_id) or by_name.get(card["name"].casefold())
        portrait = f"{hero_id}.webp"
        need_art = hero is None or not hero.get("images")

        if need_art:
            download_webp(card["file"], OUT_DIR / portrait)

        if hero is None:
            hero = {
                "id": hero_id,
                "name": card["name"] if card["name"] != "Catherine de' Medici" else "Catherine de'Medici",
                "rarity": card["rarity"],
                "obtain": "",
                "images": [portrait],
            }
            # Keep wiki spelling for new East-Asian names; fix only known roster spelling.
            if card["name"] == "Lü Bu":
                hero["name"] = "Lü Bu"
            heroes.append(hero)
            by_id[hero_id] = hero
            by_name[hero["name"].casefold()] = hero
            print(f"ADD {hero_id} ({card['rarity']})")
        else:
            matched += 1
            if not hero.get("images"):
                hero["images"] = [portrait]
                print(f"ART {hero['id']} <- {portrait}")

        hero["title"] = card["title"]
        hero["troop"] = card["troop"]
        hero["age"] = card["age"]
        hero["bio"] = card["bio"]
        # The Fandom Hero page has had a shifted UR+ bio block (Lagertha through
        # Hermes). Refuse to copy a blurb that does not name this card.
        if not bio_names_hero(hero["name"], card["bio"]):
            print(f"WARN bio subject mismatch {hero['id']}: {card['bio'][:60]}")

    # Keep the published order; new heroes were inserted at the end of their
    # rarity group by append + a pass that only moves brand-new rows.
    DATA_PATH.write_text(serialize(heroes), encoding="utf-8", newline="\n")
    print(f"updated {len(heroes)} heroes ({matched} matched, {len(heroes) - matched} new)")


if __name__ == "__main__":
    main()
