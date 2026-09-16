import assert from "node:assert/strict";
import test from "node:test";

import { groupByBadge, guideCount, toolCount } from "../lib/navigation.ts";

test("groups nav items by category id, then badge, and keeps first-seen order", () => {
  const t = {};
  const items = [
    { href: "/a", label: () => "A", badge: () => "City layout", categoryId: "cityLayout" },
    { href: "/b", label: () => "B", badge: () => "Goddess", categoryId: "goddess" },
    { href: "/c", label: () => "C", badge: () => "City layout", categoryId: "cityLayout" },
    { href: "/d", label: () => "D" },
  ];
  const groups = groupByBadge(items, t, "Other");
  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      category: group.category,
      hrefs: group.items.map((item) => item.href),
    })),
    [
      { id: "cityLayout", category: "City layout", hrefs: ["/a", "/c"] },
      { id: "goddess", category: "Goddess", hrefs: ["/b"] },
      { id: "Other", category: "Other", hrefs: ["/d"] },
    ],
  );
});

test("home counters match the published navigation tree", () => {
  assert.equal(toolCount(), 6);
  assert.equal(guideCount(), 19);
});
