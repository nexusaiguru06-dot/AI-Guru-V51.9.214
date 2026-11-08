/**
 * V51.9.154 — a teacher's note sent in Messages. The student (or teacher) can:
 *   ⬇ download it to the device (a .txt file that opens anywhere, Malayalam included), or
 *   ▶ teach it in the classroom: the note is handed to the classroom, which shows "Start teaching" and teaches it
 *     paragraph by paragraph on the whiteboard.
 * Pure helpers; the browser-only parts check for `window`.
 */
export interface NoteAttachment { title: string; body: string; itemId?: string }

const HAND_OFF = 'ai-guru:teach-note';
export const TEACH_URL = '/ai-guru/classroom?teach=note';

export function cleanNote(x: unknown): NoteAttachment | null {
  const r = (x ?? {}) as Record<string, unknown>;
  const title = String(r.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const body = String(r.body ?? '').replace(/\r/g, '').trim().slice(0, 10000);
  if (!title || !body) return null;
  const itemId = typeof r.itemId === 'string' && r.itemId ? r.itemId.slice(0, 80) : undefined;
  return { title, body, ...(itemId ? { itemId } : {}) };
}

/** The note as paragraphs to teach: blank lines split paragraphs; very long ones are cut at sentence ends (~700 characters). */
export function noteParagraphs(body: string): string[] {
  const blocks = body.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const out: string[] = [];
  for (const b of blocks) {
    if (b.length <= 700) { out.push(b); continue; }
    let cur = '';
    for (const s of b.split(/(?<=[.!?।])\s+/)) {
      if (cur && (cur + ' ' + s).length > 700) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** A file name every browser keeps: some drop names with non-English letters, so only the English part is used. */
export function noteFileName(title: string): string {
  const ascii = title.replace(/[\u2010-\u2015]/g, '-').replace(/[^\x20-\x7E]/g, ' ').replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ').replace(/^[\s.-]+|[\s.-]+$/g, '').slice(0, 80);
  return `${/[A-Za-z0-9]/.test(ascii) ? ascii : 'teacher-note'}.txt`;
}
export const noteFileText = (n: NoteAttachment, from?: string) => `${n.title}\n${from ? `From: ${from}\n` : ''}\n${n.body}\n`;

/** Browser: save the note as a file on this device. */
export function downloadNote(n: NoteAttachment, from?: string) {
  const blob = new Blob(['\uFEFF', noteFileText(n, from)], { type: 'text/plain;charset=utf-8' }); // the BOM keeps Malayalam right in Notepad
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = noteFileName(n.title);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export type HandedNote = NoteAttachment & { from?: string; at: string };

/** Browser: hand the note to the classroom, then open it there. */
export function teachNote(n: NoteAttachment, from?: string) {
  const v = JSON.stringify({ title: n.title, body: n.body, from, at: new Date().toISOString() } satisfies HandedNote);
  try { localStorage.setItem(HAND_OFF, v); } catch { try { sessionStorage.setItem(HAND_OFF, v); } catch { /* nothing to keep it in */ } }
  window.location.href = TEACH_URL;
}

/** Browser (classroom): the note handed over, if any. */
export function takeHandedNote(): HandedNote | null {
  let v: string | null = null;
  try { v = localStorage.getItem(HAND_OFF); } catch { /* blocked */ }
  if (!v) try { v = sessionStorage.getItem(HAND_OFF); } catch { /* blocked */ }
  if (!v) return null;
  try { const j = JSON.parse(v); const n = cleanNote(j); return n ? { ...n, from: typeof j.from === 'string' ? j.from : undefined, at: String(j.at ?? '') } : null; } catch { return null; }
}
