import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { arch as cpuArchitecture, platform } from 'node:os';

// Pass a module from another checkout to compare implementations with the
// same profile revisions and input documents from this working directory.
const modulePath = resolve(process.argv[2] ?? 'src/arch.studio.js');
const arch = await import(pathToFileURL(modulePath));
const uaf = JSON.parse(await readFile('profiles/uaf.json', 'utf8'));
arch.registerProfile(uaf.id, uaf);

const profile = JSON.parse(await readFile('profiles/naf41-uaf.json', 'utf8'));
arch.registerProfile(profile.id, profile);
const minimal = await readFile('examples/minimal.arch', 'utf8');
const reuse = await readFile('examples/naf41-view-reuse.arch', 'utf8');
const naf = await readFile('examples/naf41.arch', 'utf8');
const styled = await readFile('examples/style-expressions.arch', 'utf8');
const specialized = await readFile('examples/diagrams.arch', 'utf8');
const grid = await readFile('examples/viewpoint-grid.arch', 'utf8');
const foundation = await readFile('examples/naf41-foundation-viewpoints.arch', 'utf8');
const connectionHelp = '@help connections naf41-uaf OperationalPerformer';

function catalogue(size, broken = false) {
  const views = Array.from({length:size},(_, i)=>`view rescue${i} "Rescue diagram ${i}" {extends logicalDiagram}`);
  if (broken) views.push('view broken "Broken view" {extends missing}');
  return grid.replace(/\}\s*$/u,`${views.join('\n')}\n}`);
}

function syntheticDocument(nodeCount, edgeCount, views) {
  const nodes = Array.from({ length:nodeCount }, (_, i) => `service n${i} "Node ${i}"`);
  const edges = Array.from({ length:edgeCount }, (_, i) => {
    const target = (i + 1 + Math.floor(i / nodeCount)) % nodeCount;
    return `relation e${i} n${i % nodeCount} -> n${target} "Link"`;
  });
  return `architecture "Benchmark" { model {\n${nodes.join('\n')}\n${edges.join('\n')}\n}\n${views.join('\n')}\n}`;
}

const views = Array.from({ length:12 }, (_, i) => {
  const ids = Array.from({ length:65 }, (_, j) => `n${(i*50+j)%650}`);
  return `view v${i} "View ${i}" { include [${ids.join(', ')}] }`;
});
const large = syntheticDocument(650, 1600, views);
const sparse = syntheticDocument(1000, 4000, Array.from({length:160},(_,i)=>
  `view small${i} "View ${i}" {include [n${i+2}, n${i}, n${i+1}]}`));
const matrix = syntheticDocument(100, 1600, ['view matrix "Matrix" { diagram matrix }']);
const preparedReuse = arch.parse(reuse);
const preparedGrid = arch.parse(catalogue(480));
const brokenGrid = catalogue(96,true);
const opts = { views:'all', idPrefix:'benchmark' };
const jobs = [
  ['render/minimal', 200, () => arch.renderToString(minimal)],
  ['render/NAF', 25, () => arch.renderToString(naf,opts)],
  ['render/reused views', 25, () => arch.renderToString(reuse,opts)],
  ['layout/parsed reused views', 25, () => arch.layout(preparedReuse,opts)],
  ['render/calculated styles', 40, () => arch.renderToString(styled,opts)],
  ['render/specialized views', 15, () => arch.renderToString(specialized,opts)],
  ['validate/650 nodes, 12 views', 12, () => arch.validate(large)],
  ['validate/160 small views', 8, () => arch.validate(sparse)],
  ['render/650 nodes, 12 views', 4, () => arch.renderToString(large,opts)],
  ['render/100x100 matrix', 4, () => arch.renderToString(matrix,opts)],
  ['render/NAF connection help', 5, () => arch.renderToString(connectionHelp)],
  ['render/NAF full grid', 30, () => arch.renderToString(grid,{view:'allTiles'})],
  ['render/grid with 480 diagrams', 8, () => arch.renderToString(preparedGrid,{view:'modeledTiles'})],
  ['dashboard/NAF report', 20, () => arch.architectureReport(foundation)],
  ['dashboard/480-diagram report', 8, () => arch.architectureReport(preparedGrid)],
  ['dashboard/recovery report', 5, () => arch.architectureReport(brokenGrid)],
  ['dashboard/NAF export', 4, () => arch.renderDashboardToHTML(foundation)],
];
const workload = process.argv[3];
const selectedJobs = workload ? jobs.filter(([name])=>name.includes(workload)) : jobs;
if (!selectedJobs.length) throw new Error(`No workload matches ${workload}`);
console.log(`Node ${process.version} · ${platform()} ${cpuArchitecture()} · ${modulePath}`);
console.log('Median time per invocation from five batches after warm-up');
for (const [name, iterations, run] of selectedJobs) {
  const result = run();
  if (result?.valid === false) throw new Error(JSON.stringify(result));
  for (let i = 0; i < iterations; i++) run();
  const samples = [];
  for (let batch = 0; batch < 5; batch++) {
    const begin = performance.now();
    for (let i = 0; i < iterations; i++) run();
    samples.push((performance.now() - begin) / iterations);
  }
  samples.sort((a, b) => a - b);
  console.log(`${name.padEnd(31)} ${samples[2].toFixed(3).padStart(9)} ms`);
}
