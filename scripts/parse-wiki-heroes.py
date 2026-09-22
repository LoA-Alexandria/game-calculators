"""Parse Pop Epoch Wiki Hero page wikitext into structured JSON."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CARD_RE = re.compile(
    r'id="(hero-[^"]+)"[\s\S]*?'
    r"\[\[File:(Hero \d+\.png)\|200px\|link=\|alt=([^\]]+)\]\][\s\S]*?"
    r'pe-hero-card__name">([^<]+)</div>\s*'
    r'<div class="pe-hero-card__title">([^<]*)</div>[\s\S]*?'
    r"'''Troop Type:'''\s*([^<]+)</li>\s*"
    r"<li>'''Age:'''\s*([^<]+)</li>[\s\S]*?"
    r'pe-hero-card__bio">([\s\S]*?)</p>',
)


def parse(wikitext: str) -> list[dict]:
    cards: list[dict] = []
    for match in CARD_RE.finditer(wikitext):
        wiki_id, file_name, alt, name, title, troop, age, bio = match.groups()
        cards.append(
            {
                "wikiId": wiki_id,
                "file": file_name,
                "alt": alt.strip(),
                "name": name.strip(),
                "title": title.strip(),
                "troop": troop.strip(),
                "age": age.strip(),
                "bio": re.sub(r"\s+", " ", bio).strip(),
            }
        )
    return cards


def main() -> None:
    src = Path(sys.argv[1])
    data = json.loads(src.read_text(encoding="utf-8"))
    wt = data["parse"]["wikitext"]["*"]
    cards = parse(wt)
    print(f"parsed {len(cards)} heroes from {src.name}", file=sys.stderr)
    for card in cards[:2]:
        print(
            f"  {card['wikiId']}: {card['name']} / {card['title']} / {card['troop']} / {card['age']}",
            file=sys.stderr,
        )
        print(f"    {card['bio'][:100]}…", file=sys.stderr)
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("-")
    text = json.dumps(cards, ensure_ascii=False, indent=2)
    if str(out) == "-":
        print(text)
    else:
        out.write_text(text + "\n", encoding="utf-8")
        print(f"wrote {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
