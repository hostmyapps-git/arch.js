import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
import { inspectPath } from '../src/svg-path.js';

const source = (body, views = '') => `architecture "Test" { model { ${body} } ${views} }`;
const pair = 'service a "A" service b "B" relation e a -> b "Calls"';
const box = (graph, id) => graph.nodes.find(n => n.id === id);

test('parser: Unicode, JSON escapes, comments, optional semicolons, and forward references', () => {
  const m = arch.parse(source('// comment\nrelation e a->b "Überträgt"; person a "A\\nB" { description "quote: \\\"" } # another\nservice b "B"'));
  assert.equal(m.nodes[0].title, 'A\nB'); assert.equal(m.edges[0].target, 'b');
  assert.equal(m.views[0].id, 'default');
});

test('parser: invalid input has stable codes and exact source positions', () => {
  assert.throws(() => arch.parse('architecture "T" {\n model {\n unknown a "A"\n }\n}'), error =>
    error instanceof arch.ArchError && error.line === 3 && error.column === 2 && error.code === 'ARCH_VALIDATION');
  for (const invalid of [
    'architecture "T" {}', 'architecture "T" { model {} model {} }',
    source('service a "A" service a "B"'), source('relation e a -> b "Missing"'),
    source('service a "A" { invalid "x" }'), source('service a "A" { description "a" description "b" }'),
    source('service a "A" { service b "B" }'), source(pair, 'view x "X" { direction left }'),
    source(pair, 'view x "X" { theme blue }'), source(pair, 'view x "X" { place a at (1, 2) size (12, 12) }'),
    source(pair, 'view x "X" { include missing }'), source(pair, 'view x "X" { route missing { curve straight } }'),
    source(pair, 'view x "X" { style a { accent "url(evil)" } }'),
    source(pair, 'view x "X" { style a { template package } }'),
    source('package p "P"', 'view x "X" { style p { template service } }'),
    source(pair, 'view x "X" { route e { curve bezier via (1,2) } }'),
    source(pair, 'view x "X" { place a at (0,0) place a at (1,1) }'),
    source(pair, 'view x "X" {} view x "X" {}'),
    source('service a "A" relation r a -> a "" { type unknown }'),
    source(pair, 'view x "X" { spacing 0 }'), source(pair, 'view x "X" { route e { from diagonal } }'),
    source('service a "bad\\x"'), source('service a "unclosed'), source(pair) + ' extra',
    source('service a "bad\\u0000"'), source('service a "bad\\ud800"'),
    source(pair, 'view v "V" { style a { accent "" } }'),
    source(pair, 'view v "V" { route e { curve "" } }'),
  ]) assert.throws(() => arch.parse(invalid), arch.ArchError, invalid);
});

test('all shipped examples render every view and preserve semantic data', async () => {
  for (const name of ['platform', 'manual', 'capabilities', 'minimal']) {
    const m = arch.parse(await readFile(`examples/${name}.arch`, 'utf8')), snapshot = JSON.stringify(m);
    for (const view of m.views) {
      const graph = arch.layout(m, { view: view.id });
      assert.ok(graph.bounds.width > 0 && graph.bounds.height > 0);
      assert.match(arch.renderToString(m, { view: view.id }), /^<svg/);
      assert.deepEqual(arch.layout(m, { view: view.id }), graph);
    }
    assert.equal(JSON.stringify(m), snapshot);
  }
});

test('views isolate filters, placement, templates, and themes from the model', () => {
  const m = arch.parse(source('person user "User" package p "P" { service a "A" database b "B" } service other "Other" relation e a -> b ""', `
    view all "All" {}
    view detail "Detail" { include a style a { template component accent "#abc" } place a at (80, 90) }
    view subtree "Subtree" { include p theme dark }
  `));
  const graph = arch.layout(m, { view: 'detail' });
  assert.deepEqual(graph.nodes.map(n => n.id), ['p', 'a']); assert.equal(graph.edges.length, 0);
  assert.equal(box(graph, 'a').x - box(graph, 'p').x, 108);
  assert.equal(box(graph, 'a').y - box(graph, 'p').y, 162);
  assert.equal(box(graph, 'a').template, 'component'); assert.equal(m.nodes.find(n => n.id === 'a').type, 'service');
  assert.equal(arch.layout(m, { view: 'subtree' }).nodes.length, 3);
  assert.match(arch.renderToString(m, { view: 'subtree' }), /data-arch-svg="dark"/);
  assert.throws(() => arch.layout(m, { view: 'missing' }), /Unknown view/);
});

