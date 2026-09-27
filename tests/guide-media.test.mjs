import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GUIDE_MEDIA_BUCKET,
  UPLOADED_PREFIX,
  guidePictureUrl,
  isUploadedPicture,
  pictureStamp,
  uploadedPath,
} from "../lib/content/guide-media.ts";
import { dataFits } from "../lib/content/guide-data.ts";
import { CRYPTIDES_DATA } from "../lib/content/cryptides.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("a committed picture keeps pointing at the build", () => {
  assert.equal(guidePictureUrl("cryptides", "nidhogg.webp"), "/cryptides/nidhogg.webp");
  assert.equal(guidePictureUrl("cryptides", "skills/nidhogg-1.webp"), "/cryptides/skills/nidhogg-1.webp");
  assert.equal(isUploadedPicture("nidhogg.webp"), false);
});

test("an uploaded picture points at the bucket", () => {
  const url = guidePictureUrl("cryptides", "up/cryptides/nidhogg-k3f9.webp");
  assert.ok(url.includes(`/storage/v1/object/public/${GUIDE_MEDIA_BUCKET}/`), url);
  assert.ok(url.endsWith("cryptides/nidhogg-k3f9.webp"), url);
  assert.equal(isUploadedPicture("up/cryptides/nidhogg-k3f9.webp"), true);
});

test("an upload keeps its place in the guide and gains a stamp", () => {
  const path = uploadedPath("cryptides", "skills/nidhogg-1.webp", "k3f9aa");
  assert.equal(path, "up/cryptides/skills/nidhogg-1-k3f9aa.webp");
  assert.equal(isUploadedPicture(path), true);
  // Replacing a picture must not leave readers on the old one out of a cache.
  assert.notEqual(uploadedPath("cryptides", "skills/nidhogg-1.webp", "aaaaaa"), path);
});

test("an upload path survives the payload check", () => {
  // The prefix has to fit the same narrow shape a committed path does,
  // otherwise an uploaded picture could never be published.
  const data = JSON.parse(JSON.stringify(CRYPTIDES_DATA));
  data.cryptides[0].image = uploadedPath("cryptides", "nidhogg.webp", pictureStamp(0));
  data.cryptides[0].skills[0].image = uploadedPath("cryptides", "skills/nidhogg-1.webp", "zzz999");
  assert.equal(dataFits("cryptides", data), true);
});

test("no committed picture pretends to be an upload", () => {
  // The whole distinction rests on this prefix being free, so nothing in the
  // repository may start with it.
  const folders = ["cryptides", "collection", "heroes", "trade"];
  for (const folder of folders) {
    let entries;
    try {
      entries = readdirSync(join(root, "public", folder));
    } catch {
      continue;
    }
    assert.equal(entries.includes(UPLOADED_PREFIX.replace("/", "")), false, `public/${folder} has an up/ folder`);
  }
  for (const cryptide of CRYPTIDES_DATA.cryptides) {
    const pictures = [cryptide.image, ...cryptide.skills.map((s) => s.image), ...cryptide.foods.map((f) => f.image)];
    for (const picture of pictures) {
      assert.equal(isUploadedPicture(picture), false, picture);
    }
  }
});

test("a stamp is short, lowercase and moves with time", () => {
  const early = pictureStamp(1_000_000_000_000);
  const later = pictureStamp(1_000_000_060_000);
  assert.match(early, /^[a-z0-9]{1,6}$/);
  assert.notEqual(early, later);
});
