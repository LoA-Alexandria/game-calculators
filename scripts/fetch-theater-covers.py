"""Download Goddess Theater play covers into public/goddess-theater/.

Source: https://pop-epochmobile.fandom.com/wiki/Goddess_Theater (14 September 2026).
Only the first (cover) image per play; skip stills beside it.
Python urllib gets 403; curl.exe with a Chrome UA and the wiki Referer works.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "goddess-theater"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
REFERER = "https://pop-epochmobile.fandom.com/wiki/Goddess_Theater"

FILES = {
    "https://static.wikia.nocookie.net/pop-epochmobile/images/c/c1/Image_2026-07-11_233644961.png/revision/latest": "oedipus-rex.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/1/17/Image_2026-07-11_233900469.png/revision/latest": "phantom-of-the-opera.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/6/64/Image_2026-07-12_005308185.png/revision/latest": "alice-in-wonderland.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/6/64/Image_2026-07-11_233207119.png/revision/latest": "count-of-monte-cristo.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/1/1b/Robin.png/revision/latest": "robinson-crusoe.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/1/11/Cats.png/revision/latest": "cats.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/2/2b/Frank.png/revision/latest": "frankenstein.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/b/b3/Macbeth.png/revision/latest": "macbeth.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/1/1a/Hamlet.png/revision/latest": "hamlet.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/b/b3/Pride.png/revision/latest": "pride-and-prejudice.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/8/8c/Romeo.png/revision/latest": "romeo-and-juliet.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/a/a7/Island.png/revision/latest": "treasure-island.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/2/24/Don.png/revision/latest": "don-quixote.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/9/91/Peter_pan.png/revision/latest": "peter-pan.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/8/85/Summer.png/revision/latest": "midsummer-nights-dream.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/1/12/Chicago.png/revision/latest": "chicago.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/2/2c/Music.png/revision/latest": "sound-of-music.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/6/6a/Robin_Hood.png/revision/latest": "robin-hood.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/c/c7/Wizard.png/revision/latest": "wizard-of-oz.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/c/c3/Aladdin.png/revision/latest": "aladdin.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/3/38/Sleeping.png/revision/latest": "sleeping-beauty.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/9/92/Little_Woman.png/revision/latest": "little-women.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/7/72/Red_riding_hood.png/revision/latest": "little-red-riding-hood.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/8/87/Happy_Prince.png/revision/latest": "happy-prince.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/8/87/Lion_King.png/revision/latest": "lion-king.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/6/60/Mozart.png/revision/latest": "mozart.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/f/f9/Three_musk.png/revision/latest": "three-musketeers.webp",
}


def main() -> None:
    import io

    from PIL import Image

    OUT.mkdir(parents=True, exist_ok=True)
    for url, local_name in FILES.items():
        raw = subprocess.check_output(
            [
                "curl.exe",
                "-sL",
                "-A",
                UA,
                "-e",
                REFERER,
                "-H",
                "Accept: image/webp,image/png,image/*",
                url,
            ],
        )
        image = Image.open(io.BytesIO(raw)).convert("RGBA")
        width, height = image.size
        scale = min(1, 240 / max(width, height))
        if scale < 1:
            image = image.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
        path = OUT / local_name
        image.save(path, format="WEBP", quality=88, method=6)
        print(f"{local_name} {path.stat().st_size} bytes {image.size}")


if __name__ == "__main__":
    main()
