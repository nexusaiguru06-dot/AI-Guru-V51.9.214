/**
 * The daily five-minute challenge: five questions picked from the public lessons, the same five for everybody on a given
 * Indian-time day (so friends can compare), a streak of days done, and a calendar reminder (.ics) that repeats every day.
 */
import { LESSONS, type Q } from './lessons';

export interface DailyQ extends Q { slug: string; lesson: string }

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };

/** Today's date in India as YYYY-MM-DD. */
export const istToday = (now = Date.now()) => new Date(now + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** Five questions for a day: one from each of five different lessons (there are six), in an order that depends only on the date. */
export function dailyFive(day: string): DailyQ[] {
  const r = rng(hash(`aiguru-daily-${day}`));
  const lessons = [...LESSONS].map((l) => ({ l, k: r() })).sort((a, b) => a.k - b.k).slice(0, 5).map((x) => x.l);
  return lessons.map((l) => { const q = l.quiz[Math.floor(r() * l.quiz.length)]; return { ...q, slug: l.slug, lesson: l.title.en }; });
}

/** Days in a row up to today (or up to yesterday: today's challenge is still to do). */
export function dailyStreak(done: string[], today: string): number {
  const set = new Set(done);
  const prev = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  let d = set.has(today) ? today : prev(today), n = 0;
  while (set.has(d)) { n++; d = prev(d); }
  return n;
}

/** A calendar file with a daily 5 pm (India time) reminder. Opens in Google Calendar, Apple Calendar and Outlook. */
export function reminderIcs(link: string, hour = 17, start = istToday()): string {
  const d = start.replace(/-/g, ''), hh = String(hour).padStart(2, '0');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AI Guru//Daily challenge//EN', 'BEGIN:VEVENT', `UID:aiguru-daily-${d}@aiguru`, `DTSTAMP:${d}T000000Z`, `DTSTART;TZID=Asia/Kolkata:${d}T${hh}0000`, `DTEND;TZID=Asia/Kolkata:${d}T${hh}0500`, 'RRULE:FREQ=DAILY', 'SUMMARY:AI Guru five-minute challenge', `DESCRIPTION:Five questions, five minutes. Keep your streak alive: ${link}`, `URL:${link}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
