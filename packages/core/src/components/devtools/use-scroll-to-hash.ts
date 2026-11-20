import { useEffect } from "react";

/**
 * On mount, scrolls to the element whose id is the URL hash. The browser (and Next) try it before the cards
 * of a viewer are rendered, and the one that scrolls is the area's `main`, not the window (#498).
 */
export function useScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
}
