/** The toffee reward: a red wrapped sweet with striped twisted ends (like the AI Guru toffee). Pure SVG, any size. */
export function Toffee({ size = 28, className = '', title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 64 32" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id="tf-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7a3d" /><stop offset=".55" stopColor="#e2351f" /><stop offset="1" stopColor="#a9150f" /></linearGradient>
        <linearGradient id="tf-foil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#e9eef5" /><stop offset="1" stopColor="#b9c3d1" /></linearGradient>
      </defs>
      <path d="M1 7 L15 10 L15 22 L1 25 Q4 16 1 7Z" fill="url(#tf-foil)" />
      <path d="M63 7 L49 10 L49 22 L63 25 Q60 16 63 7Z" fill="url(#tf-foil)" />
      <g stroke="#d1261b" strokeWidth="1.6"><path d="M5 8.5V24M9 9.3V23M13 10V22" /><path d="M59 8.5V24M55 9.3V23M51 10V22" /></g>
      <ellipse cx="32" cy="16" rx="21" ry="12.5" fill="url(#tf-body)" />
      <ellipse cx="29" cy="10.5" rx="12" ry="4" fill="#fff" opacity=".28" />
      <circle cx="42" cy="12" r="3.4" fill="none" stroke="#ffd9b8" strokeWidth=".9" opacity=".55" /><circle cx="22" cy="21" r="2.6" fill="none" stroke="#ffd9b8" strokeWidth=".9" opacity=".5" />
    </svg>
  );
}
