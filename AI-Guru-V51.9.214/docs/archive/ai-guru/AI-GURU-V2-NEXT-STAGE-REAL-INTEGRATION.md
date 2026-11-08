# AI Guru V2 — Real Integration Stage

This stage keeps OpenMAIC 1.0.1 as the runtime/player/action/whiteboard foundation and adds:

- PDF/DOCX/PPTX upload through the existing `/api/extract-document` pipeline.
- Normalization from extracted layout blocks into AI Guru paragraph sources.
- Browser PDF reference display with page navigation (`#page=N`) while preserving the 50/50 reference/whiteboard classroom.
- Lesson JSON import and a safe extracted-document draft generator. The draft intentionally does **not** invent Malayalam or AI explanations.
- Browser speech boundary cues as a development synchronization path. Production Piper/Sarvam word timestamps can feed the same cue engine.
- Cue matching normalization for punctuation and Unicode Malayalam words.

## Important

The extraction route uses OpenMAIC's configured document extractor. If Docling is selected/configured in the OpenMAIC document provider registry, it is used through that existing provider contract; this stage does not create a duplicate document-extraction stack.

The next provider work is to add Piper/Sarvam implementations to OpenMAIC's TTS provider registry and return word timestamps (or align them through ASR) into `AIGuruCueEngine`.
