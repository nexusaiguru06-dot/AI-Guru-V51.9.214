// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { matches, NAV_ITEMS } from './AiGuruTopNav';
import { hasOwnNav, OWN_NAV } from './AiGuruShell';

describe('V51.9.115 main menu', () => {
  it('every tab opens a page of its own (none just leads back home)', () => {
    for (const it of NAV_ITEMS) {
      expect(it.href, it.label).not.toBe('/ai-guru');
      const file = path.join(process.cwd(), 'app', ...it.href.split('/').filter(Boolean), 'page.tsx');
      expect(fs.existsSync(file), `${it.label} → ${it.href}`).toBe(true);
    }
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain('Flashcards');
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain('Subscription');
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain('Profile');
    // V51.9.170: 15 tabs; Whiteboard Lab and Local TTS left the menu (Local TTS is reached from Settings)
    expect(NAV_ITEMS).toHaveLength(16); // V51.9.211: Material Studio left the student menu; V51.9.215: + New Schools (the office portal)
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain('Whiteboard Lab');
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain('Local TTS');
  });
  it('the right tab lights up', () => {
    expect(matches('/ai-guru/student', '/ai-guru/student')).toBe(true);
    expect(matches('/ai-guru/student/signup', '/ai-guru/student')).toBe(true);
    expect(matches('/ai-guru/student/library', '/ai-guru/student')).toBe(false); // that is My Textbooks
    expect(matches('/ai-guru/student/library', '/ai-guru/student/library')).toBe(true);
    expect(matches('/ai-guru/teacher-notes', '/ai-guru/teacher')).toBe(false);
    expect(matches('/ai-guru/teacher/avatar', '/ai-guru/teacher')).toBe(true);
  });
  it('pages that draw the menu themselves are not given a second one; the rest get it', () => {
    for (const p of OWN_NAV) {
      expect(hasOwnNav(p)).toBe(true);
      const src = ['app', ...p.split('/').filter(Boolean)].join('/');
      expect(fs.existsSync(path.join(process.cwd(), src)), p).toBe(true);
    }
    expect(hasOwnNav('/ai-guru/settings/local-tts')).toBe(true);
    for (const p of ['/ai-guru/student', '/ai-guru/student/signup', '/ai-guru/teacher', '/ai-guru/parent', '/ai-guru/learn', '/ai-guru/lab3d', '/ai-guru/admin', '/ai-guru/safety']) expect(hasOwnNav(p), p).toBe(false);
  });
});
