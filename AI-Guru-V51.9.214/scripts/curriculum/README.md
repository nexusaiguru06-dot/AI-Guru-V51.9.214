# NCERT / CBSE Curriculum Ingestion + 500-case Evaluation Pipeline

This pipeline keeps official source files outside the application bundle. Put legally obtained NCERT/CBSE PDFs under:

- `data/curriculum-sources/ncert/`
- `data/curriculum-sources/cbse/`

Then run:

```bash
pnpm curriculum:ingest
pnpm curriculum:build500
pnpm eval:curriculum500
```

The importer records source file, page, grade, chapter and question text. It does not redistribute NCERT/CBSE content in the repository. If fewer than 500 extractable questions are available, `build500` fills the evaluation set with clearly-labelled generated benchmark cases so the harness remains runnable. Generated cases are never presented as NCERT/CBSE questions.

Official starting points:
- NCERT textbook portal: https://ncert.nic.in/textbook.php
- CBSE examination/reference material: https://parikshasangam.cbse.gov.in/ps/frmSchRef?REF=Exam+Reference+Material
