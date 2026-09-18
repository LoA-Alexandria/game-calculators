"""Cut 17 hero-exclusive collection items from German client screenshots.

Sources live in the local Heroes dump (`Desktop/Heroes/*/Collection/`,
18 September 2026). Each item is cropped from the rug scene, run through
rembg `birefnet-general`, and stripped of the red UR glow. Each skill icon
is the circle inside the overlay ring, with the type badge and level painted
out. Output is WebP in `public/collection/` at the editor sizes (360 / 144).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "collection"
HEROES = Path(r"C:\Users\futor\Desktop\Heroes")

REF_W, REF_H = 1080, 2340
ITEM_BOX = (200, 420, 880, 830)
ICON_BOX = (50, 975, 248, 1175)
ITEM_MAX_EDGE = 360
ICON_MAX_EDGE = 144

ITEMS = [
    ("golden-throne", "Caesar"),
    ("sin-and-redemption", "Billy the Kid"),
    ("winged-sandals", "Hermes"),
    ("divine-greaves", "Achilles"),
    ("broken-shackles", "Spartacus"),
    ("eagle-scepter", "Pompejus"),
    ("nemean-lion-pelt", "Herakles"),
    ("circes-enchanted-chalice", "Circe"),
    ("pearl-earrings", "Kleopatra"),
    ("mona-lisa", "Da Vinci"),
    ("augustus-coin", "Augustus"),
    ("donkey-mask", "William Shakespeare"),
    ("tutankhamun-mask", "Tutanchamun"),
    ("bucephalus-golden-bridle", "Alexander der Große"),
    ("grimoire-of-gravity", "Isaac Newton"),
    ("queens-crown", "Königin Victoria"),
    ("napoleons-bicorne", "Napoleon Bonaparte"),
]


def screenshot_for(hero: str) -> Path:
    folder = HEROES / hero / "Collection"
    files = sorted(folder.glob("*.jpg"))
    if not files:
        raise FileNotFoundError(f"no collection screenshot in {folder}")
    return files[0]


def scaled_box(size: tuple[int, int], box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    sx, sy = size[0] / REF_W, size[1] / REF_H
    x1, y1, x2, y2 = box
    return (int(x1 * sx), int(y1 * sy), int(x2 * sx), int(y2 * sy))


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=85, method=6)


def fit_max_edge(image: Image.Image, max_edge: int) -> Image.Image:
    w, h = image.size
    longest = max(w, h)
    if longest <= max_edge:
        return image
    scale = max_edge / longest
    return image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)


def trim_alpha(image: Image.Image, pad: int = 2) -> Image.Image:
    alpha = np.array(image.getchannel("A"))
    ys, xs = np.nonzero(alpha > 12)
    if len(xs) == 0:
        return image
    x1, x2 = int(xs.min()), int(xs.max()) + 1
    y1, y2 = int(ys.min()), int(ys.max()) + 1
    x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
    x2, y2 = min(image.width, x2 + pad), min(image.height, y2 + pad)
    return image.crop((x1, y1, x2, y2))


def keep_large_components(image: Image.Image) -> Image.Image:
    arr = np.array(image)
    opaque = (arr[:, :, 3] > 16).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(opaque, connectivity=8)
    if n <= 2:
        return image
    areas = stats[1:, cv2.CC_STAT_AREA]
    floor = max(80, int(areas.max() * 0.04))
    keep = np.zeros(n, dtype=bool)
    keep[0] = False
    keep[1:] = areas >= floor
    mask = keep[labels]
    arr[:, :, 3] = np.where(mask, arr[:, :, 3], 0)
    return Image.fromarray(arr)


def drop_red_glow(image: Image.Image) -> Image.Image:
    arr = np.array(image)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    red_hue = (hue < 12) | (hue > 168)
    reddish = red_hue & (sat > 70) & (val > 35)
    trans = (alpha < 28).astype(np.uint8)
    near_trans = cv2.dilate(trans, np.ones((11, 11), np.uint8), iterations=1) > 0
    glow = reddish & ((alpha < 230) | near_trans)
    arr[:, :, 3] = np.where(glow, 0, alpha)
    return Image.fromarray(arr)


def drop_backdrop(image: Image.Image) -> Image.Image:
    """Drop workshop shelf/glow leftovers that sit outside the item's convex hull."""
    arr = np.array(image.convert("RGBA"))
    alpha = arr[:, :, 3]
    opaque = alpha > 16
    hsv = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2HSV)
    val, hue = hsv[:, :, 2], hsv[:, :, 0]
    core = opaque & ((val >= 115) | ((hue > 28) & (hue < 155)))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    keep = cv2.dilate(core.astype(np.uint8), kernel) > 0
    tentative = opaque & keep
    if int(tentative.sum()) < 80:
        return image
    ys, xs = np.where(tentative)
    hull = cv2.convexHull(np.column_stack((xs, ys)).astype(np.int32))
    hull_mask = np.zeros(alpha.shape, np.uint8)
    cv2.fillConvexPoly(hull_mask, hull, 1)
    arr[:, :, 3] = np.where(opaque & (hull_mask > 0), alpha, 0)
    return Image.fromarray(arr)


def cut_item(photo: Image.Image, session) -> Image.Image:
    crop = photo.crop(scaled_box(photo.size, ITEM_BOX)).convert("RGBA")
    cut = remove(crop, session=session)
    if not isinstance(cut, Image.Image):
        cut = Image.open(cut).convert("RGBA")
    else:
        cut = cut.convert("RGBA")
    cut = drop_red_glow(cut)
    cut = keep_large_components(cut)
    cut = drop_backdrop(cut)
    cut = trim_alpha(cut)
    return fit_max_edge(cut, ITEM_MAX_EDGE)


