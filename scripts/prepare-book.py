import json,re,sys
from pathlib import Path
from pypdf import PdfReader

if len(sys.argv)<2:
    raise SystemExit('Usage: python scripts/prepare-book.py <pdf> [output] [chapter_size]')
pdf=Path(sys.argv[1]); out=Path(sys.argv[2] if len(sys.argv)>2 else 'fixtures/ai-guru/book-index.json'); size=int(sys.argv[3] if len(sys.argv)>3 else 30)
r=PdfReader(str(pdf))
def paras(text):
    text=text.replace('\r','')
    parts=re.split(r'\n\s*\n+',text)
    return [re.sub(r'\s+',' ',p).strip() for p in parts if p.strip()]
pages=[]
for i,p in enumerate(r.pages,1):
    t=p.extract_text() or ''
    pages.append({'pageNumber':i,'text':t.strip(),'paragraphs':paras(t)})
chapters=[]
for start in range(1,len(pages)+1,size):
    end=min(len(pages),start+size-1); chunk=pages[start-1:end]
    lines='\n'.join(p['text'] for p in chunk).splitlines()
    heading=next((x.strip() for x in lines if 4<len(x.strip())<100 and re.search(r'chapter|unit|lesson',x,re.I)),None)
    chapters.append({'id':f'chapter-{len(chapters)+1}','index':len(chapters),'pageStart':start,'pageEnd':end,'title':heading or f'Chapter {len(chapters)+1} · Pages {start}–{end}','pages':chunk})
book={'version':1,'bookId':re.sub(r'[^a-z0-9]+','-',pdf.stem.lower()).strip('-'),'fileName':pdf.name,'pageCount':len(pages),'chapterSize':size,'chapters':chapters}
out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(book,ensure_ascii=False,indent=2))
print(f'Prepared {len(pages)} pages into {len(chapters)} chapters -> {out}')
