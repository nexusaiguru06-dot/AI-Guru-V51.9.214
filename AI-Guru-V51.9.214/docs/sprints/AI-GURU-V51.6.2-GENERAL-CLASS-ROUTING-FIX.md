# AI-Guru V51.6.2 — General Classroom Routing Fix

- RAG Classroom now calls the compact general-teaching Visual-DNA planner for ordinary material even when the textbook paragraph contains a worked problem.
- General-teaching plans play without requiring `referenceGrounding.watched=true`; the normal V51.5 design uses local Visual DNA and does not upload/watch MP4s.
- `planTemplateSolution()` (the Problems & Formulae/verified derivation renderer visible in the screenshots) is now exclusive to `problems-formulae` material.
- A problem inside a normal textbook lesson remains in Classroom mode and is explained/solved using the general-teaching visual grammar.
- The 20 problem-solving reference library remains exclusive to Material Studio → Problems & Formulae.
