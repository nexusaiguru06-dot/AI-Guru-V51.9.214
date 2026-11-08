/** The chilli: the reward-system's "not this time" (a red chilli with a green stem, like the toffee it is the pair of). Pure SVG, any size. */
export function Chilli({ size = 28, className = '', title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size * 0.5} height={size} viewBox="0 0 32 64" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id="ch-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b3120f" /><stop offset=".45" stopColor="#ee2a1f" /><stop offset="1" stopColor="#c8160f" /></linearGradient>
        <linearGradient id="ch-stem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6fb43a" /><stop offset="1" stopColor="#2f7a1c" /></linearGradient>
      </defs>
      <path d="M13 1 Q11 8 15 12 L22 12 Q18 6 17 1Z" fill="url(#ch-stem)" />
      <path d="M11 13 Q12 10 18 10 Q25 10 26 15 Q31 30 25 44 Q20 56 9 63 Q4 61 7 55 Q14 44 13 32 Q12 22 10 18 Q9 15 11 13Z" fill="url(#ch-body)" />
      <path d="M13 12 Q16 8 22 11 Q18 15 13 14Z" fill="url(#ch-stem)" />
      <path d="M17 18 Q21 30 18 42" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".5" />
    </svg>
  );
}
