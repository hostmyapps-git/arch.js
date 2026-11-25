import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import { getProfile, registerProfile } from '../src/profiles.js';
import { createAdmbwDefinition } from '../profiles/admbw/catalog.mjs';
import { createArchiMateDefinitions } from '../profiles/naf41-archimate/catalog.mjs';

const naf='ReferenceDocs/nafv4/NATO-Architecture-Framework-v4-1-en.pdf';
const mdg='ReferenceDocs/nafv4/NAFv4-ADMBw-MDG-2026.05.xml';
const admbwBase='naf41-uaf@4.1.0-arch.43';
const json=value=>JSON.stringify(value,null,2)+'\n';

export async function buildAdmbw() {
  // buildNaf41Profile verifies both source checksums before registering the base.
  const doc=new DOMParser({onError:(level,message)=>{throw new Error(`${level}: ${message}`);}})
    .parseFromString(new TextDecoder('windows-1252').decode(await readFile(mdg)),'application/xml');
  const base=getProfile(admbwBase);
  const {definition,coverage,externalTargets}=createAdmbwDefinition(doc,base,{naf,mdg});
  const profile=registerProfile(definition.id,definition);
  const counts=Object.fromEntries(Object.entries(Object.groupBy(Object.values(coverage),entry=>entry.status)).map(([status,entries])=>[status,entries.length]));
  await writeFile('profiles/naf41-admbw.json',json(definition));
  await writeFile('profiles/admbw/coverage.json',json({id:profile.id,version:profile.version,base:definition.extends,
    counts,viewpoints:Object.keys(profile.viewpoints),externalTargets,stereotypes:coverage}));
}

export async function buildNaf41ArchiMate() {
  const directory='profiles/naf41-archimate';
  const lock=JSON.parse(await readFile(directory+'/sources.lock.json','utf8'));
  const verified = async entry => {
    const bytes=await readFile(entry.file);
    if (createHash('sha256').update(bytes).digest('hex')!==entry.sha256)
      throw new Error(`ArchiMate source checksum mismatch: ${entry.file}`);
    return bytes;
  };
  const [matrix,mappings]=await Promise.all([verified(lock.matrix),verified(lock.mappings),verified(lock.guide)]);
  const parent=getProfile('naf41-uaf');
  const {archimate,naf41,coverage}=createArchiMateDefinitions(JSON.parse(matrix),JSON.parse(mappings),parent,
    {naf,guide:lock.guide.url,standard:lock.standard,matrix:lock.matrix.url});
  registerProfile(archimate.id,archimate);
  registerProfile(naf41.id,naf41);
  const keys=Object.keys(parent.viewpoints);
  if (keys.length!==Object.keys(coverage).length||keys.some(id=>!Object.hasOwn(coverage,id)))
    throw new Error('The NAF and NAF ArchiMate viewpoint catalogs disagree');
  await Promise.all([
    writeFile('profiles/archimate-3.2.json',json(archimate)),
    writeFile('profiles/naf41-archimate.json',json(naf41)),
    writeFile(directory+'/coverage.json',json({id:naf41.id,version:naf41.version,sources:lock,viewpoints:coverage}))
  ]);
}