def inpaint_rgb(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    if not mask.any():
        return rgb
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    painted = cv2.inpaint(bgr, (mask.astype(np.uint8) * 255), 5, cv2.INPAINT_TELEA)
    return cv2.cvtColor(painted, cv2.COLOR_BGR2RGB)


def find_icon_circle(rgb: np.ndarray) -> tuple[float, float, float]:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    h, w = gray.shape
    circles = cv2.HoughCircles(
        blur,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min(w, h) / 2,
        param1=120,
        param2=28,
        minRadius=int(min(w, h) * 0.38),
        maxRadius=int(min(w, h) * 0.55),
    )
    cx, cy = (w - 1) / 2, (h - 1) / 2
    if circles is None:
        return cx, cy, min(w, h) * 0.46
    candidates = [c for c in circles[0] if (c[0] - cx) ** 2 + (c[1] - cy) ** 2 < (0.22 * min(w, h)) ** 2]
    if not candidates:
        candidates = list(circles[0])
    best = max(candidates, key=lambda c: float(c[2]))
    return float(best[0]), float(best[1]), float(best[2])


def _disk(h: int, w: int, x: float, y: float, r: float) -> np.ndarray:
    yy, xx = np.ogrid[:h, :w]
    return (xx - x) ** 2 + (yy - y) ** 2 <= r * r


def badge_and_level_mask(rgb: np.ndarray, cx: float, cy: float, radius: float) -> np.ndarray:
    """Cover the type badge (10:30 on the ring) and the level pip (bottom)."""
    h, w = rgb.shape[:2]
    badge_r = radius * 0.22
    mask = _disk(h, w, cx - radius * 0.88, cy - radius * 0.88, badge_r)
    mask |= _disk(h, w, cx, cy + radius, radius * 0.22)
    return mask


def circular_rgba(rgb: np.ndarray, cx: float, cy: float, radius: float) -> Image.Image:
    side = int(round(radius * 2))
    x1, y1 = int(round(cx - radius)), int(round(cy - radius))
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    h, w = rgb.shape[:2]
    src_x1, src_y1 = max(0, x1), max(0, y1)
    src_x2, src_y2 = min(w, x1 + side), min(h, y1 + side)
    dst_x1, dst_y1 = src_x1 - x1, src_y1 - y1
    patch = rgb[src_y1:src_y2, src_x1:src_x2]
    canvas[dst_y1 : dst_y1 + patch.shape[0], dst_x1 : dst_x1 + patch.shape[1], :3] = patch
    yy, xx = np.ogrid[:side, :side]
    cc = (side - 1) / 2
    dist = np.sqrt((xx - cc) ** 2 + (yy - cc) ** 2)
    # Soft edge so the circle matches the existing 141px icons.
    alpha = np.clip((cc + 0.5 - dist) * 255, 0, 255).astype(np.uint8)
    canvas[:, :, 3] = alpha
    return Image.fromarray(canvas)


def cut_icon(photo: Image.Image) -> Image.Image:
    crop = np.array(photo.crop(scaled_box(photo.size, ICON_BOX)).convert("RGB"))
    cx, cy, radius = find_icon_circle(crop)
    overlay = badge_and_level_mask(crop, cx, cy, radius)
    painted = inpaint_rgb(crop, overlay)
    inner = radius * 0.84
    icon = circular_rgba(painted, cx, cy, inner)
    return fit_max_edge(paint_inner_overlays(icon), ICON_MAX_EDGE)


def paint_inner_overlays(icon: Image.Image) -> Image.Image:
    """Remove any badge or level pip that still sits inside the inner circle."""
    arr = np.array(icon)
    h, w = arr.shape[:2]
    opaque = arr[:, :, 3] > 128
    mask = _disk(h, w, w * 0.06, h * 0.06, w * 0.22)
    mask &= opaque
    arr[:, :, :3] = inpaint_rgb(arr[:, :, :3], mask)
    return Image.fromarray(arr)


def process(ids: set[str] | None) -> None:
    session = new_session("birefnet-general")
    for item_id, hero in ITEMS:
        if ids and item_id not in ids:
            continue
        src = screenshot_for(hero)
        photo = Image.open(src)
        print(f"{item_id}: {src.name} {photo.size}")
        item = cut_item(photo, session)
        icon = cut_icon(photo)
        save_webp(item, OUT / f"{item_id}.webp")
        save_webp(icon, OUT / f"{item_id}-skill.webp")
        print(f"  item {item.size}  icon {icon.size}")


def refine_items(ids: set[str] | None) -> None:
    for item_id, _hero in ITEMS:
        if ids and item_id not in ids:
            continue
        path = OUT / f"{item_id}.webp"
        src = Image.open(path).convert("RGBA")
        cleaned = fit_max_edge(trim_alpha(drop_backdrop(src)), ITEM_MAX_EDGE)
        save_webp(cleaned, path)
        print(f"{item_id}: {src.size} -> {cleaned.size}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="item ids to process")
    parser.add_argument(
        "--refine-items",
        action="store_true",
        help="drop leftover backdrop from existing item WebPs without re-running rembg",
    )
    args = parser.parse_args()
    chosen = set(args.only) if args.only else None
    if args.refine_items:
        refine_items(chosen)
        return
    process(chosen)


if __name__ == "__main__":
    main()
