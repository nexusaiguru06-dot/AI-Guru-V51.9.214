import { describe, expect, it } from 'vitest';
import { cleanProfile, cleanWhatsapp, profileIsEmpty, profileLines, profileWhatsapp } from './profile';

describe('student profile', () => {
  it('cleans and limits the fields', () => {
    const p = cleanProfile({ name: '  Anjali   Menon ', standard: '8', school: 'x'.repeat(100), place: 5 });
    expect(p.name).toBe('Anjali Menon');
    expect(p.school.length).toBe(60);
    expect(p.place).toBe('');
  });
  it('writes the footer lines', () => {
    expect(profileLines({ name: 'Anjali', standard: '8', school: 'GHSS', place: 'Kochi' })).toEqual(['Anjali · Std 8', 'GHSS, Kochi']);
    expect(profileLines({ name: '', standard: '', school: '', place: '' })).toEqual([]);
    expect(profileIsEmpty(null)).toBe(true);
  });
  it('V51.9.125: WhatsApp number only when switched on, and only a real number', () => {
    expect(cleanWhatsapp('+91 98470-12345')).toBe('+91 98470 12345');
    expect(cleanWhatsapp('12345')).toBe('');
    expect(cleanWhatsapp('call me')).toBe('');
    const p = cleanProfile({ name: 'Anu', whatsapp: '+91 98470 12345', whatsappOnReels: true });
    expect(profileWhatsapp(p)).toBe('+91 98470 12345');
    expect(profileWhatsapp(cleanProfile({ whatsapp: '+91 98470 12345' }))).toBe('');
    expect(cleanProfile({ whatsapp: 'x', whatsappOnReels: true }).whatsappOnReels).toBe(false);
  });
});
