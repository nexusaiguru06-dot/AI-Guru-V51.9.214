'use client';

/** V51.9.169 — the sun / moon switch in the menu bar: Day or Night, kept on this device. */
import { useEffect, useState } from 'react';
import { currentTheme, onThemeChange, setTheme, type Theme } from '@/lib/ai-guru/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [t, setT] = useState<Theme>('night');
  useEffect(() => { setT(currentTheme()); return onThemeChange(setT); }, []);
  const night = t === 'night';
  const label = night ? 'Switch to day mode' : 'Switch to night mode';
  const knob = 'flex h-[34px] w-[34px] items-center justify-center rounded-full transition';
  return (
    <button type="button" onClick={() => setTheme(night ? 'day' : 'night')} aria-label={label} title={label}
      className={`flex h-11 items-center gap-1 rounded-full border border-[color:var(--ag-line)] bg-[color:var(--ag-tile)] p-1 ${className}`}>
      <span className={`${knob} ${night ? 'text-[color:var(--ag-muted)]' : 'bg-[#F5B83D] text-[#1A1203]'}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      </span>
      <span className={`${knob} ${night ? 'bg-[#2A3658] text-[#F7C661]' : 'text-[color:var(--ag-muted)]'}`}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
      </span>
    </button>
  );
}

export default ThemeToggle;
