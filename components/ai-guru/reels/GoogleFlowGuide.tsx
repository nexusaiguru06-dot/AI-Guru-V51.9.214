'use client';

/**
 * V51.9.151 — Reel Studio › "Modify with Google Flow": a guide page. The student downloads the MP4 from the whiteboard
 * (or the Reel Studio), opens Google Flow, uploads it and pastes a prompt made here, to restyle the video.
 *
 * Facts from Google's help pages (checked 27 Oct 2026): Flow needs a Google account aged 18+ (age verified) with a
 * Google AI Plus / Pro / Ultra plan (or an eligible Workspace plan), in a supported country (India is one). An uploaded
 * video is edited with the "Omni Flash" video model: up to 60 s and 1 GB (.mp4 .mov .avi .wmv); longer than 30 s is
 * trimmed to 30 s; each edit changes a segment of up to 10 s; up to 3 follow-up turns. So the page is written for the
 * student to do this WITH a parent or teacher, and warns that an AI edit can change numbers and must be checked.
 * V51.9.207 — a raw reel moved here from the tray (?raw=) plays beside the prompt, which can be edited; the finished
 * video from Google Flow can be dropped here, kept in the app and downloaded.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import { AiGuruTopNav } from '../AiGuruTopNav';
import { VideoShelf } from './MyReelsShelves';
import { WayTabs } from './ReelsHub';
import { addVideo, thumbFromBlob } from '@/lib/ai-guru/reels/my-reels';
import { isVideoFile, parseRaw } from '@/lib/ai-guru/reels/raw-reels';
import { RawReelPanel, saveToDevice } from './RawReels';

export const FLOW_URL = 'https://labs.google/fx/tools/flow';
export const OMNI_VIDS_URL = 'https://docs.google.com/videos/';
export const OMNI_STUDIO_URL = 'https://aistudio.google.com/';

/**
 * V51.9.213 — "Google Omni 1.2": Gemini Omni 1.2 Flash, Google's video model (announced 5 Nov 2026). Facts from Google's
 * and press pages (checked 8 Nov 2026): it makes video WITH its own sound from text, pictures and video; 3–15 s clips
 * (10 s default), 9:16 supported; edits by follow-up turns; up to 6 reference pictures; every video carries an invisible
 * SynthID mark; uploaded audio and voice editing are not supported (so the original voice is not kept). Where: Flow, Google
 * Vids (free with a Google account: up to 3 videos a month, 15 s each, reference pictures), Google AI Studio / the paid
 * Gemini API (video input; not on the free tier), the Gemini app (AI Ultra). English is the language it is tested in.
 */
export function omniPrompt(o: { topic: string; style: Style; part: Part; music: boolean }): string {
  const topic = o.topic.trim() || 'a school maths lesson';
  return [
    `Vertical 9:16 video, about 10 seconds. Restyle this educational video about ${topic} into ${o.style.look}.`,
    o.part.job,
    'VERY IMPORTANT: keep every number, letter, symbol, equation, arrow and diagram line exactly as it is — same values, same spelling, same order, same position — sharp and fully readable. Do not add, remove, translate or change any text.',
    'Keep the captions at the bottom readable. Do not add people, faces, hands, brand logos or watermarks.',
    o.music ? 'Sound: only a soft calm background music, no speech.' : 'Sound: a very quiet gentle ambience, no speech and no music.',
  ].join(' ');
}

