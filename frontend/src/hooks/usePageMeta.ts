/**
 * Per-page <title>, meta description, Open Graph title/description and robots
 * (FE-14). Restores the previous values on unmount, so overlays such as a blog
 * article can set their own title and hand it back when closed.
 */
import { useEffect } from 'react';

export const SITE_NAME = 'AgentOps Studio';

interface PageMeta {
  /** Page title; " | AgentOps Studio" is appended unless it already contains the site name */
  title:        string;
  description?: string;
  /** Keep the page out of search results (auth, app and error pages) */
  noindex?:     boolean;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null): string | null {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const prev = el ? el.content : null;
  if (content === null) {
    el?.remove();
    return prev;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
  return prev;
}

export function usePageMeta({ title, description, noindex = false }: PageMeta): void {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const prevTitle = document.title;
    document.title = fullTitle;
    const prevOgTitle = upsertMeta('property', 'og:title', fullTitle);
    const prevDesc    = description ? upsertMeta('name', 'description', description) : undefined;
    const prevOgDesc  = description ? upsertMeta('property', 'og:description', description) : undefined;
    const prevRobots  = upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : null);

    return () => {
      document.title = prevTitle;
      upsertMeta('property', 'og:title', prevOgTitle);
      if (prevDesc !== undefined) upsertMeta('name', 'description', prevDesc);
      if (prevOgDesc !== undefined) upsertMeta('property', 'og:description', prevOgDesc);
      upsertMeta('name', 'robots', prevRobots);
    };
  }, [title, description, noindex]);
}
