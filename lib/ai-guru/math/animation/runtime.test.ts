import { describe, expect, it } from 'vitest';
import type { UniversalMathScene } from '../universal/types';
import { createRuntimeSnapshot, sceneDurationMs } from './runtime';

const scene: UniversalMathScene = {
  schemaVersion:'1.0', id:'runtime-test', domain:'geometry', gradeBand:'6-8', title:'Triangle', expression:'A=1/2bh', verified:true,
  nodes:[
    {id:'triangle',kind:'shape',shape:'triangle',x:100,y:100,width:200,height:160},
    {id:'rectangle',kind:'shape',shape:'rectangle',x:100,y:100,width:400,height:160},
  ],
  events:[
    {id:'e1',atMs:0,durationMs:500,kind:'draw',targetId:'triangle'},
    {id:'e2',atMs:500,durationMs:800,kind:'transform',targetId:'rectangle',fromObjectId:'triangle',toObjectId:'rectangle'},
    {id:'e3',atMs:1300,durationMs:400,kind:'highlight',targetId:'triangle',cueWords:[{word:'half',atMs:1450}]},
    {id:'e4',atMs:1700,durationMs:600,kind:'camera',targetId:'rectangle',camera:{action:'zoom',scale:1.5}},
  ],
  narrationCues:[], teachingLanguage:'english'
};

describe('Sprint C animation runtime',()=>{
  it('interpolates persistent objects and exposes camera state',()=>{
    const mid=createRuntimeSnapshot(scene,900);
    expect(mid.nodes.get('rectangle')?.x).toBeGreaterThanOrEqual(100);
    expect(mid.nodes.get('rectangle')?.width).toBeGreaterThan(200);
    expect(mid.nodes.get('rectangle')?.opacity).toBeGreaterThan(0);
    expect(mid.nodes.get('triangle')?.opacity).toBeLessThan(1);
    const end=createRuntimeSnapshot(scene,2300);
    expect(end.camera.scale).toBe(1.5);
    expect(end.camera.x).toBe(300);
    expect(end.camera.y).toBe(180);
    expect(end.nodes.get('triangle')?.highlighted).toBe(false);
    expect(sceneDurationMs(scene)).toBe(2300);
  });
});
