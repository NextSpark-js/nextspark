import { useEffect } from "react";

export const HIGHLIGHT_MS = 2000;
const HIGHLIGHT_CLASSES = ["ring-2", "ring-violet-500", "ring-offset-2", "ring-offset-background"];

/**
 * On mount, scrolls to the element whose id is the URL hash and highlights it for ~2 s, so a link that lands in a
 * long page shows which card it meant. The browser (and Next) try the scroll before the cards of a viewer are
 * rendered, and the one that scrolls is the area's `main`, not the window (#498, #529).
 */
export function useScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    el.scrollIntoView();
    el.classList.add(...HIGHLIGHT_CLASSES);
    const timer = setTimeout(() => el.classList.remove(...HIGHLIGHT_CLASSES), HIGHLIGHT_MS);
    return () => {
      clearTimeout(timer);
      el.classList.remove(...HIGHLIGHT_CLASSES);
    };
  }, []);
}
