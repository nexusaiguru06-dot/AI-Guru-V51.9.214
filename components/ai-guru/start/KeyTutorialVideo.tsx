/** V51.9.211 — a 45-second video above the Gemini key box: how to make the key and paste it. */
export function KeyTutorialVideo() {
  return (
    <section className="mb-5 rounded-2xl border border-cyan-300/30 bg-cyan-300/5 p-4" data-key-tutorial>
      <h2 className="text-base font-semibold text-white">🎬 Watch: how to paste your Gemini API key (45 seconds)</h2>
      <p className="mt-1 text-xs text-white/60">Your key gives you unlimited doubt clearing. Watch once, then follow the same steps below.</p>
      <video
        className="mx-auto mt-3 max-h-[70vh] w-full max-w-[320px] rounded-xl bg-black"
        controls playsInline preload="metadata"
        poster="/ai-guru/tutorials/how-to-paste-gemini-api-key.jpg"
        src="/ai-guru/tutorials/how-to-paste-gemini-api-key.mp4"
        aria-label="Tutorial: how to make a free Gemini API key and paste it in AI Guru"
      >
        Your browser cannot play this video.
      </video>
    </section>
  );
}
