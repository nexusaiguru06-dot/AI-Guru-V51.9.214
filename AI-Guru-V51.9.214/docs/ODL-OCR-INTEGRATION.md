# AI Guru — OpenDataLoader-style OCR integration

## What changed

AI Guru Material Studio no longer assumes that browser PDF.js text extraction is authoritative. It now uses a hybrid OCR path inspired by the attached `opendataloader-pdf` project:

1. PDF.js remains the fast first pass for pages with a healthy text layer.
2. Weak/empty pages are sent to OpenDataLoader/Docling when `OPENDATALOADER_URL` is configured.
3. If that service is unavailable, the server falls back to local `pdftoppm` + Tesseract OCR.
4. OCR is page-aware; page numbers are preserved and ODL/Docling provenance bounding boxes are retained when available.
5. A targeted `/repair-page` endpoint can OCR a missing physical page from an already indexed textbook. This is what fixes the reported “Page 7 has no extracted paragraph” case without re-OCRing the entire book.

## OpenDataLoader features adopted

- Hybrid/triage OCR rather than blindly OCR-ing every healthy text page.
- Full-page OCR capability for targeted repair.
- Page-range processing.
- Layout-aware/provenance-aware text grouping.
- OCR engine abstraction: OpenDataLoader/Docling first, local Tesseract fallback.
- Diagnostic engine/mode/page counts returned by the indexing API.
- Separation of extraction success from actual content recovery.

## Runtime

Preferred production setup:

```text
AI Guru Next.js
      │
      ├── PDF.js text layer (fast path)
      │
      └── weak/missing pages ──> OpenDataLoader hybrid server
                                  └── Docling + OCR + layout/provenance

Fallback when ODL is unavailable:
      weak/missing page ──> pdftoppm ──> Tesseract
```

Set:

```env
OPENDATALOADER_URL=http://<odl-host>:5002
AI_GURU_OCR_LANG=eng
AI_GURU_OCR_DPI=220
AI_GURU_OCR_PSM=3
```

The attached ODL source documents its hybrid server endpoint as `POST /v1/convert/file` and supports page ranges. Its default hybrid mode is intended to triage pages, while full-page OCR is available when required.

## Important for the Kerala Mathematics textbook

The supplied `35_Maths Eng (1).pdf` has 144 physical PDF pages. Physical PDF page 7 visibly contains the beginning of **Pairs of Equations**, including the beads problem and the equations; its text layer is also readable when extracted directly. The new targeted repair path therefore treats the physical PDF page as authoritative when the indexed paragraph map is missing it, instead of silently moving the teacher to the next page.

## Deployment note

If the production host does not have `tesseract` and `pdftoppm`, configure `OPENDATALOADER_URL` instead. The browser no longer blocks a textbook merely because its client-side text layer is weak.
