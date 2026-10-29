import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { titleForPath } from '@/lib/route-titles';

/** Gives every page its own title, so a screen reader, a tab list and the history say where you are. */
export function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);
  return null;
}
