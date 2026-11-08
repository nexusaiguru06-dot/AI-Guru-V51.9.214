import type { VisualAction } from '../lesson/types';
import { actionSvg } from '../visual/action-svg';

/** Stack the SVG of several actions into one standalone 1000x700 SVG (dark board). Used by the gallery and tests. */
export function actionsToSvg(actions: VisualAction[], o: { background?: string; title?: string } = {}): string {
  const inner = actions.map((a) => {
    const svg = actionSvg(a);
    return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  }).join('');
  const title = o.title ? `<text x="500" y="24" font-size="18" text-anchor="middle" fill="#64748b" font-family="sans-serif">${o.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700"><rect width="1000" height="700" fill="${o.background ?? '#0b1017'}"/>${title}${inner}</svg>`;
}
