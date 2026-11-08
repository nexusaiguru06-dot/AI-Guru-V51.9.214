'use client';
/**
 * A small three.js host: makes the renderer, camera and orbit controls (drag to turn, scroll or pinch to zoom), calls
 * `setup` once to fill the scene, calls the optional `tick` every frame, and cleans everything up. If the device has no
 * WebGL it shows a plain message instead of failing.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Stage { scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; renderer: THREE.WebGLRenderer }
export interface StageProps { setup: (s: Stage) => void | (() => void); tick?: (s: Stage, dt: number) => void; deps: unknown[]; height?: number; camera?: [number, number, number]; className?: string; label: string }

export function ThreeStage({ setup, tick, deps, height = 420, camera = [7, 5, 9], className = '', label }: StageProps) {
  const host = useRef<HTMLDivElement>(null);
  const tickRef = useRef(tick); tickRef.current = tick;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = host.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const w = () => el.clientWidth || 600;
    renderer.setSize(w(), height); el.appendChild(renderer.domElement); renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, w() / height, 0.1, 500); cam.position.set(...camera);
    const controls = new OrbitControls(cam, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08;
    scene.add(new THREE.AmbientLight(0xffffff, 0.75)); const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(5, 9, 7); scene.add(d);
    const stage: Stage = { scene, camera: cam, controls, renderer };
    const cleanup = setup(stage);
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => { const dt = Math.min(0.1, clock.getDelta()); tickRef.current?.(stage, dt); controls.update(); renderer.render(scene, cam); });
    const onResize = () => { renderer.setSize(w(), height); cam.aspect = w() / height; cam.updateProjectionMatrix(); };
    const ro = new ResizeObserver(onResize); ro.observe(el);
    return () => {
      ro.disconnect(); renderer.setAnimationLoop(null); if (typeof cleanup === 'function') cleanup(); controls.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      renderer.dispose(); renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  if (failed) return <div role="alert" className="rounded-2xl border border-white/10 bg-white/[.04] p-6 text-sm text-slate-300">This device cannot show 3D pictures (WebGL is off). Try another browser or phone.</div>;
  return <div ref={host} role="img" aria-label={label} className={`w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d2038] to-[#06101c] ${className}`} style={{ height }} />;
}
