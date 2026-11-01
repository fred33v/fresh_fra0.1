import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { titleForPath } from '@/lib/route-titles';

/**
 * Gives every page its own title, so a screen reader, a tab list and the history say where you are.
 * After an in-app navigation it also moves focus to the page's main content: without this, focus stays
 * on <body> and a screen reader user is not told that a new page has loaded.
 */
export function RouteTitle() {
  const { pathname, hash } = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = titleForPath(pathname);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (hash) return; // a link to an anchor handles its own scroll and focus
    // Wait for the new page to render its <main>
    const id = window.setTimeout(() => {
      const main = document.getElementById('main-content') ?? document.querySelector<HTMLElement>('main');
      if (!main) return;
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, hash]);

  return null;
}
