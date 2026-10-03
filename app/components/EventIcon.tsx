"use client";

import { useEffect, useState } from "react";
import { removeEventIconTile } from "../../lib/content/event-icon-cutout";

const processed = new Map<string, Promise<string>>();

function cutoutUrl(src: string): Promise<string> {
  const cached = processed.get(src);
  if (cached) return cached;

  const result = new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return resolve(src);
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      imageData.data.set(removeEventIconTile(imageData.data, canvas.width, canvas.height));
      context.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
  processed.set(src, result);
  return result;
}

export function EventIcon({
  src,
  className,
  width,
  height,
}: {
  src: string;
  className: string;
  width: number;
  height: number;
}) {
  const [displaySrc, setDisplaySrc] = useState(src);
  useEffect(() => {
    let current = true;
    void cutoutUrl(src).then((url) => {
      if (current) setDisplaySrc(url);
    });
    return () => { current = false; };
  }, [src]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={displaySrc} alt="" width={width} height={height} />;
}
