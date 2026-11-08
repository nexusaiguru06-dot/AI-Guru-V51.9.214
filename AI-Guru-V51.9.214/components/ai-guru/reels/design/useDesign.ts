'use client';

/**
 * V51.9.119 — the Reel designer's state: the design, what is selected, undo / redo, and saving on this device.
 *
 *  `apply(next, key?)` is one step of history (several quick changes with the same key — a slider being dragged —
 *  count as one). `live(next)` changes the picture while a handle is being dragged; `settle()` makes that one step.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_DESIGN, loadDesign, saveDesign, type DesignItem, type DesignLayer, type PartId } from '@/lib/ai-guru/reels/design/layer';
import { keepInside } from '@/lib/ai-guru/reels/design/draw-design';

export type Selection = { type: 'item'; id: string } | { type: 'part'; id: PartId } | null;

interface State { d: DesignLayer; past: DesignLayer[]; future: DesignLayer[] }
const MAX = 60;

export function useDesign() {
  const [st, setSt] = useState<State>(() => ({ d: typeof window === 'undefined' ? EMPTY_DESIGN : loadDesign(), past: [], future: [] }));
  const [sel, setSel] = useState<Selection>(null);
  const [saveProblem, setSaveProblem] = useState(false);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const before = useRef<DesignLayer | null>(null);

  const apply = useCallback((next: DesignLayer | ((d: DesignLayer) => DesignLayer), key?: string) => {
    setSt((s) => {
      const d = typeof next === 'function' ? next(s.d) : next;
      if (d === s.d) return s;
      const now = Date.now();
      const merge = key && lastKey.current?.key === key && now - lastKey.current.at < 800;
      lastKey.current = key ? { key, at: now } : null;
      return { d, past: merge ? s.past : [...s.past, s.d].slice(-MAX), future: [] };
    });
  }, []);
  /** While a handle is being dragged: the picture changes, history waits for `settle`. */
  const live = useCallback((next: (d: DesignLayer) => DesignLayer) => {
    setSt((s) => { if (!before.current) before.current = s.d; return { ...s, d: next(s.d) }; });
  }, []);
  const settle = useCallback(() => {
    const b = before.current;
    before.current = null;
    if (b) setSt((s) => (s.d === b ? s : { d: s.d, past: [...s.past, b].slice(-MAX), future: [] }));
  }, []);
  const undo = useCallback(() => setSt((s) => (s.past.length ? { d: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.d, ...s.future].slice(0, MAX) } : s)), []);
  const redo = useCallback(() => setSt((s) => (s.future.length ? { d: s.future[0], past: [...s.past, s.d].slice(-MAX), future: s.future.slice(1) } : s)), []);

  // kept on this device (a moment after the last change)
  useEffect(() => {
    const t = setTimeout(() => setSaveProblem(!saveDesign(st.d)), 300);
    return () => clearTimeout(t);
  }, [st.d]);

  const updateItem = useCallback((id: string, patch: Partial<DesignItem>, key?: string) => apply((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }), key), [apply]);
  const removeItem = useCallback((id: string) => { apply((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) })); setSel(null); }, [apply]);
  const addItem = useCallback((it0: DesignItem) => { const it = keepInside(it0); apply((d) => ({ ...d, items: [...d.items, it] })); setSel({ type: 'item', id: it.id }); }, [apply]);

  const selectedItem = sel?.type === 'item' ? st.d.items.find((i) => i.id === sel.id) ?? null : null;
  return { design: st.d, canUndo: st.past.length > 0, canRedo: st.future.length > 0, sel, setSel, selectedItem, apply, live, settle, undo, redo, updateItem, removeItem, addItem, saveProblem };
}
export type DesignApi = ReturnType<typeof useDesign>;
