import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const registryPath = path.join(root, 'data/ai-guru/reference-styles/ai-guru-reference-video-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const assets = Array.isArray(registry.assets) ? registry.assets : [];
const errors = [];
if (assets.length !== registry.assetCount) errors.push(`assetCount=${registry.assetCount} but registry contains ${assets.length} assets`);
const ids = new Set();
for (const asset of assets) {
  if (ids.has(asset.id)) errors.push(`duplicate asset id: ${asset.id}`);
  ids.add(asset.id);
  for (const key of ['id','file','originalFilename','durationSeconds','width','height','fps','mimeType','styleId','qaProfileId','subject','domains','suggestedGrades','concepts','selectionTerms','teachingMethods','teachingPrompt','qaInstructions']) {
    if (asset[key] === undefined || asset[key] === null || (Array.isArray(asset[key]) && asset[key].length === 0) || asset[key] === '') errors.push(`${asset.id}: missing ${key}`);
  }
  if (asset.approved !== true) errors.push(`${asset.id}: must be approved=true`);
  if (asset.doNotCopyContent !== true) errors.push(`${asset.id}: must set doNotCopyContent=true`);
}
if(errors.length){
  console.error('REFERENCE VIDEO LIBRARY AUDIT: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`REFERENCE VIDEO LIBRARY AUDIT: PASS — ${assets.length} registered metadata assets.`);
console.log('Reference media binaries are optional/external and are not required by the production lesson runtime.');
