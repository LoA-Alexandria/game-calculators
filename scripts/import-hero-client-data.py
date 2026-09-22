"""Import Desktop/Heroes daten.txt into lib/data/heroes.json and German heroTexts.

After this script, run `node --experimental-strip-types scripts/apply-hero-client-texts.mjs`
to rewrite heroes.json in the editor export format and paste heroTexts into de.ts.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path

ROOT = Path(r"C:\Users\futor\Desktop\Heroes")
REPO = Path(r"C:\Users\futor\Desktop\PopEpoch")
ROSTER_PATH = REPO / "lib" / "data" / "heroes.json"
DE_TEXTS_PATH = REPO / "lib" / "data" / "hero-texts-de.json"

from parse_hero_daten import FOLDER_TO_ID  # type: ignore

# New roster rows (no portrait yet). Billy stays out: only skin cards, and the
# editor test still creates a throwaway "Billy the Kid".
NEW_HEROES = [
    {
        "id": "alexander-the-great",
        "name": "Alexander the Great",
        "rarity": "UR",
        "obtain": "",
        "images": [],
        "after": "richard-i",
    },
    {
        "id": "augustus",
        "name": "Augustus",
        "rarity": "UR",
        "obtain": "",
        "images": [],
        "after": "alexander-the-great",
    },
]

SKIP_IDS = {"joan-of-arc", "billy-the-kid"}

NAME_EN = {
    "skill": {
        "achilles": "War God's Wrath",
        "alexander-the-great": "General Assault",
        "alfred-the-great": "Last Stand",
        "augustus": "I Am the Order",
        "bjorn-ironside": "Straight Punch",
        "blackbeard": "Blackwater Dynamite",
        "caesar": "Cracked Sky Dawn",
        "circe": "Animal Companion",
        "da-vinci": "Mechanical Age",
        "dante": "Dance of Sin",
        "eleanor-of-aquitaine": "Court Hymn",
        "galileo-galilei": "Heliocentric Collapse",
        "garwain": "Sun at Zenith",
        "gilgamesh": "Ox-Headed Axe",
        "guinevere": "Winds of Camelot",
        "hammurabi": "Divine Judgment",
        "hector": "Chariot Charge",
        "heracles": "Atlas Strength",
        "hermes": "Clinical Finish",
        "isaac-newton": "Proof of Gravity",
        "charles-the-great": "Divine Crown",
        "cleopatra": "Majesty of the Royal Tomb",
        "confucius": "Confucian Principles",
        "king-arthur": "Excalibur",
        "queen-victoria": "Tea Party",
        "lagertha": "Arctic Charge",
        "lancelot": "Rose Whirlwind",
        "merlin": "Ice Dragon's Breath",
        "napoleon-bonaparte": "Imperial Firepower",
        "odysseus": "Leviathan's Might",
        "pompey": "Master of Three Seas",
        "ragnar-lodbrok": "Viking Raid",
        "richard-i": "Glory's Counter",
        "socrates": "Endless Inquiry",
        "spartacus": "Oath of the Broken Chain",
        "tutankhamun": "Cursed Echo",
        "william-shakespeare": "Bittersweet Symphony",
    },
    "buff": {
        "achilles": "Strength of Hercules",
        "alexander-the-great": "Destiny Expansion",
        "alfred-the-great": "Oath of Restoration",
        "augustus": "First Citizen",
        "bjorn-ironside": "Iron Fist",
        "blackbeard": "Marauder",
        "caesar": "Conqueror's Will",
        "circe": "Island Witch",
        "da-vinci": "Artistic Genius",
        "dante": "Dante's Dream",
        "eleanor-of-aquitaine": "Echoes of the Dual Crown",
        "galileo-galilei": "Laws of the Stars",
        "garwain": "Power of the Sun",
        "gilgamesh": "Castle of Heaven",
        "guinevere": "Queen's Anointing",
        "hammurabi": "Code of Laws",
        "hector": "Shield of Troy",
        "heracles": "Demigod's Might",
        "hermes": "Divine Power",
        "isaac-newton": "Laws of Mechanics",
        "charles-the-great": "Legacy of Antiquity",
        "cleopatra": "Serpent's Kiss",
        "confucius": "Words of the Benevolent",
        "king-arthur": "Knight King",
        "queen-victoria": "Sun Empire Policy",
        "lagertha": "Arctic Hunter",
        "lancelot": "Thorn Bloom",
        "merlin": "Starstone Sage",
        "napoleon-bonaparte": "Military Supply Directive",
        "odysseus": "Talent of Guile",
        "pompey": "Uncrowned One",
        "ragnar-lodbrok": "Valhalla Summon",
        "richard-i": "Oath of Iron and Blood",
        "socrates": "Philosophical Research",
        "spartacus": "Warrior's Awakening",
        "tutankhamun": "Soul Stone",
        "william-shakespeare": "Script Expert",
    },
    "production": {
        "achilles": "Breeding Mastery",
        "alexander-the-great": "Iron Mastery",
        "alfred-the-great": "Breeding Mastery",
        "augustus": "Masonry Mastery",
        "bjorn-ironside": "Coal Mastery",
        "blackbeard": "Firearm Mastery",
        "caesar": "Papermaking Mastery",
        "circe": "Universal Mastery",
        "da-vinci": "Craft Mastery",
        "dante": "Papermaking Mastery",
        "eleanor-of-aquitaine": "Lumber Mastery",
        "galileo-galilei": "Glass Mastery",
        "garwain": "Leather Mastery",
        "gilgamesh": "Copper Mastery",
        "guinevere": "Papermaking Mastery",
        "hammurabi": "Farm Mastery",
        "hector": "Breeding Mastery",
        "heracles": "Coal Mastery",
        "hermes": "Universal Mastery",
        "isaac-newton": "Steelmaking Mastery",
        "charles-the-great": "Farm Mastery",
        "cleopatra": "Universal Mastery",
        "confucius": "Textile Mastery",
        "king-arthur": "Glass Mastery",
        "queen-victoria": "Coal Mastery",
        "lagertha": "Plantation Mastery",
        "lancelot": "Iron Mastery",
        "merlin": "Universal Mastery",
        "napoleon-bonaparte": "Steelmaking Mastery",
        "odysseus": "Plantation Mastery",
        "pompey": "Creation Mastery",
        "ragnar-lodbrok": "Brewing Mastery",
        "richard-i": "Brewing Mastery",
        "socrates": "Brewing Mastery",
        "spartacus": "Leather Mastery",
        "tutankhamun": "Lumber Mastery",
        "william-shakespeare": "Papermaking Mastery",
    },
}

# Placeholders match daten.txt keys (X, C, K, …). Keep “Shield Break” for Merlin.
SKILL_EN = {
    "achilles": "40% chance to activate: mighty Achilles deals {X}% ATK damage, with a {C}% chance to trigger a [Critical Hit] (+{K}% DMG) on this attack.",
    "alexander-the-great": "40% chance to activate: Alexander leads the cavalry in an assault, dealing skill damage equal to {X}% of ATK, with a 50% chance to trigger [Pursuit] (an extra skill cast) dealing extra damage equal to {X}% of ATK.",
    "alfred-the-great": "30% chance to activate: Alfred the Great counters in desperation, dealing {X}% ATK damage, with a {C}% chance to inflict [Rend] on the enemy (DoT equal to {D}% of allied ATK).",
    "augustus": "40% chance to activate: Augustus looks down on all and deals {X}% ATK damage. If this skill is cast in the first 5 turns, it also deals {A}% ATK damage; otherwise it deals extra damage equal to {B}% of ATK instead.",
    "bjorn-ironside": "40% chance to activate: Bjorn targets the enemy's weak point and strikes, dealing skill damage equal to {X}% of ATK. Increases allied Crit DMG by {T}% for 3 turns. This attack has a 50% chance to trigger [Critical Hit], increasing this instance of damage by {K}%. If the target has a shield, this attack is guaranteed to trigger [Critical Hit].",
    "blackbeard": "40% chance to activate: Blackbeard throws explosives in a near-suicidal attack, dealing skill damage equal to {X}% of ATK.",
    "caesar": "40% chance to activate: Caesar brings the dawn of Rome, dealing skill damage equal to {X}% of ATK. This action has a 100% chance to trigger [Pursuit] (an extra skill cast) dealing extra damage equal to {Y}% of ATK. [Pursuit] can repeat, with the trigger chance reduced by 40% each time.",
    "circe": "40% chance to activate: Circe commands her animal companion to attack, dealing skill damage equal to {X}% of ATK and applying [Curse Kill] to enemies. While this state lasts, if the target's HP falls below {T}% after taking damage, they die instantly; revival, death immunity, and similar effects cannot trigger.",
    "da-vinci": "40% chance to activate: Da Vinci unleashes a superior mechanical weapon, dealing {X}% ATK damage, granting all allies a shield equal to {S}% of their max HP, and increasing their skill damage bonus by {S}% for 3 turns.",
    "dante": "30% chance to activate: Dante summons a demon from hell, dealing skill damage equal to {X}% of ATK, with a chance to apply [Divine Comedy].",
    "eleanor-of-aquitaine": "30% chance to activate: Eleanor sings a sacred court hymn, dealing {X}% ATK damage and healing allies.",
    "galileo-galilei": "30% chance to activate: Galileo causes cosmic chaos, dealing {X}% ATK damage and increasing allies' extra damage by {E}% for 3 turns, with a 50% chance of a follow-up effect.",
    "garwain": "40% chance to activate: Gawain uses the power of the midday sun, dealing skill damage equal to {X}% of ATK.",
    "gilgamesh": "30% chance to activate: Gilgamesh swings the blade that once beheaded the Bull of Heaven, dealing skill damage equal to {X}% of ATK.",
    "guinevere": "40% chance to activate: Guinevere revels in Camelot's restless storm, dealing skill damage equal to {X}% of ATK.",
    "hammurabi": "30% chance to activate: Hammurabi delivers judgment according to the code, dealing skill damage equal to {X}% of ATK.",
    "hector": "30% chance to activate: Hector attacks with the Trojan chariot, dealing {X}% ATK damage, with a {C}% chance to apply [Burn] to the enemy (DoT equal to {D}% of allied ATK).",
    "heracles": "40% chance to activate: Heracles exerts his full strength for a desperate strike, dealing skill damage equal to {X}% of ATK. Removes 1 buff from the enemies. If allies have more buffs than enemies, deals 1 extra damage equal to {Y}% of ATK.",
    "hermes": "40% chance to activate: Hermes lands a precise kick, dealing skill damage equal to {X}% of ATK, and applies [Sprint] to allies for 3 turns. While active, allies have a {D}% chance to dodge enemy skills; targeted skill damage and effects do not trigger.",
    "isaac-newton": "40% chance to activate: the apple that struck Newton appears again, dealing skill damage equal to {X}% of ATK.",
    "charles-the-great": "40% chance to activate: Charles the Great proclaims his divine right, dealing {X}% ATK damage and reducing the enemy's skill damage bonus by {R}% for 2 turns.",
    "cleopatra": "40% chance to activate: Cleopatra proclaims the inviolable majesty of the royal tomb, dealing damage equal to {X}% of ATK, and replaces the enemy's next action with 1 allied Normal Attack against them that deals {N}% of Normal Attack damage.",
    "confucius": "30% chance to activate: deals {X}% ATK damage and applies [Regeneration] to allies.",
    "king-arthur": "40% chance to activate: King Arthur raises the sword of victory and prioritises skill activation, dealing {X}% ATK damage and shielding allies with the scabbard, increasing their skill damage reduction by {R}% for 3 turns. The enemy is struck by the king's sword and enters [Rend], taking DoT equal to {D}% of allied ATK for 3 turns before acting.",
    "queen-victoria": "40% chance to activate: Queen Victoria hosts an afternoon of dessert tasting, dealing skill damage equal to {X}% of ATK.",
    "lagertha": "40% chance to activate: Lagertha orders her companions to charge the enemy, dealing skill damage equal to {X}% of ATK. This action has a {C}% chance to trigger a [Critical Hit] (+50% DMG). At the end of this action, allies recover HP equal to {H}% of the damage dealt.",
    "lancelot": "40% chance to activate: Lancelot's sword wind whirls rose petals, dealing skill damage equal to {X}% of ATK. The target enters [Haemorrhage]. Before acting, they take DoT equal to {D}% of allied ATK for 3 turns. For each debuff on the target, 1 extra stack of [Haemorrhage] is applied (same {D}% DoT over 3 turns), up to 3 extra stacks.",
    "merlin": "40% chance to activate: Merlin's dragon companion exhales a freezing breath, dealing skill damage equal to {X}% of ATK and applying [Shield Break] to allies ({S}% of skill damage and extra damage dealt by allies ignores the target's shield for 3 turns). If the enemy has a shield, deals 1 instance of extra damage equal to {Y}% of ATK.",
    "napoleon-bonaparte": "40% chance to activate: Napoleon's artillery unleashes full firepower, dealing skill damage equal to {X}% of ATK.",
    "odysseus": "40% chance to activate: Odysseus turns the sea monster's blow onto the enemy, dealing skill damage equal to {X}% of ATK. The enemy gains [Rend] (DoT equal to {D}% of your ATK for 3 turns before they act). For the next 3 turns, allies are healed at the end of their action for {H}% of all DoT taken by enemies.",
    "pompey": "40% chance to activate: Pompey slams down his sceptre and issues a command, dealing skill damage equal to {X}% of ATK, healing allies for {H}% of damage dealt, with a {B}% chance to apply [Barrier] (immune to all damage for 1 turn).",
    "ragnar-lodbrok": "40% chance to activate: Ragnar leads a Viking raid, dealing skill damage equal to {X}% of ATK, reducing enemies' skill damage bonus by {R}% for 2 turns, with a chance to apply [Plunder] (for 3 turns, any buff the target gains transfers to allies while keeping its status).",
    "richard-i": "40% chance to activate: Richard I launches an honourable counterattack, dealing {X}% ATK damage and increasing the enemy's DoT damage by {R}% for 3 turns.",
    "socrates": "30% chance to activate: poses an unanswerable question to the enemy, dealing {X}% ATK damage.",
    "spartacus": "40% chance to activate: Spartacus shatters the chains that bind freedom, dealing skill damage equal to {X}% of ATK, with a {C}% chance to trigger [Critical Hit] (+{K}% DMG) on this attack. If [Critical Hit] triggers, there is a {H}% chance to apply [Heal Block] to enemies.",
    "tutankhamun": "40% chance to activate: Tutankhamun's curse begins to echo, dealing {X}% ATK damage, with a {C}% chance to trigger a [Critical Hit] (+50% DMG) on this attack.",
    "william-shakespeare": "40% chance to activate: Shakespeare throws his manuscript, dealing {X}% ATK damage. With a 50% chance [Survive] triggers and restores {H}% of max HP.",
}

BUFF_EN = {
    "achilles": "Damage dealt in Mystic Tower {Z}%.",
    "alexander-the-great": "Land gained in Campaign {Z}%.",
    "alfred-the-great": "Damage dealt in Mystic Tower {Z}%.",
    "augustus": "Allied damage increase in Enemy from the North {Z}%.",
    "bjorn-ironside": "Damage dealt by allies in Duel Festival battles {Z}%.",
    "blackbeard": "Army strength {Z}% in Guild Expedition.",
    "caesar": "In Dawn of Rome and Crown of the Nile: soldier cap {Z}%.",
    "circe": "In Deep into Atlantis, allied ATK {Z}%.",
    "da-vinci": "Gold coin sales at the Bazaar {Z}%.",
    "dante": "Gold coins from maritime trade {Z}%.",
    "eleanor-of-aquitaine": "Continue receiving resources for {T} seconds after logging off.",
    "galileo-galilei": "Technology research resource cost {Z}%.",
    "garwain": "Combat power on the Grail Journey {Z}%.",
    "gilgamesh": "Troop recruitment cost {Z}%.",
    "guinevere": "King Arthur HP {Z}%.",
    "hammurabi": "Building upgrade cost {Z}%.",
    "hector": "Damage taken in Mystic Tower {Z}%.",
    "heracles": "Deep into Atlantis: allied damage {Z}%.",
    "hermes": "All allied attributes {Z}% in Road to the Cup.",
    "isaac-newton": "Eggs in the Life Chamber {Z}%.",
    "charles-the-great": "Allied damage increase in Rise of Knights {Z}%.",
    "cleopatra": "In Dawn of Rome and Crown of the Nile: soldier cap {Z}%.",
    "confucius": "Combat power in the Museion {Z}%.",
    "king-arthur": "All heroes' damage increase {Z}%.",
    "queen-victoria": "Stamina recovery time in maritime trade {Z}%.",
    "lagertha": "All heroes' damage reduction {Z}%.",
    "lancelot": "King Arthur ATK {Z}%.",
    "merlin": "Allied damage reduction {Z}% in Duel Festival battles.",
    "napoleon-bonaparte": "Supply points in Supply Reform {Z}%.",
    "odysseus": "Gain {Z}% points in Deep into Atlantis.",
    "pompey": "All Heroes Damage Reduction {Z}%.",
    "ragnar-lodbrok": "Damage dealt by allies in Trials of Odin {Z}%.",
    "richard-i": "Allied damage reduction in Rise of Knights {Z}%.",
    "socrates": "Productivity of all resource buildings {Z}%.",
    "spartacus": "In Imperial Invasion, skill damage bonus {Z}%.",
    "tutankhamun": "Glory wealth in Crown Glory {Z}%.",
    "william-shakespeare": "Technology research time {Z}%.",
}

BUILDING_EN = {
    "Glaswerkstatt": "Glass Workshop",
    "Weide": "Pasture",
    "Schmiede": "Forge",
    "Steinmetzwerkstatt": "Masonry Workshop",
    "Kohlenfabrik": "Coal Plant",
    "Feuerwaffenwerkstatt": "Firearm Workshop",
    "Papiermühle": "Paper Mill",
    "Papiermuehle": "Paper Mill",
    "Kunstwerkstatt": "Art Workshop",
    "Plantage": "Plantation",
    "Gerberei": "Tannery",
    "Bauernhof": "Farm",
    "Stahlwerk": "Steel Plant",
    "Brauerei": "Brewery",
    "Sägewerk": "Lumber Mill",
    "Saegewerk": "Lumber Mill",
    "Kupfermine": "Copper Mine",
    "Weberei": "Weavery",
}

ST_LINE = re.compile(
    r"^St\.(\d{1,2})\s+(?:(\d+)\s+Sterne\s+)?([+\-][0-9.]+%|T=\d+s|[A-Za-zÄÖÜäöü]+=.+)$"
)
KV = re.compile(r"([A-Za-zÄÖÜäöü]+)=([0-9.]+s?)")
PCT = re.compile(r"^([+\-][0-9.]+)%$")
OVERLAY = re.compile(
    r"\s*\((?:voller Text(?: im)? Overlay|Overlay) [^)]+\)",
    re.I,
)
NOTEISH = re.compile(r"abfotografiert|berechnet|SSR:|analog|Luecken|Lücken|Zahlen wie", re.I)


def parse_levels(path: Path) -> dict:
    """Re-parse with stricter St.N lines (skip St.1-5 notes; allow -Z% and T=)."""
    parsed = parse_file(path)
    text = path.read_text(encoding="utf-8")
    # Rebuild abilities from the file with the stricter line matcher.
    from parse_hero_daten import HEADING

    lines = [ln.rstrip() for ln in text.splitlines()]
    abilities = []
    i = 0
    while i < len(lines):
        m = HEADING.match(lines[i])
        if not m:
            i += 1
            continue
        kind, variant, name = m.group(1).lower(), (m.group(2) or "normal").lower(), m.group(3).strip()
        if kind == "produktion":
            kind = "production"
        i += 1
        body = []
        while i < len(lines) and not HEADING.match(lines[i]) and not ST_LINE.match(lines[i]):
            if lines[i] and not NOTEISH.search(lines[i]):
                body.append(OVERLAY.sub("", lines[i]).strip())
            elif lines[i] and NOTEISH.search(lines[i]) and not ST_LINE.match(lines[i]):
                pass
            i += 1
        levels = []
        while i < len(lines) and ST_LINE.match(lines[i]):
            line = lines[i]
            st = ST_LINE.match(line)
            assert st
            rest = st.group(3)
            vars_: dict[str, str] = {}
            pct = PCT.match(rest.strip())
            if pct:
                vars_["Z"] = pct.group(1)
            else:
                vars_ = {k: v for k, v in KV.findall(rest)}
            levels.append({"level": int(st.group(1)), "stars": int(st.group(2)) if st.group(2) else None, "vars": vars_})
            i += 1
        abilities.append({"kind": kind, "variant": variant, "name": name, "body": [b for b in body if b], "levels": levels})
    parsed["abilities"] = abilities
    return parsed


def pick_ability(abilities: list[dict], kind: str) -> dict | None:
    normal = next((a for a in abilities if a["kind"] == kind and a["variant"] == "normal"), None)
    return normal


def fill_template(template: str, vars_: dict[str, str]) -> str:
    text = template
    for key, value in sorted(vars_.items(), key=lambda kv: -len(kv[0])):
        if key == "Z" and (value.startswith("+") or value.startswith("-")):
            text = text.replace("{Z}%", f"{value}%").replace("{Z}", value)
            continue
        text = text.replace(f"{{{key}}}", value)
    return text


def star_prefix(stars: int | None, lang: str) -> str:
    if not stars:
        return ""
    if lang == "en":
        return f"Activates at {stars}-Star. "
    return f"Aktiviert bei {stars} Sternen. "


def signed_pct(z: str) -> str:
    if z.startswith("+") or z.startswith("-"):
        return f"{z}%"
    return f"+{z}%"


def production_en(body: list[str], z: str) -> str:
    blob = " ".join(body)
    pct = signed_pct(z)
    if "beliebigen" in blob:
        return f"Assign to any building for Resource Productivity {pct}."
    for de, en in BUILDING_EN.items():
        if de in blob:
            return f"Assign to the {en} for Resource Productivity {pct}."
    return f"Resource Productivity {pct}."


def production_de(body: list[str], z: str) -> str:
    blob = " ".join(body)
    pct = signed_pct(z)
    if "um Z%" in blob:
        blob = blob.replace("Z%", f"{z.lstrip('+-')}%")
    else:
        blob = blob.replace("+Z%", pct).replace("-Z%", pct).replace("Z%", pct)
    return blob.rstrip(".") + "."


def skill_de(body: list[str], vars_: dict[str, str]) -> str:
    blob = " ".join(body)
    blob = re.sub(r"^Grundtext:\s*", "", blob)
    blob = OVERLAY.sub("", blob)
    for key, value in sorted(vars_.items(), key=lambda kv: -len(kv[0])):
        blob = re.sub(rf"\b{re.escape(key)}%", f"{value}%", blob)
    return re.sub(r"\s+", " ", blob).strip().rstrip(".") + "."


def buff_de(body: list[str], vars_: dict[str, str]) -> str:
    blob = " ".join(body)
    if "T" in vars_ and "T" in blob:
        return blob.replace("T Sek.", f"{vars_['T']} Sek.").replace("T Sek", f"{vars_['T']} Sek")
    z = vars_.get("Z", "")
    if "Z%" in blob:
        if z.startswith("+") or z.startswith("-"):
            return blob.replace("+Z%", f"{z}%").replace("-Z%", f"{z}%").replace("Z%", f"{z}%")
        return blob.replace("Z%", f"{z}%")
    return blob


def levels_of(ability: dict) -> list[dict]:
    return [lv for lv in ability["levels"] if 1 <= lv["level"] <= 25]


def build_ability(hid: str, kind: str, ability: dict) -> tuple[dict, dict]:
    """Return (english ability, german text)."""
    rows = levels_of(ability)
    en_levels = []
    de_levels = []
    name_en = NAME_EN[kind][hid]
    name_de = ability["name"]
    for lv in rows:
        stars = lv["stars"]
        vars_ = dict(lv["vars"])
        if kind == "skill":
            en = fill_template(SKILL_EN[hid], vars_)
            de = skill_de(ability["body"], vars_)
        elif kind == "buff":
            en = fill_template(BUFF_EN[hid], vars_)
            de = buff_de(ability["body"], vars_)
        else:
            z = vars_.get("Z", "")
            en = production_en(ability["body"], z)
            de = production_de(ability["body"], z)
        en_levels.append(star_prefix(stars, "en") + en)
        de_levels.append(star_prefix(stars, "de") + de)
    return {"name": name_en, "levels": en_levels}, {"name": name_de, "levels": de_levels}


def insert_after(heroes: list[dict], after_id: str, row: dict) -> None:
    idx = next(i for i, h in enumerate(heroes) if h["id"] == after_id)
    heroes.insert(idx + 1, row)


def main() -> None:
    roster = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    by_id = {h["id"]: h for h in roster["heroes"]}
    de_texts: dict = {}

    parsed_by_id = {}
    for folder, hid in FOLDER_TO_ID.items():
        path = ROOT / folder / "daten.txt"
        if not path.exists():
            continue
        parsed_by_id[hid] = parse_levels(path)

    for spec in NEW_HEROES:
        if spec["id"] not in by_id:
            row = {k: spec[k] for k in ("id", "name", "rarity", "obtain", "images")}
            insert_after(roster["heroes"], spec["after"], row)
            by_id[spec["id"]] = row
            print("added", spec["id"])

    for hid, parsed in parsed_by_id.items():
        if hid in SKIP_IDS:
            continue
        if hid not in by_id:
            print("skip unknown", hid)
            continue
        hero = by_id[hid]
        de_entry: dict = {}
        for kind in ("skill", "buff", "production"):
            ability = pick_ability(parsed["abilities"], kind)
            if not ability or not levels_of(ability):
                print("no", kind, hid)
                continue
            en, de = build_ability(hid, kind, ability)
            hero[kind] = en
            de_entry[kind] = de
        if de_entry:
            de_texts[hid] = de_entry
        print("updated", hid, {k: len(hero[k]["levels"]) for k in ("skill", "buff", "production") if k in hero})

    ROSTER_PATH.write_text(json.dumps(roster, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    DE_TEXTS_PATH.write_text(json.dumps(de_texts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("wrote", ROSTER_PATH)
    print("wrote", DE_TEXTS_PATH, "heroes", len(de_texts))


if __name__ == "__main__":
    main()
