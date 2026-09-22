"""Download Pop Epoch Wiki anecdote arts and merge into anecdotes.json."""

from __future__ import annotations

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WIKI = json.loads((ROOT / "wiki-anecdotes-parsed.json").read_text(encoding="utf-8"))
DATA_PATH = ROOT / "lib" / "data" / "anecdotes.json"
OUT_DIR = ROOT / "public" / "anecdotes"
TMP = ROOT / "scripts" / "tmp-wiki-anecdotes"
TMP.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Wiki display name -> our anecdote id (or None for brand-new rows).
NAME_TO_ID = {
    "Conflict of Tongues": "conflict-of-tongues",
    "Artistic Duel": "artistic-duel",
    "Conqueror King": "conqueror-of-king",
    "King of Conquest II": "king-of-conquest-ii",
    "Invitation to Creation": "invitation-to-creation",
    "I Create the Mountain": "i-create-the-mountain",
    "Falling Meteor": "falling-meteor",
    "Warriors of Freedom": "warriors-of-freedom",
    "First Citizen of Civ": "first-citizen-of-civ",
    "Rewrite Destiny": "rewrite-destiny",
    "Philosophical Thesis": "philosophical-thesis",
    "Black Widow": "black-widow",
    "The Apple is Innocent": "the-apple-is-innocent",
    "Da Vinci's Palette": "da-vincis-palette",
    "The Dome Confinement": "the-dome-confinement",
    "Femme Fatale's Gift": "femme-fatales-gift",
    "Conqueror's Approval": "conquerors-approval",
    "Wishing Well": "wishing-well",
    "Glory Supersedes Blood": "glory-supercedes-blood",
    "Scholar from the East": "scholar-from-the-east",
    "Throne of the Lion": "throne-of-the-lion",
    "Secrets of Immortality": "secrets-of-immortality",
    "River God's Gift": "river-gods-gift",
    "Leap of Faith?": "leap-of-faith",
    "Pre-Easter Trouble": "pre-easter-trouble",
    "Undelivered Photos": "undelivered-photos",
    "Rainbow's Guidance": "rainbows-guidance",
    "Ocean Voyage Blocks": "ocean-voyage-blocks",
}

NEW_ROWS = {
    "the-apple-is-innocent": {
        "id": "the-apple-is-innocent",
        "group": "general",
        "name": "The Apple is Innocent",
        "prerequisite": "Civilization level reaches 18",
        "steps": [
            {"text": "In Odin's milestone, a snake has stolen an apple."},
            {"text": "An apple seems to have grown on the world tree."},
        ],
        "image": "the-apple-is-innocent.webp",
    },
    "da-vincis-palette": {
        "id": "da-vincis-palette",
        "group": "general",
        "name": "Da Vinci's Palette",
        "prerequisite": "Advance to the Renaissance Age",
        "steps": [
            {
                "text": "Open the aircraft that landed by the mountains and get ready for the colourful gas clouds."
            }
        ],
        "image": "da-vincis-palette.webp",
    },
    "pre-easter-trouble": {
        "id": "pre-easter-trouble",
        "group": "general",
        "name": "Pre-Easter Trouble",
        "prerequisite": "Participate in: Where is the Bunny?",
        "steps": [
            {
                "text": "Look! Nike has come to town, and she's even changed into an Easter outfit."
            }
        ],
        "image": "pre-easter-trouble.webp",
    },
}


def image_url(filename: str) -> str:
    # Spaces in wiki titles become underscores in FilePath.
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


def download(filename: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 10000:
        head = dest.read_bytes()[:4]
        if head.startswith(b"\x89PNG") or head.startswith(b"RIFF"):
            return
    url = image_url(filename)
    print(f"GET {filename} -> {url}")
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
            str(dest),
        ]
    )
    head = dest.read_bytes()[:4]
    if not (head.startswith(b"\x89PNG") or head.startswith(b"RIFF")):
        raise RuntimeError(f"Download blocked or invalid for {filename}: {head!r}")


def to_webp(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    # Keep card-sized art readable; long edge ~720.
    w, h = im.size
    scale = 720 / max(w, h)
    if scale < 1:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    im.save(dest, "WEBP", quality=85, method=6)


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    by_id = {row["id"]: row for row in data["anecdotes"]}

    for wiki in WIKI:
        anecdote_id = NAME_TO_ID[wiki["name"]]
        wiki_file = wiki["file"]
        assert wiki_file
        png = TMP / re.sub(r"[^\w.-]+", "_", wiki_file)
        download(wiki_file, png)
        webp_name = f"{anecdote_id}.webp"
        webp = OUT_DIR / webp_name
        to_webp(png, webp)

        if anecdote_id in NEW_ROWS:
            continue

        row = by_id[anecdote_id]
        row["image"] = webp_name
        # Fill empty step lists from the wiki (Femme Fatale).
        if not row.get("steps") and wiki["steps"]:
            row["steps"] = [{"text": step} for step in wiki["steps"]]
        # Prefer wiki unlock wording when ours is thinner and wiki is specific.
        # Keep Autumn prerequisites otherwise — they are often more precise.

    # Insert new general rows before the first egypt entry.
    first_egypt = next(i for i, row in enumerate(data["anecdotes"]) if row["group"] == "egypt")
    for new_id in ("the-apple-is-innocent", "da-vincis-palette", "pre-easter-trouble"):
        if new_id in by_id:
            by_id[new_id]["image"] = NEW_ROWS[new_id]["image"]
            continue
        data["anecdotes"].insert(first_egypt, NEW_ROWS[new_id])
        first_egypt += 1
        by_id[new_id] = NEW_ROWS[new_id]

    # Align display name spelling with the wiki where it only fixes a typo.
    by_id["glory-supercedes-blood"]["name"] = "Glory Supersedes Blood"

    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("anecdotes", len(data["anecdotes"]))
    print("images", len(list(OUT_DIR.glob("*.webp"))))


if __name__ == "__main__":
    main()
