'use client';

/** V51.9.153 — one conversation: bubbles (who wrote is coloured), the bot's category question and "did it help?". */
import { useEffect, useRef, useState, type KeyboardEvent as RKE, type MouseEvent as RME } from 'react';
import { CATEGORIES, CATEGORY_INFO, type Category, type Message, type Role } from '@/lib/ai-guru/messages/core';
import { downloadNote, teachNote, type NoteAttachment } from '@/lib/ai-guru/messages/notes';
import type { ReceiptCard } from '@/lib/ai-guru/messages/core';
import { CONFIRMED_BY, receiptCardHtml, receiptRows, rupee } from '@/lib/ai-guru/messages/receipt-card';

/** V51.9.154 — a note from the teacher: read it, ⬇ save it to this device, or ▶ teach it in the classroom. */
export function NoteCard({ note, from }: { note: NoteAttachment; from?: string }) {
  const [more, setMore] = useState(false);
  const long = note.body.length > 320;
  return (
    <div className="mt-2 rounded-xl border border-amber-200/40 bg-amber-50/95 p-3 text-[#2a1d00]" data-note-card>
      <div className="flex items-center gap-2 text-sm font-extrabold"><span>📝</span><span className="min-w-0 flex-1 truncate">{note.title}</span></div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed" data-note-body>{more || !long ? note.body : `${note.body.slice(0, 320)}…`}</div>
      {long && <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 text-xs font-bold text-amber-800 underline">{more ? 'Show less' : 'Read all'}</button>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => downloadNote(note, from)} className="rounded-lg bg-[#2a1d00] px-3 py-1.5 text-xs font-bold text-amber-50" data-note-download>⬇ Download to device</button>
        <button type="button" onClick={() => teachNote(note, from)} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white" data-note-teach>▶ Teach it in the classroom</button>
      </div>
      
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const SIDE: Record<Message['from'], string> = {
  student: 'bg-violet-600/80', teacher: 'bg-emerald-700/80', admin: 'bg-cyan-700/80', bot: 'bg-white/10 border border-white/15',
};

export function Bubbles({ messages, me, onSolved, busy }: { messages: Message[]; me: Role; onSolved?: (yes: boolean) => void; busy?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  return (
    <div className="space-y-2" data-chat-bubbles>
      {messages.map((m) => {
        const mine = m.from === me;
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            {/* V51.9.188: a message with an action opens its page when tapped anywhere on it */}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm text-white ${SIDE[m.from]}${m.action && m.action.href.startsWith('/ai-guru/') ? ' cursor-pointer ring-1 ring-cyan-300/40 hover:ring-cyan-300' : ''}`} data-msg-from={m.from}
              {...(m.action && m.action.href.startsWith('/ai-guru/') ? { role: 'link', tabIndex: 0, onClick: (e: RME) => { if (!(e.target as HTMLElement).closest('button,a')) window.location.href = m.action!.href; }, onKeyDown: (e: RKE) => { if (e.key === 'Enter') window.location.href = m.action!.href; }, 'data-msg-action': m.action.href } : {})}>
              <div className="mb-0.5 flex items-center gap-2 text-[10px] text-white/60">
                <span className="font-bold">{m.from === 'bot' ? '🤖 ' : ''}{m.by}</span>
                {m.category && (m.from === 'student' || m.from === 'teacher') && <span style={{ color: CATEGORY_INFO[m.category].color }}>{CATEGORY_INFO[m.category].icon} {CATEGORY_INFO[m.category].en}</span>}
                <span className="ml-auto">{time(m.at)}</span>
              </div>
              <div className="whitespace-pre-wrap break-words">{m.note ? m.text.replace(/^📝 [^\n]*\n?/, '') : m.text}</div>
              {m.note && <NoteCard note={m.note} from={m.by} />}
              {m.receipt && <ReceiptView r={m.receipt} />}
              {m.action && m.action.href.startsWith('/ai-guru/') && <a href={m.action.href} className="mt-2 inline-block rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-extrabold text-[#04121f]">{m.action.label}</a>}
              {m.ask === 'solved' && onSolved && (
                <div className="mt-2 flex flex-wrap gap-1.5" data-bot-solved>
                  <button disabled={busy} onClick={() => onSolved(true)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold disabled:opacity-50">✓ Yes, that solved it</button>
                  <button disabled={busy} onClick={() => onSolved(false)} className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold disabled:opacity-50">✗ No, I need the office</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

/** The bot's question: what is the message about? (the colour the office will see) */
export function CategoryPicker({ value, onPick, ml }: { value: Category | null; onPick: (c: Category) => void; ml?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-category-picker>
      {CATEGORIES.map((c) => {
        const i = CATEGORY_INFO[c];
        return (
          <button key={c} type="button" onClick={() => onPick(c)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${value === c ? i.bg : 'border-white/15 text-white/70 hover:bg-white/10'}`} style={value === c ? undefined : { borderColor: `${i.color}66` }} data-category={c}>
            {i.icon} {ml ? i.ml : i.en}
          </button>
        );
      })}
    </div>
  );
}

export function Composer({ onSend, busy, placeholder }: { onSend: (text: string) => Promise<boolean>; busy?: boolean; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const send = async () => {
    const v = ref.current?.value.trim() ?? '';
    if (!v) return;
    if (await onSend(v) && ref.current) ref.current.value = '';
  };
  return (
    <div className="flex items-end gap-2" data-composer>
      <textarea ref={ref} rows={2} maxLength={2000} placeholder={placeholder ?? 'Write your message…'} className="min-h-[44px] flex-1 resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} data-composer-text />
      <button type="button" disabled={busy} onClick={() => void send()} className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-extrabold text-[#04121f] disabled:opacity-50" data-composer-send>Send</button>
    </div>
  );
}

/** V51.9.190 — the fee receipt in Messages: the amount, a congratulations line, the details, and Print / save as PDF. */
function ReceiptView({ r }: { r: ReceiptCard }) {
  const print = () => { const w = window.open('', '_blank', 'width=640,height=820'); if (!w) return; w.document.write(receiptCardHtml(r)); w.document.close(); };
  return (
    <div className="mt-2 overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg" data-receipt={r.receiptNo}>
      <div className="bg-gradient-to-r from-cyan-700 to-violet-600 px-4 py-3 text-white"><b className="block text-sm">{r.school}</b><span className="text-[11px] opacity-85">Fee receipt · AI Guru</span></div>
      <div className="px-4 pt-3 text-center"><b className="block text-3xl text-emerald-700">{rupee(r.amount)}</b><span className="text-xs text-slate-500">🎉 Congratulations!</span></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-3 text-xs">
        {receiptRows(r).map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className={`font-bold ${k.startsWith('Transaction ID') || k.startsWith('UPI') || k.startsWith('Receipt') ? 'font-mono' : ''}`}>{v}</dd></div>)}
      </dl>
      {r.confirmedBy && <p className="px-4 pb-2 text-center text-[11px] font-bold text-cyan-700">✔ {CONFIRMED_BY[r.confirmedBy]}</p>}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-center"><button type="button" onClick={print} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-extrabold text-white">🖨 Print / save as PDF</button></div>
    </div>
  );
}
