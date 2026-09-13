import assert from "node:assert/strict";
import test from "node:test";

import { groupByBadge, guideCount, toolCount } from "../lib/navigation.ts";

test("groups nav items by badge and keeps first-seen order", () => {
  const t = {};
  const items = [
    { href: "/a", label: () => "A", badge: () => "City layout" },
    { href: "/b", label: () => "B", badge: () => "Goddess" },
    { href: "/c", label: () => "C", badge: () => "City layout" },
    { href: "/d", label: () => "D" },
  ];
  const groups = groupByBadge(items, t, "Other");
  assert.deepEqual(
    groups.map((group) => ({ category: group.category, hrefs: group.items.map((item) => item.href) })),
    [
      { category: "City layout", hrefs: ["/a", "/c"] },
      { category: "Goddess", hrefs: ["/b"] },
      { category: "Other", hrefs: ["/d"] },
    ],
  );
});

test("home counters match the published navigation tree", () => {
  assert.equal(toolCount(), 6);
  assert.equal(guideCount(), 1);
});
