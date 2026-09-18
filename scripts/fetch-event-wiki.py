"""Download Pop Epoch Wiki event help icons and page extracts.

Source: https://pop-epoch-help.fandom.com/wiki/Events (18 September 2026).
Writes:
  scripts/tmp-wiki-events/pages.json
  public/events/<id>.webp
"""

from __future__ import annotations

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "scripts" / "tmp-wiki-events"
OUT = ROOT / "public" / "events"
TMP.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 PopEpochBot"
REFERER = "https://pop-epoch-help.fandom.com/"

# Wiki page title -> our event guide id. Extra gallery-only titles stay unmapped.
WIKI_TO_ID = {
    "Delve into Atlantis": "atlantis",
    "Spring's Return": "springReturns",
    "Holy Grail Journey": "holyGrail",
    "Monument of Eternity": "monumentOfEternity",
    "Supply Reform": "supplyReform",
    "Trials of Odin": "trialsOfOdin",
    "Astral Wonderland": "astralWonderland",
    "Mushroom Adventure": "mushroomAdventure",
    "The Great Flood Is Back!": "greatFlood",
    "Dawn of Rome": "dawnOfRome",
    "Prize Toss Booth": "ringToss",
    "Life Incubator Lab": "lifeIncubator",
    "Road to the Cup": "roadToWorldcup",
    "Duel Festival": "duelFestival",
    "Mayan Ruins": "mayanRuins",
    "Peak of Enlightenment": "peakOfEnlightenment",
    "Red Carpet Night": "redCarpet",
    "Global Regatta": "globalRegatta",
    "Heart of Gold": "heartOfGold",
    "Harvest Festival": "springReturnsPlanting",
    "The Crown of the Nile": "crownOfTheNile",
    "Legend of Serenissima": "legendOfSerenissima",
    "Goddess of Time": "goddessOfTime",
    "Civilization Evolution": "civilizationEvolution",
    "Genie's Wish Machine Shop": "genieWish",
    "Shopping Cart Race": "shoppingCartRace",
    "Evolution Institute": "evolutionInstitute",
    "Glory Pick": "gloryPick",
    "Grand Voyage": "grandVoyage",
    "Tour Performance": "tourPerformance",
    "Muse's Choice": "museChoice",
    "Private Island": "privateIsland",
    "Military Supplies": "militarySupplies",
    "Tap Football": "tapFootball",
    "Thriving Industries": "thrivingIndustries",
    "Race to Civilization": "raceToCivilization",
    "Guild Co-op": "guildCoop",
    "Whispers of Fortune": "whispersOfFortune",
    "Destiny": "destiny",
    "Hunting Challenge": "huntingChallenge",
    "Forging Shop": "forgingShop",
    "Valentine's Day Shopping Spree": "valentinesShoppingSpree",
    "Where is the Bunny?": "whereIsTheBunny",
}

PAGES = list(WIKI_TO_ID.keys())


def api(**params) -> dict:
    params.setdefault("format", "json")
    url = "https://pop-epoch-help.fandom.com/api.php?" + urllib.parse.urlencode(params)
    raw = subprocess.check_output(["curl.exe", "-sL", "-A", UA, url], text=True, encoding="utf-8")
    return json.loads(raw)


def slugify(name: str) -> str:
    text = name.casefold()
    text = text.replace("'", "")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def image_url(filename: str) -> str | None:
    title = filename.replace(" ", "_")
    data = api(
        action="query",
        titles=f"File:{title}",
        prop="imageinfo",
        iiprop="url",
    )
    page = next(iter(data["query"]["pages"].values()))
    info = page.get("imageinfo")
    if not info:
        return None
    return info[0]["url"]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
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
            str(dest),
        ]
    )


def to_webp(src: Path, dest: Path, long_edge: int = 256) -> None:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    scale = min(1, long_edge / max(w, h))
    if scale < 1:
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=88, method=6)


def help_filename(wiki_title: str) -> str:
    return f"Help_-_{wiki_title.replace(' ', '_')}.png"


def fetch_page(title: str) -> dict:
    data = api(
        action="query",
        titles=title,
        prop="extracts|images|info|revisions",
        explaintext="1",
        exsectionformat="wiki",
        inprop="url",
        rvprop="content",
        rvslots="main",
        redirects="1",
    )
    page = next(iter(data["query"]["pages"].values()))
    missing = "missing" in page
    extract = page.get("extract", "") if not missing else ""
    images = [img["title"] for img in page.get("images", [])] if not missing else []
    wikitext = ""
    if not missing:
        revisions = page.get("revisions") or []
        if revisions:
            wikitext = revisions[0].get("slots", {}).get("main", {}).get("*", "")
    return {
        "title": title,
        "id": WIKI_TO_ID[title],
        "missing": missing,
        "pageid": page.get("pageid"),
        "fullurl": page.get("fullurl"),
        "extract": extract,
        "images": images,
        "wikitext": wikitext,
    }


def main() -> None:
    events_page = api(action="parse", page="Events", prop="images|wikitext|links")
    parsed = events_page["parse"]
    gallery_files = [name for name in parsed.get("images", []) if name.startswith("Help_-_")]
    print(f"Events hub images: {len(gallery_files)}")

    pages = []
    for title in PAGES:
        print(f"PAGE {title}")
        pages.append(fetch_page(title))

    dump = {
        "source": "https://pop-epoch-help.fandom.com/wiki/Events",
        "fetched": "2026-09-18",
        "galleryFiles": gallery_files,
        "pages": pages,
    }
    (TMP / "pages.json").write_text(json.dumps(dump, ensure_ascii=False, indent=2), encoding="utf-8")

    for page in pages:
        event_id = page["id"]
        dest = OUT / f"{event_id}.webp"
        filename = help_filename(page["title"])
        url = image_url(filename)
        if not url:
            # Fall back to any File:Help_-_ listed on the page.
            help_on_page = next((name for name in page["images"] if name.startswith("File:Help_-_")), None)
            if help_on_page:
                url = image_url(help_on_page.removeprefix("File:"))
        if not url:
            print(f"NO ICON {event_id} ({page['title']})")
            continue
        png = TMP / filename.replace("/", "_")
        print(f"ICON {event_id} <- {filename}")
        download(url, png)
        to_webp(png, dest)

    print("done")


if __name__ == "__main__":
    main()
