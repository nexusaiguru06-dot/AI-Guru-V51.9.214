# AI Guru V51.2 — PDF source, video-grounded classroom, page jump fix

1. Direct classroom PDF upload now clears stale Material Studio document/material state so a previous problem-solving paper cannot drive the new class.
2. When a reference video is selected, RAG Classroom now calls the real `/api/ai-guru/math/plan` video-grounding pipeline, passes the active BYOK key for the request, requires `referenceGrounding.watched` + temporal evidence, and renders the returned visual beats on the classroom whiteboard. If grounding fails, the verified deterministic renderer remains the fallback.
3. Physical PDF page navigation is decoupled from paragraph extraction. `Go 10` displays physical page 10 even if no indexed paragraph starts on page 10; teaching context uses the nearest preceding paragraph until teaching resumes.
