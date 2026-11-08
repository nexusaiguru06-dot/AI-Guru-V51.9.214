import type { MathVisualEvent, MathVisualNode, UniversalMathScene } from '../universal/types';
import { lerpColor, resolveColor } from './colors';
import { evalExpr } from './expr';

export interface RuntimeCamera { x: number; y: number; scale: number; }
export interface RuntimeNodeState extends MathVisualNode {
  opacity: number; rotation?: number; scale?: number; highlighted?: boolean;
  /** Current animated colour (hex) after any `recolor` events; undefined = use the board default. */
  color?: string;
  /** Current counted / live numeric value, and its formatted text. */
  value?: number; displayText?: string;
}
export interface RuntimeSnapshot {
  timeMs: number; nodes: Map<string, RuntimeNodeState>; camera: RuntimeCamera; activeEventIds: string[];
  /** Variable -> colour at this moment (lesson bindings plus any `var:` recolours in progress). */
  bindings: Record<string, string>;
  /** Tween parameters at this moment; plots and readouts read these. */
  params: Record<string, number>;
}

const clamp = (v:number, lo=0, hi=1) => Math.min(hi, Math.max(lo, v));
const lerp = (a:number,b:number,t:number) => a + (b-a)*t;
const easeInOut = (t:number) => t < .5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;

function cloneNode(node: MathVisualNode, initiallyVisible = true): RuntimeNodeState {
  return { ...node, style: node.style ? { ...node.style } : undefined, opacity: initiallyVisible ? 1 : 0, scale: 1, highlighted: false };
}
function formatValue(node: MathVisualNode, v: number, decimals: number): string {
  const num = Number.isFinite(v) ? (Math.abs(v) < 1e-9 ? 0 : v).toFixed(decimals) : '?';
  return (node.valueFormat ?? '{v}').replace(/\{v\}/g, num);
}
function nodeAt(nodes: Map<string, RuntimeNodeState>, id?: string) { return id ? nodes.get(id) : undefined; }
function applyEvent(nodes: Map<string, RuntimeNodeState>, event: MathVisualEvent, progress: number) {
  const t = easeInOut(clamp(progress));
  const target = nodeAt(nodes, event.targetId);
  if (!target) return;
  const from = event.fromObjectId ? nodeAt(nodes, event.fromObjectId) : undefined;
  const to = event.toObjectId ? nodeAt(nodes, event.toObjectId) : target;
  if (event.kind === 'erase') { target.opacity = 1-t; return; }
  if (event.kind === 'count') {
    const v = lerp(event.fromValue ?? 0, event.toValue ?? 0, t);
    const dec = Math.max(0, Math.min(4, event.decimals ?? target.decimals ?? 0));
    target.value = v;
    target.displayText = formatValue(target, v, dec);
    return;
  }
  if (event.kind === 'move') {
    const fx = event.fromX ?? target.x ?? 0, fy = event.fromY ?? target.y ?? 0;
    target.x = lerp(fx, event.toX ?? fx, t); target.y = lerp(fy, event.toY ?? fy, t);
    return;
  }
  if (event.kind === 'highlight') { target.highlighted = progress > 0 && progress < 1; return; }
  if (event.kind === 'transform') {
    if (from && to && from.id !== to.id) {
      // 3Blue1Brown-style object morph: the destination starts at the source
      // geometry and travels to its final geometry while the source fades out.
      // This is deliberately deterministic; the AI only chooses the semantic
      // transformation, never the pixels.
      const fx=from.x??0, fy=from.y??0, tx=to.x??fx, ty=to.y??fy;
      const fw=from.width??0, fh=from.height??0, tw=to.width??fw, th=to.height??fh;
      target.x=lerp(fx,tx,t); target.y=lerp(fy,ty,t);
      target.width=lerp(fw,tw,t);
      target.height=lerp(fh,th,t);
      target.opacity=t;
      from.opacity = event.retainFrom === false ? 1 - t : 1;
    }
    return;
  }
  if (event.kind === 'draw') {
    target.opacity = t;
    if (target.kind === 'line' || target.kind === 'arrow') {
      const sx=target.startX??target.x??0, sy=target.startY??target.y??0;
      const ex=target.endX??sx, ey=target.endY??sy;
      target.endX=lerp(sx,ex,t); target.endY=lerp(sy,ey,t);
    }
  }
}

