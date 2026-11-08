import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const manifestPath = path.join(root, 'data/ai-guru/reference-styles/area-formula-segments-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const shapeSegments = manifest.segments.filter(s => s.shape);
const expected = ['rectangle','square','triangle','parallelogram','rhombus','trapezium'];
const errors = [];
if (shapeSegments.map(s=>s.shape).join('|') !== expected.join('|')) errors.push('Shape segment order/content mismatch');
if (shapeSegments[0]?.sourceStartMs !== 6000) errors.push('First shape segment must start after the intro');
if (shapeSegments.at(-1)?.sourceEndMs !== manifest.sourceDurationMs) errors.push('Shape segments do not cover the source to its end');
for (let i=1;i<shapeSegments.length;i++) if (shapeSegments[i].sourceStartMs !== shapeSegments[i-1].sourceEndMs) errors.push(`Gap/overlap between ${shapeSegments[i-1].id} and ${shapeSegments[i].id}`);
for (const s of manifest.segments) if (s.qaProfileId !== 'geometry-area-derivation-v2') errors.push(`Unexpected QA profile: ${s.id}`);
console.log(`Reference segments: ${manifest.segments.length} total / ${shapeSegments.length} shape segments`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('REFERENCE_SEGMENT_AUDIT_PASS (metadata-only; media is external/optional)');
