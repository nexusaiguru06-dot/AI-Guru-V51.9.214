import { describe, expect, it } from 'vitest';
import { createTwoPassSequence, createLanguagePass } from './language-pass';

const track=(text:string)=>({text, visuals:[] as any[]});

describe('AI Guru language two-pass',()=>{
  it('keeps English first and Malayalam second',()=>{
    const seq=createTwoPassSequence(createLanguagePass('english',track('Explain'),{}),createLanguagePass('malayalam',track('വിശദീകരിക്കുക'),{}));
    expect(seq.map(x=>x.language)).toEqual(['english','malayalam']);
  });
});
