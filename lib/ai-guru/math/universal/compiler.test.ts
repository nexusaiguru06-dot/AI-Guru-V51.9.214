import { describe, expect, it } from 'vitest';
import { compileUniversalMath, detectMathDomain } from './compiler';

describe('Universal Math Engine',()=>{
  it('classifies school-math domains',()=>{
    expect(detectMathDomain('211 × 3')).toBe('arithmetic');
    expect(detectMathDomain('2/3 + 1/6')).toBe('fractions');
    expect(detectMathDomain('x^2 - 5x + 6 = 0')).toBe('polynomials');
    expect(detectMathDomain('sin(x)')).toBe('trigonometry');
    expect(detectMathDomain('derivative of x^2')).toBe('calculus');
    expect(detectMathDomain('mean median mode')).toBe('statistics');
    expect(detectMathDomain('probability of getting a six')).toBe('probability');
  });
  it('produces video-style timed visual events',async()=>{
    const s=await compileUniversalMath('211 × 3',{grade:4,verify:false});
    expect(s.domain).toBe('arithmetic');
    expect(s.nodes.length).toBeGreaterThan(2);
    expect(s.events.length).toBe(s.nodes.length);
    expect(s.events.every(e=>e.durationMs>0)).toBe(true);
  });
  it('renders exactly one teaching language per pass',async()=>{
    const en=await compileUniversalMath('211 × 3',{grade:4,verify:false,language:'english'});
    const ml=await compileUniversalMath('211 × 3',{grade:4,verify:false,language:'malayalam'});
    expect(en.teachingLanguage).toBe('english');
    expect(ml.teachingLanguage).toBe('malayalam');
    expect(en.narrationCues.every(c=>c.language==='english' && !('malayalamText' in c))).toBe(true);
    expect(ml.narrationCues.every(c=>c.language==='malayalam' && /[\u0D00-\u0D7F]/.test(c.text))).toBe(true);
    expect(ml.nodes.filter(n=>n.kind==='text').every(n=>!/[A-Za-z]{3,}/.test(n.content??''))).toBe(true);
  });
  it('produces graphs for functions',async()=>{
    const s=await compileUniversalMath('f(x)=x^2',{grade:11,verify:false});
    expect(s.domain).toBe('functions');
    expect(s.nodes.some(n=>n.kind==='graph')).toBe(true);
  });
});
