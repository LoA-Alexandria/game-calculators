import assert from "node:assert/strict";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import {
  navCrumbs,
  normalizePath,
  pathIsCurrentOrNested,
  pathIsExact,
} from "../lib/content/nav-shell.ts";

test("normalizePath treats a trailing slash as the same place", () => {
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("/guides/artwork/"), "/guides/artwork");
  assert.equal(normalizePath("/guides/artwork"), "/guides/artwork");
});

test("pathIsExact ignores trailing slashes and rejects neighbours", () => {
  assert.equal(pathIsExact("/guides/artwork/", "/guides/artwork/"), true);
  assert.equal(pathIsExact("/guides/artwork", "/guides/artwork/"), true);
  assert.equal(pathIsExact("/guides/artwork/edit/", "/guides/artwork/"), false);
  assert.equal(pathIsExact(null, "/guides/"), false);
});

test("pathIsCurrentOrNested matches nested pages without swallowing neighbours", () => {
  assert.equal(pathIsCurrentOrNested("/guides/artwork/edit/", "/guides/artwork/"), true);
  assert.equal(pathIsCurrentOrNested("/guides/artwork/", "/guides/artwork/"), true);
  assert.equal(pathIsCurrentOrNested("/guides/artwork-layouts/", "/guides/artwork/"), false);
  assert.equal(pathIsCurrentOrNested("/guides/heroes/", "/"), false);
  assert.equal(pathIsCurrentOrNested("/guides/artwork/", "/guides/"), true);
});

test("nav crumbs name the published page under a nested editor URL", () => {
  const artworkEdit = navCrumbs("/guides/artwork/edit/", en);
  assert.deepEqual(
    artworkEdit.map((crumb) => ({ href: crumb.href, label: crumb.label, current: crumb.current })),
    [
      { href: "/", label: "Overview", current: undefined },
      { href: "/guides/", label: "Guides", current: undefined },
      { href: "/guides/artwork/", label: en.guideEntries.artwork.title, current: true },
    ],
  );

  const home = navCrumbs("/", en);
  assert.equal(home.length, 1);
  assert.equal(home[0].current, true);

  const create = navCrumbs("/guides/new/", en);
  assert.equal(create.at(-1)?.label, "New guide");
  assert.equal(create.at(-1)?.current, true);
  assert.equal(create[1]?.href, "/guides/");

  const mail = navCrumbs("/post/", en);
  assert.deepEqual(
    mail.map((crumb) => ({ href: crumb.href, label: crumb.label, current: crumb.current })),
    [
      { href: "/", label: "Overview", current: undefined },
      { href: "/post/", label: "Mail", current: true },
    ],
  );
});
