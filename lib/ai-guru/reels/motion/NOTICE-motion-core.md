# Notice: easing curves and frame-stepped counter

The measured easing curves (`softLand`, `glide`, `softInOut`, `accelExit` in `engine.ts`) and the frame-stepped
counter idea (`countSteps`, `Motion.count`) are derived from **"motionmaxxing" by Tejas Makwana**
(https://github.com/Tejashmakwana/motionmaxxing), licensed under the **Apache License 2.0**, by way of the
"motion-core-lite" crop. Full licence text: `third-party-licenses/motionmaxxing-APACHE-2.0.txt`.

Changes made here: rewritten in TypeScript inside AI Guru's motion engine; only four curves kept; the counter's
random "skip" frames removed (it is deterministic); a ripple stagger (first gap 1.5×) written for this engine.
No GSAP, three.js, fonts or other third-party components of motionmaxxing are included.
