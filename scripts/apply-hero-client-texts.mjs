import { readFileSync, writeFileSync } from "node:fs";

import { fromHeroData, heroTextBlocks, serializeHeroData } from "../lib/content/hero-editor.ts";
import { HERO_DATA } from "../lib/content/heroes.ts";

const rosterPath = new URL("../lib/data/heroes.json", import.meta.url);
const deTextsPath = new URL("../lib/data/hero-texts-de.json", import.meta.url);
const deDictPath = new URL("../lib/i18n/dictionaries/de.ts", import.meta.url);

writeFileSync(rosterPath, serializeHeroData(HERO_DATA));
console.log("serialized", HERO_DATA.heroes.length, "heroes");

const deCatalog = JSON.parse(readFileSync(deTextsPath, "utf8"));
const block = heroTextBlocks(fromHeroData(HERO_DATA, { de: deCatalog })).de;
const empty = "      heroTexts: {},";
const src = readFileSync(deDictPath, "utf8");
const at = src.indexOf(empty);
if (at < 0) throw new Error("de.ts no longer has an empty heroTexts block to replace");
writeFileSync(deDictPath, `${src.slice(0, at)}${block}${src.slice(at + empty.length)}`);
console.log("wrote German heroTexts for", Object.keys(deCatalog).length, "heroes");
