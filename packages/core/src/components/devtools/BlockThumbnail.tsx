"use client";

import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { withBasePathIfInApp } from "../../lib/base-path";

/** True when every pixel (RGBA) of `data` equals the first one: an image with nothing drawn on it. */
export function isUniformImage(data: ArrayLike<number>): boolean {
  for (let i = 4; i < data.length; i++) {
    if (data[i] !== data[i % 4]) return false;
  }
  return true;
}

/** Reads the loaded image through a small canvas; an unreadable image (no canvas, tainted) counts as drawn. */
function isBlank(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 9;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 16, 9);
    return isUniformImage(ctx.getImageData(0, 0, 16, 9).data);
  } catch {
    return false;
  }
}

interface BlockThumbnailProps {
  src?: string;
  alt: string;
  /** The placeholder's text, shown when there is no image, it fails to load or it is a blank fill. */
  emptyLabel: string;
}

/**
 * A block card's thumbnail. A block can ship a thumbnail that is only a flat fill (a placeholder asset): on a
 * card that reads as a broken white box, so a blank or failing image shows the same "no preview" placeholder as
 * a block with no thumbnail.
 */
export function BlockThumbnail({ src, alt, emptyLabel }: BlockThumbnailProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex flex-col items-center text-muted-foreground">
        <LayoutGrid className="h-8 w-8 mb-1" />
        <span className="text-xs">{emptyLabel}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBasePathIfInApp(src)}
      alt={alt}
      className="w-full h-full object-cover"
      // an image that finished (or failed) before hydration fires no React event
      ref={(img) => {
        if (img?.complete) setFailed(img.naturalWidth === 0 || isBlank(img));
      }}
      onError={() => setFailed(true)}
      onLoad={(e) => {
        if (isBlank(e.currentTarget)) setFailed(true);
      }}
    />
  );
}
