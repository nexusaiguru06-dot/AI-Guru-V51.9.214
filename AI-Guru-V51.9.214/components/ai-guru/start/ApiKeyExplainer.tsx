/** V51.9.198 — "What is an API key?" for students: what it is, what it looks like, and what to do.
 *  V51.9.199: no "Get key" buttons here; each paste box below has its own, so a newcomer gets the key where it is pasted. */
const KEYS = [
  { name: 'Google Gemini', tag: 'Free · start here', looks: 'AIzaSy…', len: '39 letters and numbers, starts with AIza', how: 'Sign in with a Google account, press “Create API key”, copy it.', why: 'Unlimited doubt clearing by camera, voice and typing.' },
  { name: 'OpenRouter', tag: 'Free models · optional', looks: 'sk-or-v1-…', len: 'starts with sk-or-v1-', how: 'Sign up, open “Keys”, press “Create key”, copy it.', why: 'A second free AI for typed doubts when Gemini’s daily limit is used up.' },
  { name: 'OpenAI', tag: 'Paid · optional', looks: 'sk-proj-…', len: 'starts with sk- (usually sk-proj-)', how: 'Sign in, press “Create new secret key”, copy it. It is billed to your OpenAI account.', why: 'A paid extra for doubts; optional.' },
];

export function ApiKeyExplainer() {
  return (
    <section className="mb-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/5 p-5 text-sm" data-key-explainer>
      <h2 className="text-lg font-semibold text-white">What is an API key?</h2>
      <p className="mt-2 leading-6 text-white/70">
        The API setting is for <b>unlimited doubt clearing</b>. Your study materials are made for you by AI Guru’s teachers —
        you only need a key to ask as many doubts as you like, by camera, voice or typing. Without a key you still get a few
        free doubt minutes every day. An API key is like a password that lets AI Guru use an AI service — such as Google
        Gemini — for you. It is saved <b>only on this device</b>; AI Guru does not keep it on its server. Keep it secret and never share it.
      </p>
      <h3 className="mt-4 font-semibold text-white">What to do</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-white/70">
        <li>Scroll down to <b>Your Gemini key</b> and press its <b>Get key</b> button: Google opens in a new tab. Make the key there and copy it.</li>
        <li>Come back to this tab, paste the key in the box and press Save. AI Guru tests it at once.</li>
        <li>Optional: add an OpenRouter key (free) and an OpenAI key (paid) for more.</li>
      </ol>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {KEYS.map((k) => (
          <div key={k.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2"><b className="text-white">{k.name}</b><span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">{k.tag}</span></div>
            <p className="mt-2 text-xs text-white/60">Looks like: <code className="rounded bg-black/40 px-1.5 py-0.5 text-cyan-200">{k.looks}</code> ({k.len})</p>
            <p className="mt-1 text-xs text-white/60">{k.how}</p>
            <p className="mt-1 text-xs text-white/45">Used for: {k.why}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