test('auto layout follows relationships, respects sizes, and avoids fixed nodes', () => {
  const m = arch.parse(source(pair + ' service c "C"', 'view v "V" { place c at (300, 0) size (300, 150) }'));
  const graph = arch.layout(m);
  assert.equal(box(graph, 'c').x, 300); assert.equal(box(graph, 'c').width, 300);
  assert.ok(box(graph, 'b').x > box(graph, 'a').x);
  assert.ok(box(graph, 'b').y >= 150);
  const down = arch.layout(arch.parse(source(pair, 'view v "V" { direction down }')));
  assert.ok(box(down, 'b').y > box(down, 'a').y);
});

test('cycles, self edges, and disconnected components produce finite layouts', () => {
  const graph = arch.layout(arch.parse(source(pair + ' relation back b -> a "Back" relation self a -> a "Self" service c "C"')));
  for (const n of graph.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
  assert.ok(graph.edges.find(e => e.id === 'self').points.length >= 4);
  assert.notEqual(graph.edges[0].d, graph.edges[1].d);
});

test('low spacing keeps automatic card stacking finite with and without fixed collisions', () => {
  const file = new URL('../src/arch.js', import.meta.url).href;
  // A subprocess timeout catches a synchronous placement loop without
  // hanging the test worker if the regression ever returns.
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { layout } from ${JSON.stringify(file)};
    const positions = [];
    for (const direction of ['right', 'down']) for (const fixed of ['', ' place a at (0,0)']) {
      const source = 'architecture "A" { model { service a "A" service b "B" service c "C" }'
        + ' view v "V" { spacing 24 direction ' + direction + fixed + ' } }';
      const axis = direction === 'right' ? 'y' : 'x';
      positions.push(layout(source).nodes.map(node => [node[axis], node[axis] + node[axis === 'y' ? 'height' : 'width']]));
    }
    console.log(JSON.stringify(positions));
  `], { encoding:'utf8', timeout:5000 });
  for (const ranks of JSON.parse(output)) {
    assert.equal(ranks[0][0], 0);
    for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i][0] >= ranks[i-1][1]+24);
  }
});

test('manual ports, waypoints, labels, and Bezier control points are exact', () => {
  const graph = arch.layout(arch.parse(source(pair, `view v "V" {
    place a at (-200, 20) size (200, 140) place b at (400, 300)
    route e { from (0,90) to (400,370) via (80,90), (80,370) label (120,210) curve rounded }
  }`)));
  const edge = graph.edges[0]; assert.match(edge.d, /^M 0 90/); assert.match(edge.d, /Q 80 90/);
  assert.deepEqual(edge.label, { x: 120, y: 210 }); assert.ok(graph.bounds.x < -200);
  const bezier = arch.layout(arch.parse(source(pair, 'view v "V" { route e { curve bezier via (10,20), (30,40) } }')));
  assert.match(bezier.edges[0].d, /C 10 20 30 40/);
  const path = 'M -300 -400 C -300 -900 900 20 1000 20';
  const custom = arch.layout(arch.parse(source(pair, `view v "V" { route e { path "${path}" } }`)));
  assert.equal(custom.edges[0].d, path); assert.ok(custom.bounds.y < -900); assert.ok(custom.bounds.width > 1300);
});

test('parallel routes separate collinear edges and orthogonal waypoints add elbows', () => {
  const graph = arch.layout(arch.parse(source(pair + ' relation second a -> b "Again"')));
  assert.ok(graph.edges[1].points.some(point => point.y !== graph.edges[0].points[0].y));
  const via = arch.layout(arch.parse(source(pair, 'view v "V" { route e { via (250,200), (280,140) } }'))).edges[0];
  for (let i = 1; i < via.points.length; i++)
    assert.ok(via.points[i - 1].x === via.points[i].x || via.points[i - 1].y === via.points[i].y);
});

test('straight routes keep two endpoints for parallel and reverse edges while explicit waypoints remain intact',()=>{
  const body=pair+' relation repeat a -> b "Again" relation reply b -> a "Reply"';
  for(const rules of ['routes {curve straight from right 0.4 to left 0.6}',
    'route repeat {curve straight from right 0.4 to left 0.6} route reply {curve straight from left 0.6 to right 0.6}']) {
    const graph=arch.layout(source(body,`view v "V" {place a at (0,0) place b at (600,0) ${rules}}`));
    for(const id of ['repeat','reply']) {
      const edge=graph.edges.find(e=>e.id===id);assert.equal(edge.points.length,2,id);
      assert.equal((edge.d.match(/ L /g)??[]).length,1);
    }
  }
  const graph=arch.layout(source(body,'view v "V" {route reply {curve straight via (300,400)}}'));
  assert.equal(graph.edges[2].points.length,3);assert.deepEqual(graph.edges[2].points[1],{x:300,y:400});
});

test('path grammar accepts SVG curves, relative commands, arcs and rejects injection and malformed paths', () => {
  for (const d of ['M0 0h20v20z', 'm1 2 3 4 5 6', 'M0,0C1,2,3,4,5,6S9,10,11,12', 'M0 0Q10 20 30 40T50 60', 'M0 0A20 30 45 1 0 50 60'])
    assert.ok(inspectPath(d).length);
  for (const d of ['', 'L0 0', 'M0', 'M0 0L', 'M0 0Lfoo', 'M0 0Z1 2', 'M0 0A-1 3 0 0 0 1 1', 'M0 0A1 3 0 2 0 1 1', 'M0 0"/><script>evil()</script>', 'M0 0L1e999 0'])
    assert.throws(() => inspectPath(d), arch.ArchError, d);
  assert.throws(() => arch.renderToString(source(pair, 'view v "V" { route e { path "" } }')), /SVG path/);
});

test('iconpacks are validated atomically, copied, and safe against prototype identifiers', () => {
  const pack = { width: 24, icons: { cloud: { paths: ['M1 2h10v10Z'] } } };
  arch.registerIconPack('custom', pack); pack.icons.cloud.paths[0] = '<script>';
  assert.ok(arch.getIconPacks().includes('custom'));
  const s = source('service a "A" { icon custom.cloud }');
  assert.match(arch.renderToString(s), /d="M1 2h10v10Z"/);
  assert.throws(() => arch.registerIconPack('custom', { icons: { broken: { paths: ['<script>'] } } }));
  assert.doesNotThrow(() => arch.renderToString(s));
  for (const bad of [null, {}, { icons: {} }, { width: 0, icons: { x: { paths: ['M0 0'] } } }, { icons: { x: { paths: [] } } }])
    assert.throws(() => arch.registerIconPack('bad', bad), arch.ArchError);
  assert.throws(() => arch.renderToString(source('service a "A" { icon missing.cloud }')), /Unknown icon/);
  assert.doesNotThrow(() => arch.renderToString(source('service __proto__ "Safe" service constructor "Also safe"', 'view v "V" { style __proto__ { accent "#123456" } }')));
});

test('SVG text is escaped, markers are isolated, themes and prefixes are validated', () => {
  const s = source('service a "<script>alert(1)</script> & \\\"text\\\""');
  const svg = arch.renderToString(s, { idPrefix: 'test' });
  assert.ok(!svg.includes('<script>')); assert.match(svg, /&lt;script&gt;/); assert.match(svg, /id="test-title"/);
  assert.notEqual(arch.renderToString(s), arch.renderToString(s));
  assert.throws(() => arch.renderToString(s, { idPrefix: 'bad\" onclick=\"x' }));
  assert.throws(() => arch.renderToString(s, { theme: 'unknown' }));
});

test('Markdown fences render SVG, raw HTML remains text, and other languages remain code', () => {
  const md = '# Title\n\n<script>alert(1)</script>\n\n```arch\n' + source(pair) + '\n```\n\n~~~js\n<x>\n~~~';
  const html = arch.renderMarkdown(md);
  assert.match(html, /<h1>Title<\/h1>/); assert.match(html, /<figure class="arch-diagram"><svg/);
  assert.ok(!html.includes('<script>')); assert.match(html, /language-js/); assert.match(html, /&lt;x&gt;/);
  assert.throws(() => arch.renderMarkdown('```arch\n' + source(pair)), /Unclosed/);
});

test('shipped Markdown fixture contains working arch fences', async () => {
  const markdown = await readFile('test.md', 'utf8');
  assert.match(markdown, /```arch/); assert.match(arch.renderMarkdown(markdown), /<svg/);
});

test('both distributable bundles expose identical public API and render identically', async () => {
  const renderings = [];
  for (const file of ['arch.js', 'arch.min.js']) {
    const context = vm.createContext({}); vm.runInContext(await readFile(file, 'utf8'), context);
    assert.deepEqual(Object.keys(context.arch).sort(), Object.keys(arch).sort());
    const options = { idPrefix:'same' };
    const { graph, svg } = context.arch.renderDiagram(source(pair), options);
    assert.equal(graph.nodes.length, 2);
    assert.equal(svg, context.arch.renderToString(source(pair), options));
    assert.ok(svg.includes(`viewBox="${Object.values(graph.bounds).join(' ')}"`));
    renderings.push(svg);
  }
  assert.equal(renderings[0], renderings[1]);
});

test('empty models produce usable SVG and API errors are readable outside the browser', () => {
  assert.match(arch.renderToString(source('')), /viewBox=/);
  assert.throws(() => arch.parse(null), /string/); assert.throws(() => arch.render(null, source('')), /DOM/);
  assert.throws(() => arch.renderAll(), /DOM/); assert.throws(() => arch.renderMarkdown(null), /string/);
  const cyclic = arch.parse(source('package p "P" { package q "Q" }'));
  cyclic.nodes[0].parent = 'q'; assert.throws(() => arch.layout(cyclic), /Cyclic/);
});
