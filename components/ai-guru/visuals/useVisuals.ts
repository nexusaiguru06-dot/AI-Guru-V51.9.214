'use client';
/** V51.9.96: loads the biology catalogue once (about 1,500 drawings) and finds the pictures for a text. */
import { useEffect, useMemo, useState } from 'react';
import { findVisuals, keywordWeights } from '@/lib/ai-guru/visuals/match';
import type { Visual } from '@/lib/ai-guru/visuals/types';

let bioPromise: Promise<Visual[]> | null = null;
export function loadBio(): Promise<Visual[]> {
  bioPromise ??= fetch('/ai-guru/visuals/bioicons.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return bioPromise;
}
export function useBio() {
  const [bio, setBio] = useState<Visual[]>([]);
  useEffect(() => { void loadBio().then(setBio); }, []);
  return bio;
}
export function useVisualsFor(text: string, subject?: string, limit = 8) {
  const bio = useBio();
  const weights = useMemo(() => keywordWeights(bio), [bio]);
  return useMemo(() => (text.trim() ? findVisuals(text, { subject, bio, weights, limit }) : []), [text, subject, bio, weights, limit]);
}