type Style = { id: string; name: string; ml: string; look: string };
const STYLES: Style[] = [
  { id: 'cinematic', name: 'Cinematic glow', ml: 'സിനിമാറ്റിക്', look: 'a cinematic look: deep navy night-sky background with soft drifting stars, gentle warm golden rim light on the writing, subtle depth of field, a slow smooth camera push-in' },
  { id: 'chalk', name: 'Chalkboard class', ml: 'ചോക്ക്ബോർഡ്', look: 'a real green chalkboard in a bright Kerala school classroom, the writing looking like neat white and coloured chalk, soft morning sunlight from a window, a calm slow camera drift' },
  { id: 'notebook', name: 'Notebook sketch', ml: 'നോട്ട്ബുക്ക്', look: 'a hand-drawn notebook page: cream ruled paper, the writing in blue and red ink with a light pencil-sketch texture, a soft paper shadow, a gentle top-down camera' },
  { id: 'space', name: 'Space journey', ml: 'ബഹിരാകാശം', look: 'outer space: a glowing nebula and slowly turning planets far behind the board, the writing floating as bright light, a slow cinematic orbit of the camera' },
  { id: 'festival', name: 'Kerala festival', ml: 'കേരള ഉത്സവം', look: 'warm Onam festival colours: a soft pookalam flower pattern and coconut-palm silhouettes far in the background, golden evening light, a gentle camera glide' },
  { id: 'neon', name: 'Neon lab', ml: 'നിയോൺ', look: 'a futuristic science lab: dark glass walls, the writing as clean neon light in cyan and magenta, soft reflections on the floor, a smooth dolly-in' },
];
type Part = { id: string; name: string; ml: string; job: string };
const PARTS: Part[] = [
  { id: 'opening', name: 'Opening (first 10 s)', ml: 'തുടക്കം', job: 'This is the opening of the video: make it eye-catching in the first two seconds.' },
  { id: 'middle', name: 'Working (a middle 10 s)', ml: 'നടുഭാഗം', job: 'This is the working part of the lesson: the steps must stay easy to read and follow.' },
  { id: 'answer', name: 'Answer (the 10 s with the answer)', ml: 'ഉത്തരം', job: 'This part shows the answer: give the final answer a gentle glow and a small celebration sparkle around it, without covering it.' },
];

export function flowPrompt(o: { topic: string; style: Style; part: Part; music: boolean }): string {
  const topic = o.topic.trim() || 'a school maths lesson';
  return [
    `Restyle this educational video about ${topic} into ${o.style.look}.`,
    o.part.job,
    'VERY IMPORTANT: keep every number, letter, symbol, equation, arrow and diagram line exactly as it is — same values, same spelling, same order, same position — sharp and fully readable. Do not add, remove, translate or change any text. Keep the timing of every step the same.',
    'Keep the captions at the bottom readable. Do not add people, faces, hands, brand logos or watermarks.',
    o.music ? 'Keep the original voice; if you add sound, only a soft calm background music under the voice.' : 'Keep the original voice and sound unchanged.',
  ].join(' ');
}

function CopyBox({ text, label, onChange, onReset, edited }: { text: string; label: string; onChange: (v: string) => void; onReset: () => void; edited: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => onChange(e.target.value)} aria-label="Prompt to copy into Google Flow (you can edit it)" className="h-48 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white/85" data-flow-prompt />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2500); } catch { setDone(false); } }}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-extrabold" data-flow-copy>
          {done ? '✓ Copied — paste it in Google Flow' : label}
        </button>
        {edited && <button type="button" onClick={onReset} className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/20" data-flow-reset>↺ Back to the made prompt</button>}
        <span className="text-[11px] text-white/45">You can change the words above before you copy.</span>
      </div>
    </div>
  );
}

