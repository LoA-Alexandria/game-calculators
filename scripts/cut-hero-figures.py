"""Cut the small hero figures out of German client screenshots.

Sources live in the local Heroes dump (`Desktop/Heroes/<hero>/Cutouts/
chibi-normal-*.png`, 18 September 2026), where an earlier pass already took
the figure off the beige panel. What is still around it is the pedestal it
stands on and the "St. 500" level badge below it, and both have to go.

Every cutout comes from the same panel, so the pedestal always sits in the
same place; only its colour changes with the hero's star tier (pink, gold or
purple). That makes the pedestal separable without touching the figure:

1. Heroes are grouped by the colour of their pedestal. Inside a group the same
   pixel shows the same pedestal in every hero who does not happen to stand on
   it, so the colour most of them agree on is a clean plate - the pedestal with
   nobody on it. The pedestal is a ring shape, so rings of equal radius fill in
   what the figures hide.
2. The plate is then flooded away, starting where it matches exactly. Chibi art
   draws a dark outline around every figure, and that outline stops the flood;
   that is what keeps skin tones, which are as pink as the pedestal, from being
   eaten. A shadow the figure drops on its pedestal keeps the plate's ratio
   between the colour channels, so the flood passes it too.
3. Whatever is left floating entirely inside the pedestal is pedestal as well:
   the figure always reaches above it.

Output is WebP in `public/heroes/chibi/<hero id>.webp`, trimmed to the figure.
Run it after adding screenshots, then update `lib/content/hero-chibis.ts`.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "heroes" / "chibi"
ROSTER = ROOT / "lib" / "data" / "heroes.json"
HEROES = Path(r"C:\Users\futor\Desktop\Heroes")

REF = (242, 340)          # what a 1080-wide screenshot produces
BADGE_TOP = 254           # from here down: the level badge
CX, CY, RX, RY = 128.0, 233.0, 86.0, 22.0   # the pedestal ellipse
REACH = 1.5               # out to here its soft glow still shows
SEED_AT, GROW_TO = 20.0, 48.0               # colour distance to the plate

# The screenshots come from the German client, so the folders carry German names.
HERO_ID = {
    "Achilles": "achilles",
    "Adam": "adam",
    "Alexander der Große": "alexander-the-great",
    "Alfred der Große": "alfred-the-great",
    "Augustus": "augustus",
    "Beethoven": "beethoven",
    "Billy the Kid": "billy-the-kid",
    "Björn Eisenseite": "bjorn-ironside",
    "Blackbeard": "blackbeard",
    "Caesar": "caesar",
    "Charles Darwin": "charles-darwin",
    "Circe": "circe",
    "Da Vinci": "da-vinci",
    "Dante": "dante",
    "Eleonore von Aquitanien": "eleanor-of-aquitaine",
    "Franklin": "franklin",
    "Galileo Galilei": "galileo-galilei",
    "Gawain": "garwain",
    "Gilgamesch": "gilgamesh",
    "Guinevere": "guinevere",
    "Hammurabi": "hammurabi",
    "Hector": "hector",
    "Herakles": "heracles",
    "Hermes": "hermes",
    "Homer": "homer",
    "Isaac Newton": "isaac-newton",
    "Jeanne d'Arc": "joan-of-arc",
    "Karl der Große": "charles-the-great",
    "Kleopatra": "cleopatra",
    "Kolumbus": "columbus",
    "Konfuzius": "confucius",
    "König Artus": "king-arthur",
    "Königin Victoria": "queen-victoria",
    "Lagertha": "lagertha",
    "Lancelot": "lancelot",
    "Livia Drusilla": "livia-drusilla",
    "Ludwig XIV": "louis-xiv",
    "Merlin": "merlin",
    "Michelangelo": "michelangelo",
    "Napoleon Bonaparte": "napoleon-bonaparte",
    "Nikola Tesla": "nikola-tesla",
    "Noah": "noah",
    "Odysseus": "odysseus",
    "Pompejus": "pompey",
    "Prometheus": "prometheus",
    "Ragnar Lodbrok": "ragnar-lodbrok",
    "Richard I": "richard-i",
    "Sokrates": "socrates",
    "Spartacus": "spartacus",
    "Tutanchamun": "tutankhamun",
    "Wallace": "wallace",
    "William Shakespeare": "william-shakespeare",
}


def load(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGBA")
    if im.size != REF:
        im = im.resize(REF, Image.LANCZOS)
    return np.array(im, dtype=np.int16)


def region() -> np.ndarray:
    """The pedestal and the glow around it."""
    y, x = np.mgrid[0:REF[1], 0:REF[0]]
    return np.sqrt(((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2) <= REACH


def groups(images: list[np.ndarray]) -> tuple[list[int], list[tuple[int, ...]]]:
    """Heroes sorted by the colour of their pedestal outline."""
    centres: list[np.ndarray] = []
    out: list[int] = []
    for im in images:
        key = np.array([int(v) for v in im[252, 62, :3]])
        hit = next((i for i, c in enumerate(centres) if np.abs(key - c).max() <= 20), None)
        if hit is None:
            centres.append(key)
            hit = len(centres) - 1
        out.append(hit)
    return out, [tuple(int(v) for v in c) for c in centres]


def plate_of(images: list[np.ndarray], area: np.ndarray, agree: float = 0.34) -> tuple[np.ndarray, np.ndarray]:
    """Per pixel the colour most heroes of a group show, and whether enough do."""
    stack = np.stack([im[..., :3] for im in images]).astype(np.float32)
    ys, xs = np.where(area)
    cols = stack[:, ys, xs]
    plate = np.zeros((REF[1], REF[0], 3))
    known = np.zeros((REF[1], REF[0]), bool)
    step = 2048
    for start in range(0, len(ys), step):
        block = cols[:, start:start + step]
        dist = np.sqrt(((block[:, None] - block[None, :]) ** 2).sum(-1))
        votes = (dist < 22).sum(axis=1)
        best = votes.argmax(axis=0)
        k = np.arange(block.shape[1])
        plate[ys[start:start + step], xs[start:start + step]] = block[best, k]
        known[ys[start:start + step], xs[start:start + step]] = votes[best, k] >= max(3, agree * len(images))
    # the pedestal is a ring shape, so rings fill in what the figures hide
    y, x = np.mgrid[0:REF[1], 0:REF[0]]
    rad = np.sqrt(((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2)
    which = np.digitize(rad, np.linspace(0, REACH, 60)) - 1
    for band in range(60):
        ring = area & (which == band)
        have = ring & known
        if have.sum() < 12 or not (ring & ~known).any():
            continue
        plate[ring & ~known] = np.median(plate[have], axis=0)
        known |= ring
    return plate, known


def cut(a: np.ndarray, plate: np.ndarray, known: np.ndarray, area: np.ndarray) -> Image.Image:
    a = a.copy()
    a[BADGE_TOP:, :, 3] = 0                                  # the level badge goes
    opaque = a[..., 3] > 24
    near = np.sqrt(((a[..., :3] - plate) ** 2).sum(axis=-1))
    dark = a[..., :3].max(axis=-1) < 110                     # the figure's own outline
    # A shadow on the pedestal is the same colour, only darker: it keeps the
    # plate's ratio between the channels, which skin does not.
    ratio = a[..., :3] / np.maximum(plate, 1)
    high, low = ratio.max(axis=-1), np.maximum(ratio.min(axis=-1), 1e-3)
    shaded = (high / low < 1.12) & (high < 1.06)
    passable = area & known & opaque & ~dark & ((near < GROW_TO) | shaded)
    pedestal = ndimage.binary_propagation(passable & (near < SEED_AT), mask=passable)
    a[..., 3] = np.where(pedestal, 0, a[..., 3])
    labels, count = ndimage.label(a[..., 3] > 24, np.ones((3, 3), bool))
    for part in range(1, count + 1):
        piece = labels == part
        if not (piece & ~area).any():                        # floating inside the pedestal
            a[..., 3] = np.where(piece, 0, a[..., 3])
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def trim(im: Image.Image, pad: int = 2) -> Image.Image:
    a = np.array(im)
    ys, xs = np.where(a[..., 3] > 24)
    if not len(ys):
        return im
    return im.crop((max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad),
                    min(a.shape[1], int(xs.max()) + 1 + pad), min(a.shape[0], int(ys.max()) + 1 + pad)))


def main() -> None:
    ids = {hero["id"] for hero in json.loads(ROSTER.read_text(encoding="utf-8"))["heroes"]}
    unknown = sorted(set(HERO_ID.values()) - ids)
    if unknown:
        raise SystemExit(f"not in the roster: {unknown}")

    files = sorted(HEROES.glob("*/Cutouts/chibi-normal-*.png"))
    images = [load(f) for f in files]
    area = region()
    group, centres = groups(images)
    big = {n for n in range(len(centres)) if group.count(n) >= 3}
    print("pedestal colours:", centres, "sizes:", [group.count(n) for n in range(len(centres))])
    plates = {n: plate_of([im for im, g in zip(images, group) if g == n], area) for n in big}

    best: dict[str, tuple[np.ndarray, int]] = {}
    for f, a, g in zip(files, images, group):
        hero = HERO_ID.get(f.parts[-3])
        if not hero:
            print("skipped:", f.parts[-3], "(no hero id)")
            continue
        if g not in big:
            print("skipped:", f"{f.parts[-3]}/{f.name}", "(unknown pedestal colour)")
            continue
        best.setdefault(hero, (a, g))          # a hero shot twice keeps the first usable one

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for hero, (a, g) in sorted(best.items()):
        plate, known = plates[g]
        path = OUT / f"{hero}.webp"
        trim(cut(a, plate, known, area)).save(path, "WEBP", quality=86, method=6)
        total += path.stat().st_size
    print(f"{len(best)} figures, {total / 1024:.0f} KB, {total / len(best) / 1024:.1f} KB each")
    for missing in sorted(set(HERO_ID.values()) - set(best)):
        print("no picture for:", missing)


if __name__ == "__main__":
    main()
