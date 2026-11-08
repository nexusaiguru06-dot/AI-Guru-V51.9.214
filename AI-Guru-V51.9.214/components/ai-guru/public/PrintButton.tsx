'use client';
export function PrintButton() { return <button onClick={() => window.print()} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5 print:hidden">Print or save as PDF</button>; }
