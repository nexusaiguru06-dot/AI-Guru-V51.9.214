/** V51.9.96: colourful pictures for every subject, from open sources (see /ai-guru/visuals/credits). */
export type VisualSubject = 'biology' | 'chemistry' | 'physics' | 'geography';
export type Visual =
  | { kind: 'bioicon'; id: string; subject: VisualSubject; title: string; category: string; keywords: string[]; file: string; author: string; licence: string }
  | { kind: 'molecule'; id: string; subject: 'chemistry'; title: string; ml?: string; formula: string; smiles: string; keywords: string[] }
  | { kind: 'phet'; id: string; subject: VisualSubject; title: string; ml?: string; slug: string; keywords: string[] }
  | { kind: 'map'; id: string; subject: 'geography'; title: string; ml?: string; map: MapSpec; keywords: string[] };

export type MapSpec =
  | { view: 'continents' }
  | { view: 'zones' }
  | { view: 'latlong' }
  | { view: 'country'; iso: string; name: string }
  | { view: 'india' }
  | { view: 'state'; name: string };

export const SUBJECT_STYLE: Record<VisualSubject, { label: string; ml: string; from: string; to: string; ink: string; emoji: string }> = {
  biology: { label: 'Biology', ml: 'ജീവശാസ്ത്രം', from: '#22c55e', to: '#14b8a6', ink: '#052e16', emoji: '🌿' },
  chemistry: { label: 'Chemistry', ml: 'രസതന്ത്രം', from: '#f97316', to: '#ec4899', ink: '#431407', emoji: '⚗️' },
  physics: { label: 'Physics', ml: 'ഭൗതികശാസ്ത്രം', from: '#3b82f6', to: '#8b5cf6', ink: '#172554', emoji: '⚡' },
  geography: { label: 'Geography', ml: 'ഭൂമിശാസ്ത്രം', from: '#06b6d4', to: '#eab308', ink: '#083344', emoji: '🌍' },
};