/** Parameter values and variable colours at `timeMs`. Later events overwrite earlier ones; a parameter holds its last value. */
function resolveLiveState(scene: UniversalMathScene, events: MathVisualEvent[], timeMs: number) {
  const params: Record<string, number> = { ...(scene.params ?? {}) };
  const bindings: Record<string, string> = { ...(scene.colorBindings ?? {}) };
  const seen = new Set<string>();
  for (const e of events) {
    if ((e.kind === 'tween' || (e.kind === 'count' && e.param)) && e.param && !seen.has(e.param) && !(e.param in params)) {
      params[e.param] = e.fromValue ?? 0; seen.add(e.param);
    }
    if (e.kind === 'recolor' && e.targetId?.startsWith('var:')) {
      const name = e.targetId.slice(4);
      if (!(name in bindings)) bindings[name] = '#f8fafc'; // a term is white until it is "introduced" with a colour
    }
  }
  const from: Record<string, string> = { ...bindings };
  for (const e of events) {
    if (timeMs < e.atMs) break;
    const p = e.durationMs <= 0 ? 1 : clamp((timeMs - e.atMs) / e.durationMs);
    const t = e.easing === 'linear' ? p : easeInOut(p);
    if ((e.kind === 'tween' || e.kind === 'count') && e.param) params[e.param] = lerp(e.fromValue ?? 0, e.toValue ?? 0, t);
    if (e.kind === 'recolor' && e.targetId?.startsWith('var:') && e.color) {
      const name = e.targetId.slice(4);
      bindings[name] = lerpColor(from[name] ?? '#f8fafc', e.color, p);
      if (p >= 1) from[name] = e.color;
    }
  }
  return { params, bindings };
}

export function createRuntimeSnapshot(scene: UniversalMathScene, timeMs=0): RuntimeSnapshot {
  const firstEventByTarget = new Map<string, MathVisualEvent>();
  for (const event of [...scene.events].sort((a, b) => a.atMs - b.atMs)) {
    if (event.targetId && !firstEventByTarget.has(event.targetId)) firstEventByTarget.set(event.targetId, event);
  }
  const nodes = new Map(scene.nodes.map(n => {
    const first = firstEventByTarget.get(n.id);
    const hiddenUntilDraw = first?.kind === 'draw' || (first?.kind === 'transform' && first.fromObjectId && first.fromObjectId !== n.id);
    return [n.id, cloneNode(n, !hiddenUntilDraw)];
  }));
  // Identity camera = board centre (the SVG board draws translate(500 - x*s, 350 - y*s)).
  const camera: RuntimeCamera = { x: 500, y: 350, scale: 1 };
  const events = [...scene.events].sort((a,b)=>a.atMs-b.atMs);
  const activeEventIds:string[]=[];
  const live = resolveLiveState(scene, events, timeMs);
  const nodeColorFrom = new Map<string, string>();
  for (const event of events) {
    if (timeMs < event.atMs) break;
    const elapsed = Math.max(0, timeMs-event.atMs);
    const p = event.durationMs <= 0 ? 1 : clamp(elapsed/event.durationMs);
    if (p < 1) activeEventIds.push(event.id);
    if (event.kind === 'recolor' && event.targetId && !event.targetId.startsWith('var:')) {
      const node = nodeAt(nodes, event.targetId);
      if (node && event.color) {
        const base = nodeColorFrom.get(node.id) ?? resolveColor(node.color) ?? (node.colorRole ? live.bindings[node.colorRole] : undefined) ?? '#f8fafc';
        node.color = lerpColor(base, event.color, p);
        if (p >= 1) nodeColorFrom.set(node.id, event.color);
      }
    }
    applyEvent(nodes,event,p);
    if (event.camera && p > 0) {
      const t=easeInOut(p);
      const targetNode = nodeAt(nodes, event.targetId);
      const targetX = event.camera.x ?? (targetNode ? (targetNode.x ?? 0) + (targetNode.width ?? 0) / 2 : undefined);
      const targetY = event.camera.y ?? (targetNode ? (targetNode.y ?? 0) + (targetNode.height ?? 0) / 2 : undefined);
      const targetScale = event.camera.scale ?? (event.camera.action === 'zoom' || event.camera.action === 'focus' ? 1.35 : undefined);
      if (targetScale !== undefined) camera.scale=lerp(camera.scale,targetScale,t);
      if (targetX !== undefined) camera.x=lerp(camera.x,targetX,t);
      if (targetY !== undefined) camera.y=lerp(camera.y,targetY,t);
    }
  }
  // Live geometry + readouts: nodes follow the current parameters every frame.
  for (const node of nodes.values()) {
    if (node.bindX) { const v = evalExpr(node.bindX, live.params); if (Number.isFinite(v)) node.x = v; }
    if (node.bindY) { const v = evalExpr(node.bindY, live.params); if (Number.isFinite(v)) node.y = v; }
    if (node.bindWidth) { const v = evalExpr(node.bindWidth, live.params); if (Number.isFinite(v)) node.width = Math.max(0, v); }
    if (node.bindHeight) { const v = evalExpr(node.bindHeight, live.params); if (Number.isFinite(v)) node.height = Math.max(0, v); }
    if (!node.valueExpr) continue;
    const v = evalExpr(node.valueExpr, live.params);
    node.value = v;
    node.displayText = formatValue(node, v, Math.max(0, Math.min(4, node.decimals ?? 2)));
  }
  return { timeMs, nodes, camera, activeEventIds, bindings: live.bindings, params: live.params };
}

export function sceneDurationMs(scene: UniversalMathScene): number {
  return scene.events.reduce((max,e)=>Math.max(max,e.atMs+Math.max(0,e.durationMs)),0);
}

export function eventsForBeat(scene: UniversalMathScene, beatId: string) {
  return scene.events.filter(e=>e.sourceBeatId===beatId).sort((a,b)=>a.atMs-b.atMs);
}
