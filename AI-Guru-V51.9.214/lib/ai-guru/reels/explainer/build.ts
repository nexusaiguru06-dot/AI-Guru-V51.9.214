/**
 * V51.9.124 — an explainer script as reel parts: one part per shot, timed to its voice (or long enough to read).
 * The picture is drawn by explainer/draw.ts from the shot itself (scene.explainer); the engine only times it.
 */
import { Motion, type MotionScene } from '../motion/engine';
import { estimateSpeechMs } from '../motion/speech';
import { pickBi, plainText, type XScript, type XShot } from './script';

export interface XSceneRef { shot: XShot; lang: 'en' | 'ml'; index: number; count: number }

export function buildExplainer(script: XScript, lang: 'en' | 'ml', format: 'vertical' | 'square' | 'landscape' = 'vertical'): MotionScene[] {
  if (!script.shots.length) throw new Error('This explainer has no shots yet.');
  const title = pickBi(script.title, lang) || 'Explainer';
  const [w, h] = format === 'landscape' ? [1280, 720] : format === 'square' ? [720, 720] : [720, 1280];
  return script.shots.map((shot, index) => {
    const m = new Motion(title, w, h);
    m.fixView(w / 2, w);
    const said = plainText(pickBi(shot.text, lang));
    const t = m.step(said, 250, Math.max(2800, estimateSpeechMs(said, lang) + 900));
    m.hold(t + 2200);
    const scene = m.build(700);
    scene.group = 'explainer';
    scene.pill = lang === 'ml' ? 'വിശദീകരണം' : 'EXPLAINER';
    scene.explainer = { shot, lang, index, count: script.shots.length };
    return scene;
  });
}
