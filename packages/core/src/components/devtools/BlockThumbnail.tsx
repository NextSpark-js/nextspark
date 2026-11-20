"use client";

import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { withBasePathIfInApp } from "../../lib/base-path";

interface BlockThumbnailProps {
  src?: string;
  alt: string;
  /** The placeholder's text; without it the placeholder is the icon alone. */
  emptyLabel?: string;
  iconClassName?: string;
}

/**
 * A block's thumbnail. With no image, or one that fails to load, it shows the same placeholder in every devtools
 * view (the blocks list and the block detail).
 */
export function BlockThumbnail({ src, alt, emptyLabel, iconClassName = "h-8 w-8" }: BlockThumbnailProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex flex-col items-center text-muted-foreground">
        <LayoutGrid className={`${iconClassName}${emptyLabel ? " mb-1" : ""}`} />
        {emptyLabel && <span className="text-xs">{emptyLabel}</span>}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBasePathIfInApp(src)}
      alt={alt}
      className="w-full h-full object-cover"
      // an image that failed before hydration fires no React event
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) setFailed(true);
      }}
      onError={() => setFailed(true)}
    />
  );
}
