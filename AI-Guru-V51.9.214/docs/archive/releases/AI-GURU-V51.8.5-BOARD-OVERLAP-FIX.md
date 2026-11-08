# AI Guru V51.8.5 — Teaching Board Overlap Fix

## Problem
General Classroom playback could render planner-generated Malayalam/English labels in overlapping rectangles. The model supplied small/English-oriented dimensions, while the browser renderer displayed those nodes at full responsive scale.

## Fix
- Normalize General Visual Planner text/LaTeX node coordinates before playback.
- Give symbolic/text nodes safe minimum width/height and readable font-size bounds.
- Resolve text-vs-text bounding-box collisions by shifting later nodes vertically while preserving the 1000×700 scene.
- Keep planner spatial nodes unchanged unless needed for text layout.
- Hide the fixed WASM SVG layer while the DOM renderer is authoritative, preventing duplicate visual layers.
- Preserve the existing MathLikeAnim DOM renderer, TTS, RAG, Video-DNA, math verification, and Problems & Formulae isolation.
