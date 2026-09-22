"use client";

import Link from "next/link";
import type { HeroRarity } from "../../lib/content/heroes";
import { localizedSkin, skinsInGroup, type SkinRecord, type SkinTexts } from "../../lib/content/skins";
import { HeroPortrait } from "../components/HeroPortrait";
import { ObtainMark } from "./ObtainMark";

type GroupCopy = { title: string; lede: string };

type OwnerLink = {
  name: string;
  href: string | null;
  rarity?: HeroRarity;
  src: string | null;
};

/**
 * Named skins grouped the way Autumn listed them. Owner portraits resolve
 * through the roster; a name with no portrait still shows, so a skin can be
 * listed before its owner has a picture.
 */
export function SkinCatalog({
  skins,
  groups,
  groupOrder,
  texts,
  colName,
  colSkin,
  colObtain,
  missableLabel,
  unconfirmedLabel,
  ownerOf,
}: {
  skins: readonly SkinRecord[];
  groups: Record<string, GroupCopy>;
  groupOrder: readonly string[];
  texts: SkinTexts;
  colName: string;
  colSkin: string;
  colObtain: string;
  missableLabel: string;
  unconfirmedLabel: string;
  ownerOf: (name: string) => OwnerLink;
}) {
  return (
    <div className="skin-catalog">
      {groupOrder.map((group) => {
        const rows = skinsInGroup(skins, group);
        const copy = groups[group];
        if (rows.length === 0 || !copy) return null;
        return (
          <section className="skin-group" key={group} aria-label={copy.title}>
            <h3>{copy.title}</h3>
            {copy.lede ? <p className="guide-lede">{copy.lede}</p> : null}
            <div className="table-scroll panel guide-table-panel">
              <table className="data-table data-table-wide">
                <thead>
                  <tr>
                    <th>{colName}</th>
                    <th>{colSkin}</th>
                    <th>{colObtain}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const skin = localizedSkin(row, texts);
                    const owner = ownerOf(skin.owner);
                    const name = (
                      <span className="guide-name">
                        <HeroPortrait name={skin.owner} rarity={owner.rarity} src={owner.src} className="hero-portrait-small" />
                        {skin.owner}
                      </span>
                    );
                    return (
                      <tr key={skin.id}>
                        <td data-label={colName}>
                          {owner.href ? <Link href={owner.href}>{name}</Link> : name}
                        </td>
                        <td data-label={colSkin}>
                          <span className="skin-name-cell">
                            <strong>{skin.name}</strong>
                            <ObtainMark
                              missable={skin.missable}
                              unconfirmed={skin.unconfirmed}
                              missableLabel={missableLabel}
                              unconfirmedLabel={unconfirmedLabel}
                            />
                          </span>
                        </td>
                        <td data-label={colObtain}>{skin.obtain}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SkinLines({
  skins,
  texts,
  missableLabel,
  unconfirmedLabel,
}: {
  skins: readonly SkinRecord[];
  texts: SkinTexts;
  missableLabel: string;
  unconfirmedLabel: string;
}) {
  if (skins.length === 0) return null;
  return (
    <ul className="skin-lines">
      {skins.map((row) => {
        const skin = localizedSkin(row, texts);
        return (
          <li key={skin.id}>
            <span className="skin-name-cell">
              <strong>{skin.name}</strong>
              <ObtainMark
                missable={skin.missable}
                unconfirmed={skin.unconfirmed}
                missableLabel={missableLabel}
                unconfirmedLabel={unconfirmedLabel}
              />
            </span>
            <span>{skin.obtain}</span>
          </li>
        );
      })}
    </ul>
  );
}
