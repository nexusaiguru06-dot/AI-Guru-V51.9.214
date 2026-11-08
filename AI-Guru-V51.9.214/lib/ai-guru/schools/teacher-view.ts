/**
 * V51.9.193 — what a school teacher works on (server only): the books of their subject and standards (in their school's
 * syllabus), each book's materials (the AI ones and the school's teacher versions), and their students.
 */
import { listDocuments, listMaterials } from '../material-studio/store';
import { buildStudyParts, partOfMaterial } from '../material-studio/parts';
import { readData } from '../admin/store';
import { teacherCovers, type School, type SchoolTeacher } from './rules';
import type { StudyMaterial } from '../material-studio/types';

export async function teacherBooks(t: SchoolTeacher, school: School) {
  const docs = (await listDocuments()).filter((d) => !d.hidden && teacherCovers(t, d, school.syllabus));
  const mats = await listMaterials();
  return docs.map((d) => {
    const parts = buildStudyParts(d);
    const ms = mats.filter((m) => m.documentId === d.id && !m.hidden && (!m.school || m.school === school.id));
    const replaced = new Set(ms.filter((m) => m.school && m.basedOn).map((m) => m.basedOn!));
    return {
      id: d.id, fileName: d.fileName, subject: d.subject, grade: d.grade, syllabus: d.syllabus, pageCount: d.pageCount,
      parts: parts.map((p) => ({ index: p.index, startPage: p.startPage, endPage: p.endPage, chapters: p.chapters.map((c) => c.title) })),
      materials: ms.map((m) => ({ id: m.id, type: m.type, title: m.title, part: partOfMaterial(m, parts), sections: m.sections.length, mine: m.teacher?.id === t.id, teacher: m.teacher?.name ?? null, basedOn: m.basedOn ?? null, replaced: replaced.has(m.id), updatedAt: m.updatedAt || m.createdAt })),
    };
  });
}

/** The teacher may open / edit this material: the book is theirs and the material is shared or their school's. */
export async function teacherMayUse(t: SchoolTeacher, school: School, m: Pick<StudyMaterial, 'documentId' | 'school' | 'hidden'>, docs?: Awaited<ReturnType<typeof listDocuments>>) {
  const d = (docs ?? (await listDocuments())).find((x) => x.id === m.documentId);
  return !!d && teacherCovers(t, d, school.syllabus) && (!m.school || m.school === school.id);
}

export async function teacherStudents(t: SchoolTeacher) {
  const data = await readData();
  return data.students.filter((s) => s.schoolLink?.schoolId === t.schoolId && t.standards.includes(String(Number(String(s.standard).match(/\d+/)?.[0] ?? s.standard))))
    .map((s) => ({ id: s.id, studentCode: s.studentCode ?? '', name: s.name, standard: s.standard, joinedWithMe: s.schoolLink?.teacherId === t.id, joined: s.createdAt.slice(0, 10) }));
}
