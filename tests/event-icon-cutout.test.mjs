import assert from "node:assert/strict";
import { it } from "node:test";
import { removeEventIconTile } from "../lib/content/event-icon-cutout.ts";

it("removes the connected pale tile and keeps the coloured event art", () => {
  const width = 20;
  const height = 20;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 3; y < 17; y += 1) {
    for (let x = 3; x < 17; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = 247;
      pixels[index + 1] = 244;
      pixels[index + 2] = 236;
      pixels[index + 3] = 255;
    }
  }
  const artIndex = (10 * width + 10) * 4;
  pixels.set([177, 62, 42, 255], artIndex);
  const frameIndex = (0 * width + 10) * 4;
  pixels.set([45, 39, 33, 255], frameIndex);
  const roundedCornerFrameIndex = (4 * width + 1) * 4;
  pixels.set([45, 39, 33, 255], roundedCornerFrameIndex);

  const cutout = removeEventIconTile(pixels, width, height);
  assert.equal(cutout[(4 * width + 4) * 4 + 3], 0);
  assert.equal(cutout[artIndex + 3], 255);
  assert.equal(cutout[frameIndex + 3], 0, "the standard tile outline is removed");
  assert.equal(cutout[roundedCornerFrameIndex + 3], 0, "the rounded corner outline is removed");
  assert.equal(cutout[0 + 3], 0, "the original transparent exterior stays transparent");
});

it("leaves a cut-out icon alone when it has no pale tile", () => {
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
  const artIndex = (8 * 16 + 8) * 4;
  pixels.set([210, 88, 44, 255], artIndex);
  assert.deepEqual(removeEventIconTile(pixels, 16, 16), pixels);
});
