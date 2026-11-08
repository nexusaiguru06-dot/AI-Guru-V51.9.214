/**
 * Draws ONE row of the worked-solution template into a DOM element:
 *   [ math line, own colour, arc/circle over the part that changed ]   [ coloured label ]
 * Pure DOM (no React) so it can be exercised in jsdom and reused by the whiteboard.
 */
import type { TemplateRowSpec } from '@/lib/ai-guru/math/template-types';

const FONT = "'Noto Sans','Segoe UI','DejaVu Sans',system-ui,sans-serif";

function mark(doc: Document, style: 'arc' | 'circle', color: string): HTMLElement {
  const m = doc.createElement('span');
  m.dataset.tplMark = style;
  m.style.position = 'absolute';
  m.style.pointerEvents = 'none';
  m.style.borderColor = color;
  m.style.borderStyle = 'solid';
  if (style === 'arc') {
    m.style.left = '2px'; m.style.right = '2px'; m.style.top = '-9px'; m.style.height = '11px';
    m.style.borderWidth = '3px 0 0 0';
    m.style.borderRadius = '50% 50% 0 0 / 100% 100% 0 0';
  } else {
    m.style.left = '-9px'; m.style.right = '-9px'; m.style.top = '-3px'; m.style.bottom = '-3px';
    m.style.borderWidth = '3px';
    m.style.borderRadius = '999px';
  }
  return m;
}

/** Step controls, shown AFTER the caption of every step row (same look as the reference icons). */
export const STEP_CONTROLS = [
  { action: 'pause', glyph: '#', color: '#e0523d', title: 'Pause here - do not show the next step' },
  { action: 'continue', glyph: '\u221a', color: '#2e9e5b', title: 'Continue - go to the next step' },
  { action: 'repeat', glyph: '\u27f2', color: '#a04fc7', title: 'Start this answer again from the beginning' },
  { action: 'up', glyph: '^', color: '#3b82f6', title: 'Move up to the previous step (Shift-click or long-press: move down)' },
] as const;

export interface StepControlsMeta { sectionKey: string; rowId: string }

function controlsBar(doc: Document, meta: StepControlsMeta): HTMLElement {
  const bar = doc.createElement('div');
  bar.dataset.stepControls = '1';
  bar.style.display = 'flex';
  bar.style.gap = '6px';
  bar.style.marginTop = '5px';
  for (const c of STEP_CONTROLS) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.dataset.stepCtl = c.action;
    b.dataset.sectionKey = meta.sectionKey;
    b.dataset.rowId = meta.rowId;
    b.title = c.title;
    b.setAttribute('aria-label', c.title);
    b.textContent = c.glyph;
    b.style.cssText = `width:28px;height:28px;border:2px solid ${c.color};border-radius:8px;background:rgba(255,255,255,.04);color:${c.color};font:700 15px/1 ${FONT};cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;`;
    bar.append(b);
  }
  return bar;
}

export function renderTemplateRow(doc: Document, wrapper: HTMLElement, spec: TemplateRowSpec, controls?: StepControlsMeta): void {
  wrapper.textContent = '';
  wrapper.dataset.tplRow = '1';
  wrapper.style.display = 'grid';
  wrapper.style.gridTemplateColumns = 'minmax(0,1.85fr) minmax(0,1fr)';
  wrapper.style.columnGap = '22px';
  wrapper.style.alignItems = 'start';

  const left = doc.createElement('div');
  left.dataset.tplLine = '1';
  left.style.fontFamily = FONT;
  left.style.fontWeight = '700';
  left.style.fontSize = `${spec.size ?? 26}px`;
  left.style.lineHeight = '1.45';
  left.style.letterSpacing = '0.03em';
  left.style.color = spec.muted ? '#94a3b8' : spec.color;
  left.style.whiteSpace = 'pre-wrap';
  left.style.wordBreak = 'break-word';
  left.style.paddingTop = spec.focus?.style === 'arc' ? '12px' : '2px';

  const holder = doc.createElement('span');
  if (spec.boxed) {
    holder.dataset.tplBox = '1';
    holder.style.display = 'inline-block';
    holder.style.border = `3px solid ${spec.color}`;
    holder.style.borderRadius = '10px';
    holder.style.padding = '2px 16px';
  }
  const f = spec.focus;
  if (f && f.to > f.from && f.from >= 0 && f.to <= spec.text.length) {
    holder.append(doc.createTextNode(spec.text.slice(0, f.from)));
    const focusSpan = doc.createElement('span');
    focusSpan.dataset.tplFocus = '1';
    focusSpan.style.position = 'relative';
    focusSpan.style.display = 'inline-block';
    focusSpan.textContent = spec.text.slice(f.from, f.to);
    focusSpan.append(mark(doc, f.style, spec.color));
    holder.append(focusSpan);
    holder.append(doc.createTextNode(spec.text.slice(f.to)));
  } else {
    holder.textContent = spec.text;
  }
  left.append(holder);
  wrapper.append(left);

  const right = doc.createElement('div');
  right.dataset.tplLabel = '1';
  right.style.fontFamily = FONT;
  right.style.fontWeight = '700';
  right.style.fontSize = '15px';
  right.style.lineHeight = '1.3';
  right.style.color = spec.labelColor ?? spec.color;
  right.style.paddingTop = '6px';
  const caption = doc.createElement('div');
  caption.dataset.tplCaption = '1';
  caption.textContent = spec.label ?? '';
  right.append(caption);
  if (controls) right.append(controlsBar(doc, controls));
  wrapper.append(right);
  if (controls) { wrapper.dataset.rowId = controls.rowId; wrapper.dataset.sectionKey = controls.sectionKey; }
}
