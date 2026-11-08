/** Student side of the register: tells the server when the classroom is opened, that it is still open, and when it is left. */
import { currentStudentId } from '../motion-class/interactive/progress';
import { BEAT_MS } from './register';

const NAME_KEY = 'ai-guru:student-name';
const URL_ = '/api/ai-guru/attendance';

function name(): string { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }

export function startAttendance(): () => void {
  if (typeof window === 'undefined') return () => {};
  const sessionId = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const studentId = currentStudentId();
  const send = (type: 'start' | 'beat' | 'end', beacon = false) => {
    const body = JSON.stringify({ type, sessionId, studentId, studentName: name() });
    try {
      if (beacon && navigator.sendBeacon) { navigator.sendBeacon(URL_, new Blob([body], { type: 'application/json' })); return; }
      void fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch { /* offline: the register just misses this beat */ }
  };
  send('start');
  const timer = window.setInterval(() => { if (document.visibilityState === 'visible') send('beat'); }, BEAT_MS);
  const onHide = () => { if (document.visibilityState === 'hidden') send('end', true); else send('beat'); };
  const onPageHide = () => send('end', true);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onPageHide); send('end'); };
}
