import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The site is published in a repository folder, so everything in `public/`
 * answers under a base path. `asset()` adds it, but a `url()` written in a
 * stylesheet cannot: the browser resolves it against the site root and the
 * file is simply not there — invisible locally, a hole on the published site.
 * So the stylesheet may not address `public/` at all; a component hands it the
 * address in a custom property instead.
 */
test("the stylesheet does not address public/ by itself", () => {
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  const offenders = [...css.matchAll(/url\(\s*["']?(\/[^"')]*)/g)].map((match) => match[1]);
  assert.deepEqual(offenders, [], "write the URL through asset() in the component instead");
});

test("every asset() path names a file that is shipped", () => {
  const sources = [];
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) sources.push(next);
    }
  };
  walk("app");
  walk("lib");

  let checked = 0;
  for (const file of sources) {
    const text = readFileSync(path.join(root, file), "utf8");
    for (const match of text.matchAll(/asset\(\s*"(\/[^"]*)"/g)) {
      checked += 1;
      assert.ok(
        existsSync(path.join(root, "public", match[1])),
        `${file} asks for public${match[1]}, which is missing`,
      );
    }
  }
  assert.ok(checked > 0, "found no asset() paths to check");
});

test("the news banner is drawn four ways, all present", () => {
  const page = readFileSync(path.join(root, "app/page.tsx"), "utf8");
  for (const variable of [
    "--hero-news-light",
    "--hero-news-dark",
    "--hero-news-light-sm",
    "--hero-news-dark-sm",
  ]) {
    assert.ok(page.includes(`"${variable}":`), `the overview does not set ${variable}`);
  }
  for (const draw of ["home-light", "home-dark", "home-light-sm", "home-dark-sm"]) {
    assert.ok(existsSync(path.join(root, `public/banners/${draw}.webp`)), `${draw}.webp is missing`);
  }
});
