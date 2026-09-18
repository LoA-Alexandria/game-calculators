"""Merge Pop Epoch Wiki Goddess page into goddesses.json and fetch missing portraits."""

from __future__ import annotations

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WIKI_JSON = Path(r"C:\Users\futor\AppData\Local\Temp\wiki-goddesses.json")
DATA_PATH = ROOT / "lib" / "data" / "goddesses.json"
OUT_DIR = ROOT / "public" / "goddesses"
TMP = ROOT / "scripts" / "tmp-wiki-goddesses"
TMP.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)


def slugify(name: str) -> str:
    text = name.casefold()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


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
    w, h = img.size
    scale = min(1, 240 / max(w, h))
    if scale < 1:
        img = img.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    img.save(dest, "WEBP", quality=88, method=6)


def serialize(goddesses: list[dict]) -> str:
    rows: list[str] = []
    for index, g in enumerate(goddesses):
        comma = "," if index < len(goddesses) - 1 else ""
        images = "[" + ", ".join(json.dumps(f) for f in g["images"]) + "]"
        fields = [
            f'"id": {json.dumps(g["id"])}',
            f'"name": {json.dumps(g["name"], ensure_ascii=False)}',
            f'"rarity": {json.dumps(g["rarity"])}',
            f'"affinity": {json.dumps(g.get("affinity", ""), ensure_ascii=False)}',
            f'"obtain": {json.dumps(g.get("obtain", ""), ensure_ascii=False)}',
            f'"images": {images}',
        ]
        if g.get("title"):
            fields.append(f'"title": {json.dumps(g["title"], ensure_ascii=False)}')
        if g.get("bio"):
            fields.append(f'"bio": {json.dumps(g["bio"], ensure_ascii=False)}')
        if g.get("skinRaisesTo"):
            fields.append(f'"skinRaisesTo": {json.dumps(g["skinRaisesTo"])}')
        if g.get("missable"):
            fields.append('"missable": true')
        if g.get("unconfirmed"):
            fields.append('"unconfirmed": true')
        rows.append("    { " + ", ".join(fields) + " }" + comma)
    return '{\n  "goddesses": [\n' + "\n".join(rows) + "\n  ]\n}\n"


def main() -> None:
    wiki = json.loads(WIKI_JSON.read_text(encoding="utf-8"))
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    goddesses: list[dict] = data["goddesses"]
    by_id = {g["id"]: g for g in goddesses}
    by_name = {g["name"].casefold(): g for g in goddesses}

    matched = 0
    for card in wiki:
        gid = card["wikiId"].removeprefix("goddess-")
        g = by_id.get(gid) or by_name.get(card["name"].casefold())
        portrait = f"{gid}.webp"
        need_art = g is None or not g.get("images")

        if need_art:
            download_webp(card["file"], OUT_DIR / portrait)

        if g is None:
            g = {
                "id": gid,
                "name": card["name"],
                "rarity": "SSR",
                "affinity": "",
                "obtain": "Not confirmed yet",
                "images": [portrait],
                "unconfirmed": True,
            }
            # Insert at end of SSR group.
            end = 0
            for index, row in enumerate(goddesses):
                if row["rarity"] == "SSR":
                    end = index + 1
            goddesses.insert(end, g)
            by_id[gid] = g
            by_name[g["name"].casefold()] = g
            print(f"ADD {gid}")
        else:
            matched += 1
            if not g.get("images"):
                g["images"] = [portrait]
                print(f"ART {g['id']} <- {portrait}")

        g["title"] = card["title"]
        g["bio"] = card["bio"]

    DATA_PATH.write_text(serialize(goddesses), encoding="utf-8", newline="\n")
    print(f"updated {len(goddesses)} goddesses ({matched} matched)")


if __name__ == "__main__":
    main()
