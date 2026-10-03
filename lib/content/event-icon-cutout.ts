/** Remove the near-white rounded tile behind the game's event icons. */
export function removeEventIconTile(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels);
  if (width < 8 || height < 8) return output;

  const indexAt = (x: number, y: number) => (y * width + x) * 4;
  const isTileFill = (x: number, y: number) => {
    const index = indexAt(x, y);
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const brightness = (red + green + blue) / 3;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    return pixels[index + 3] > 0 && brightness >= 218 && spread <= 42;
  };

  const queue: number[] = [];
  const visited = new Uint8Array(width * height);
  for (const [xRatio, yRatio] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    const x = Math.round((width - 1) * xRatio);
    const y = Math.round((height - 1) * yRatio);
    const position = y * width + x;
    if (!visited[position] && isTileFill(x, y)) {
      visited[position] = 1;
      queue.push(position);
    }
  }
  if (queue.length === 0) return output;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const position = queue[cursor];
    const x = position % width;
    const y = Math.floor(position / width);
    output[indexAt(x, y) + 3] = 0;
    for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
      const nextPosition = nextY * width + nextX;
      if (visited[nextPosition] || !isTileFill(nextX, nextY)) continue;
      visited[nextPosition] = 1;
      queue.push(nextPosition);
    }
  }

  // The tile has a thin rounded outline around its pale fill. Its bounds are
  // consistent across these square game icons; clear that decorative frame
  // while leaving the central illustration untouched.
  const scale = Math.min(width, height);
  const halfWidth = width * 0.46;
  const halfHeight = height * 0.46;
  const radius = scale * 0.15;
  const frameWidth = scale * 0.035;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const qx = Math.abs(x + 0.5 - width / 2) - (halfWidth - radius);
      const qy = Math.abs(y + 0.5 - height / 2) - (halfHeight - radius);
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
        + Math.min(Math.max(qx, qy), 0) - radius;
      if (Math.abs(distance) <= frameWidth) output[indexAt(x, y) + 3] = 0;
    }
  }

  return output;
}
