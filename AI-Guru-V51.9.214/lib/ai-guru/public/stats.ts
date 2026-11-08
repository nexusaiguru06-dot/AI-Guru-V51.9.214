import { readData } from '../admin/store';
import { readAll } from '../quiz/server-store';

export interface PublicStats { students: number; quizzes: number; toffees: number; schools: number; classes: number; testimonials: Array<{ text: string; by: string }> }
/** The real numbers for the landing page: counted from the data, never typed in. A zero is left for the page to hide. */
export async function publicStats(): Promise<PublicStats> {
  const [d, recs] = await Promise.all([readData(), readAll()]);
  const real = recs.filter((r) => r.kind !== 'redo');
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return {
    students: d.students.length,
    quizzes: real.length,
    toffees: recs.reduce((t, r) => t + (r.toffees || 0), 0),
    schools: new Set(d.students.map((s) => norm(s.school ?? '')).filter(Boolean)).size,
    classes: d.classes.filter((c) => c.active).length,
    testimonials: d.classes.filter((c) => c.testimonial).map((c) => ({ text: c.testimonial!, by: `${c.teacherName}, ${c.name}` })).slice(0, 6),
  };
}
