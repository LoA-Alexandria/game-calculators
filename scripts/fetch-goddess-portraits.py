"""Download Fandom goddess portraits into public/goddesses/.

Source: https://pop-epochmobile.fandom.com/wiki/Goddess (14 September 2026).
Python urllib gets 403; curl.exe with a Chrome UA and the wiki Referer works.
Bastet's wiki card is ???.png (placeholder), so she is not in FILES.
Hera's wiki file is named 1 (20).png.
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "goddesses"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

FILES = {
    "https://static.wikia.nocookie.net/pop-epochmobile/images/c/c0/Lady_Liberty.png/revision/latest": "lady-liberty.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/d/db/Hela.png/revision/latest": "hela.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/b/ba/Ixchel.png/revision/latest": "ixchel.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/c/c3/Medusa.png/revision/latest": "medusa.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/e/ec/Moirai.png/revision/latest": "moirai.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/1/19/Muse.png/revision/latest": "muse.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/6/68/Athena.png/revision/latest": "athena.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/3/38/Brunhild.png/revision/latest": "brunhild.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/8/85/Brunhild_skin.png/revision/latest": "brunhild-2.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/d/dc/Venus.png/revision/latest": "venus.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/e/e6/Vivian.png/revision/latest": "vivian.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/0/0b/Vivian_Skin.png/revision/latest": "vivian-2.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/d/d2/Artemis.png/revision/latest": "artemis.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/7/79/Artemis_Skin.png/revision/latest": "artemis-2.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/1/14/Fortuna.png/revision/latest": "fortuna.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/5/59/Fortuna_Skin.png/revision/latest": "fortuna-2.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/2/29/Freya.png/revision/latest": "freya.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/a/a8/1_%2820%29.png/revision/latest": "hera.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/6/64/Eve.png/revision/latest": "eve.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/7/7e/Eve_Skin.png/revision/latest": "eve-2.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/a/aa/Hestia.png/revision/latest": "hestia.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/b/be/Hestia_Skin.png/revision/latest": "hestia-2.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/c/c5/Nike.png/revision/latest": "nike.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/0/03/Demeter.png/revision/latest": "demeter.webp",
    "https://static.wikia.nocookie.net/pop-epochmobile/images/5/54/Demeter_skin.png/revision/latest": "demeter-2.webp",
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
                "https://pop-epochmobile.fandom.com/wiki/Goddess",
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
