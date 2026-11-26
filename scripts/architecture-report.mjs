import { readFile, readdir } from 'node:fs/promises';
import { architectureReport, ArchError, registerIconPack, registerProfile, renderDashboardToHTML } from '../src/arch.studio.js';
import { orderProfiles } from './profile-order.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const files = args.filter(arg => !flags.has(arg));
if (files.length!==1 || [...flags].some(flag=>!['--draft','--vim','--html'].includes(flag)) ||
    flags.has('--vim') && flags.has('--html')) {
  console.error('Usage: node scripts/architecture-report.mjs FILE [--draft] [--vim | --html]');
  process.exit(2);
}
const [file] = files;
const folder = new URL('../profiles/',import.meta.url);
const definition = async name => JSON.parse(await readFile(new URL(name,folder),'utf8'));
const profiles = await Promise.all((await readdir(folder)).filter(name=>name.endsWith('.json')).map(definition));
const frozenFolder = new URL('naf41/revisions/',folder);
const frozen = await Promise.all((await readdir(frozenFolder)).filter(name=>name.endsWith('.json')).sort((a,b) =>
  a.localeCompare(b,'en',{numeric:true})).map(name=>definition('naf41/revisions/'+name)));
for (const profile of orderProfiles(profiles)) {
  if (profile.id==='naf41-uaf') for (const revision of frozen) registerProfile(revision.id,revision);
  registerProfile(profile.id,profile);
}
for (const id of ['bootstrap','lucide','tabler']) {
  const source = await readFile(new URL(`../icons/${id}.json`,import.meta.url),'utf8');
  registerIconPack(id,JSON.parse(source));
}

const strict = !flags.has('--draft') && !flags.has('--html');
const options = {validation:strict?'strict':'draft',syntaxRecovery:!strict,checkRendering:true};
try {
  const source = await readFile(file,'utf8');
  if (flags.has('--html')) process.stdout.write(renderDashboardToHTML(source,options));
  else {
    const report = architectureReport(source,options);
    if (flags.has('--vim')) {
      for (const issue of report.diagnostics) {
        const candidates = issue.candidates?.length ? ` Candidates: ${issue.candidates.join(', ')}` : '';
        console.log(`${file}:${issue.line ?? 1}:${issue.column ?? 1}: ${issue.severity==='error'?'E':'W'}: ${issue.message.replace(/\s+/g,' ')}${candidates}`);
      }
    } else console.log(JSON.stringify(report,null,2));
    process.exitCode = report.diagnostics.some(issue=>issue.severity==='error')?1:0;
  }
} catch (error) {
  if (!(error instanceof ArchError) && !error.code) throw error;
  if (flags.has('--vim')) console.error(`${file}:${error.line ?? 1}:${error.column ?? 1}: E: ${error.message}`);
  else console.error(error.message);
  process.exitCode = 1;
}
