import { collectionImageUrl, collectionItemById } from "../../lib/content/collection";

/**
 * The round Collection badge, the counterpart of {@link HeroAvatar}: the
 * item's cut-out from the Collection guide, or the diamond that used to stand
 * for every item when the guides were not linked up. Decorative, because the
 * item's name always sits next to it.
 */
export function CollectionAvatar({ id, className = "pick-avatar" }: { id: string; className?: string }) {
  const item = collectionItemById(id);
  if (!item) {
    return (
      <span className={className} aria-hidden="true">
        ◆
      </span>
    );
  }
  return (
    <span className={`${className} has-portrait is-collection`} data-rarity={item.rarity} aria-hidden="true">
      {/* A static export cannot run next/image optimisation; the files are already small WebP. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={collectionImageUrl(item.image)} alt="" width={120} height={120} loading="lazy" decoding="async" />
    </span>
  );
}