function KeepFlowVideo({ topic, tool }: { topic: string; tool: 'flow' | 'omni' }) {
  const label = tool === 'omni' ? 'Google Omni' : 'Google Flow';
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const [kept, setKept] = useState<Array<{ id: string; name: string }>>([]);
  const keep = async (files: File[]) => {
    if (!files.length) return;
    setNote('Keeping it…');
    const msgs: string[] = [];
    for (const f of files) {
      if (!isVideoFile(f)) { msgs.push(`${f.name}: choose a video file (.mp4).`); continue; }
      if (f.size > 300 * 1024 * 1024) { msgs.push(`${f.name}: too big to keep here (over 300 MB).`); continue; }
      try {
        const thumb = await thumbFromBlob(f);
        const id = await addVideo({ title: topic.trim() || f.name.replace(/\.[^.]+$/, ''), way: tool, name: f.name, blob: f, thumb });
        setKept((k) => [{ id, name: f.name }, ...k]);
      } catch (e) { msgs.push(`${f.name}: ${(e as Error).message}`); }
    }
    setNote(msgs.length ? msgs.join(' ') : `✓ Kept in the app, in My ${label} videos below. You can download it again any time.`);
  };
  return (
    <div className="space-y-2">
      <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void keep(Array.from(e.dataTransfer.files)); }}
        className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-xl border border-dashed px-3 py-4 text-sm ${over ? 'border-cyan-200 bg-cyan-400/20' : 'border-cyan-300/40 bg-cyan-500/[0.06]'}`} data-flow-keep>
        <span className="rounded-lg bg-cyan-700 px-3 py-1.5 font-bold">📂 Add the video from {label}</span>
        <span className="text-xs text-white/60">Drag the finished video here, or press the button. It stays on this device, with your other reels.</span>
        {note && <span className="w-full text-xs text-cyan-100">{note}</span>}
        <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void keep(f); }} />
      </label>
      {kept.map((k) => (
        <div key={k.id} className="flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs" data-flow-kept>
          <span className="min-w-0 flex-1 truncate">✓ {k.name}</span>
          <button type="button" onClick={() => void saveToDevice(k.id)} className="rounded-md bg-white px-2.5 py-1 font-bold text-[#04101c]" data-flow-kept-download>⬇ Download to my device</button>
        </div>
      ))}
    </div>
  );
}

export default function GoogleFlowGuide({ initialTopic = '', tool = 'flow' }: { initialTopic?: string; tool?: 'flow' | 'omni' }) {
  const omni = tool === 'omni';
  const name = omni ? 'Google Omni 1.2' : 'Google Flow';
  const [topic, setTopic] = useState(initialTopic);
  const [styleId, setStyleId] = useState(STYLES[0].id);
  const [partId, setPartId] = useState(PARTS[0].id);
  const [music, setMusic] = useState(false);
  const style = STYLES.find((s) => s.id === styleId)!;
  const part = PARTS.find((p) => p.id === partId)!;
  const made = useMemo(() => (omni ? omniPrompt : flowPrompt)({ topic, style, part, music }), [omni, topic, style, part, music]);
  const [mine, setMine] = useState<string | null>(null); // the student's own wording (null = the made prompt)
  const prompt = mine ?? made;
  const hasRaw = useSyncExternalStore(() => () => {}, () => parseRaw(window.location.search).length > 0, () => false);
  const chip = (on: boolean) => `rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${on ? 'border-violet-400 bg-violet-500/25 text-white' : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10'}`;

  return (
    <div className="min-h-screen bg-[#04101c] text-white">
      <AiGuruTopNav activeLabel="Reel Studio" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6" data-google-flow-guide>
        <WayTabs active={tool} />
        <h1 className="text-2xl font-extrabold">{omni ? '🎬 Google Omni 1.2 (AI video)' : '✨ Google Flow (AI video)'}</h1>
        <p className="text-sm text-white/70">{omni ? 'Turn the video from your whiteboard into a beautiful one with Google’s newest AI video model, Gemini Omni 1.2 Flash.' : 'Turn the video from your whiteboard into a beautiful one with Google’s AI video tool.'}</p>
        {omni && <p className="rounded-xl border border-violet-300/30 bg-violet-500/[0.07] p-3 text-xs text-white/75" data-omni-facts>Omni 1.2 makes clips of <b>3 to 15 seconds</b> (10 by default), in <b>9:16</b> for reels, <b>with its own sound</b>. It cannot keep your recorded voice, so use it for a beautiful opening, background or answer clip, then join it with your reel in a phone video editor. Every video it makes carries an invisible Google “SynthID” mark. It works best in English.</p>}

        <div className="space-y-1.5 rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-sm text-amber-100" data-flow-rules>
          <p className="font-bold">Do this with a parent or teacher</p>
          {omni
            ? <p>Google Omni 1.2 is used on a Google account of a <b>parent or teacher</b>. <b>Google Vids</b> is free with a Google account (up to <b>3 videos a month</b>, 15 seconds each). <b>Flow</b> needs an account aged 18+ with a Google AI plan. <b>Google AI Studio</b> uses the paid Gemini API (about ₹6 a second of video; not free), and the <b>Gemini app</b> has it for AI Ultra. If you are under 18, open it with them.</p>
            : <p>Google Flow needs a Google account of someone <b>18 or older</b> (age verified) with a <b>Google AI Plus, Pro or Ultra</b> plan (or a school Workspace plan that includes Flow). If you are under 18, ask a parent or teacher to open it on their account with you.</p>}
          
          <p>Your video goes to Google when you upload it. If it shows your photo or name, check that you are happy to share it.</p>
        </div>

        {hasRaw ? (
          <RawReelPanel way={tool} side={(
            <div className="space-y-3" data-flow-prompt-side>
              <h3 className="text-base font-bold">Your prompt <span className="text-xs font-normal text-white/50">(edit it, then copy)</span></h3>
          <label className="block text-xs text-white/55">What is the video about?
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. solving a pair of equations, the parts of a plant cell" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" data-flow-topic />
          </label>
          <div className="space-y-1.5"><span className="text-xs text-white/55">Look</span>
            <div className="flex flex-wrap gap-1.5">{STYLES.map((s) => <button key={s.id} type="button" className={chip(s.id === styleId)} onClick={() => setStyleId(s.id)}>{s.name}</button>)}</div>
          </div>
          <div className="space-y-1.5"><span className="text-xs text-white/55">{omni ? 'Which part is the clip for? (Omni makes 3 to 15 seconds)' : 'Which 10 seconds are you changing? (Flow changes up to 10 s at a time)'}</span>
            <div className="flex flex-wrap gap-1.5">{PARTS.map((p) => <button key={p.id} type="button" className={chip(p.id === partId)} onClick={() => setPartId(p.id)}>{p.name}</button>)}</div>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> Allow soft background music</label>
          <CopyBox text={prompt} label="📋 Copy prompt" edited={mine !== null} onChange={setMine} onReset={() => setMine(null)} />
            </div>
          )} />
        ) : (
          <>
        <section className="space-y-3">
          <h2 className="text-lg font-bold">1 · Get your MP4</h2>
          <VideoShelf ways={['whiteboard']} title="📥 Your videos from the whiteboard" testId="whiteboard" empty={<>None yet. On the whiteboard press <b>⬇ MP4</b> or <b>⬇ Download</b> after a solution: the video is kept here. Then press <b>⬇ Download</b> on it to get the MP4 for Google Flow.</>} />
          <p className="text-sm text-white/70">On the whiteboard press <b>⬇ MP4</b> (or <b>⬇ Download</b> after a solution, or <b>Download</b> on an earlier class). From the Reel Studio use <b>👁 Preview &amp; post → Download</b>. Google Flow takes videos up to <b>60 seconds</b> and <b>1 GB</b> (.mp4); a video longer than 30 seconds is trimmed to 30 seconds there.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">2 · Make your prompt</h2>
          <label className="block text-xs text-white/55">What is the video about?
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. solving a pair of equations, the parts of a plant cell" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" data-flow-topic />
          </label>
          <div className="space-y-1.5"><span className="text-xs text-white/55">Look</span>
            <div className="flex flex-wrap gap-1.5">{STYLES.map((s) => <button key={s.id} type="button" className={chip(s.id === styleId)} onClick={() => setStyleId(s.id)}>{s.name}</button>)}</div>
          </div>
          <div className="space-y-1.5"><span className="text-xs text-white/55">{omni ? 'Which part is the clip for? (Omni makes 3 to 15 seconds)' : 'Which 10 seconds are you changing? (Flow changes up to 10 s at a time)'}</span>
            <div className="flex flex-wrap gap-1.5">{PARTS.map((p) => <button key={p.id} type="button" className={chip(p.id === partId)} onClick={() => setPartId(p.id)}>{p.name}</button>)}</div>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> Allow soft background music</label>
          <CopyBox text={prompt} label="📋 Copy prompt" edited={mine !== null} onChange={setMine} onReset={() => setMine(null)} />
        </section>
          </>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-bold">{hasRaw ? '1' : '3'} · In {name}</h2>
          {omni ? (<>
            <div className="flex flex-wrap gap-2">
              <a href={OMNI_VIDS_URL} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#04101c] hover:bg-white/90" data-omni-open-vids>Google Vids (free) ↗</a>
              <a href={FLOW_URL} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-white/90 px-4 py-2.5 text-sm font-extrabold text-[#04101c] hover:bg-white" data-omni-open-flow>Google Flow ↗</a>
              <a href={OMNI_STUDIO_URL} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-white/80 px-4 py-2.5 text-sm font-extrabold text-[#04101c] hover:bg-white" data-omni-open-studio>Google AI Studio ↗</a>
            </div>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/75">
              <li>Open one of the three, signed in as a parent or teacher. <b>Google Vids</b> is free (3 videos a month); it takes <b>pictures</b> — take a screenshot of your lesson and add it as the reference picture. <b>Flow</b> and <b>AI Studio</b> can take your <b>MP4</b> too.</li>
              <li>Choose the model <b>Omni 1.2 Flash</b> (the newest Omni) and set the shape to <b>9:16</b> (vertical).</li>
              <li><b>Upload</b> your MP4 (or picture) and <b>paste</b> the prompt from this page.</li>
              <li>Set the length to <b>10 seconds</b> (3 to 15 is possible) and press <b>Generate</b>. Not quite right? Add a short follow-up, such as “make the background calmer”.</li>
              <li><b>Download</b> the result. Omni makes its own sound and cannot keep your voice, so join the new clip with your reel (and your voice) in any phone video editor.</li>
            </ol>
          </>) : (<>
          <a href={FLOW_URL} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#04101c] hover:bg-white/90" data-flow-open>Open Google Flow ↗</a>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/75">
            <li>Sign in and open a <b>new project</b>.</li>
            <li>In the settings under the prompt box choose <b>Video</b> and the model <b>Omni Flash</b> (the one that edits an uploaded video).</li>
            <li><b>Upload</b> your MP4.</li>
            <li>Click the video and pick the <b>10 seconds</b> to change (the part you chose above).</li>
            <li><b>Paste</b> the prompt and press <b>Generate</b>. Not quite right? Add a short follow-up, such as “make the background calmer” (up to 3 times).</li>
            <li><b>Download</b> the result. If Flow gives back only the part you changed, join it with the rest of your video in any phone video editor.</li>
          </ol>
          </>)}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">{hasRaw ? '2' : '4'} · Keep your new video here</h2>
          <KeepFlowVideo topic={topic} tool={tool} />
          <VideoShelf ways={[tool]} title={`⭐ My ${name.replace(' 1.2', '')} videos`} testId="mine" empty={`After you download your video from ${name}, add it here to keep it with your reels.`} />
        </section>

        <div className="space-y-1.5 rounded-xl border border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-100" data-flow-check>
          <p className="font-bold">Before you post: check every number</p>
          <p>AI video can blur or change letters and numbers even when asked not to. Watch the new video and check that every equation, number and answer is still exactly right. If anything changed, use your original video instead.</p>
          <p>Leave the <b>last part with the QR code</b> as it is: if the QR changes, friends cannot scan it to join. Post with the caption from the Reel Studio — it carries your join link.</p>
          
        </div>
        <p className="text-xs text-white/40">{name} is a Google product; its plans, limits and rules can change. AI Guru does not send your video to Google — you upload it yourself.</p>
      </main>
    </div>
  );
}
