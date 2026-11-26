import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.studio.js';
import { DIAGRAMS, DIAGRAM_OPTIONS } from '../src/diagrams.js';

const topics = ['syntax', 'model', 'profiles', 'types', 'relations', 'connections', 'viewpoints', 'iconpacks', 'diagrams', 'views', 'routing', 'styles', 'colors', 'templates', 'config', 'api'];
const definition = {
  title: '<script>alert("profile")</script> & Company',
  nodeTypes: {
    Entity: { abstract: true, attributes: { owner: { required: true }, maturity: { type: 'integer', min: 0, max: 5 } } },
    Product: { extends: 'Entity', template: 'application', attributes: { status: { enum: ['planned', 'live'] } } },
  },
  relationTypes: { depends: { from: ['Product'], to: ['Product'], style: 'dependency', allowSelf: false, acyclic: true, outgoing: { max: 2 } } },
  viewpoints: { Catalog: { nodes: ['Product'], relations: ['depends'], requiredNodes: ['Product'], connections: [{ nodes: ['Product'], relations: ['depends'], min: 0 }] } },
};
arch.registerProfile('help_company', definition);

test('standalone help works through parse, validate, layout, SVG and Markdown', () => {
  for (const topic of ['', ...topics]) {
    const source = `# Help before architecture\n// comments allowed\n@help ${topic}\n`, model = arch.parse(source);
    assert.equal(model.kind, 'help'); assert.equal(arch.validate(source).valid, true, topic);
    const snapshot = JSON.stringify(model), graph = arch.layout(model);
    assert.ok(graph.bounds.width > 0 && graph.bounds.height > 0); assert.equal(graph.kind, 'help');
    assert.match(arch.renderToString(model), /^<svg/);
    assert.match(arch.renderMarkdown(`\`\`\`arch\n${source}\n\`\`\``), /data-arch-help=/);
    assert.equal(JSON.stringify(model), snapshot);
  }
  assert.equal(arch.parse('architecture "@help" { model { service a "A" } }').kind, undefined);
  assert.match(arch.help(), /@help iconpacks/);
  assert.match(arch.help(), /^arch\.js · Help\n/);
  assert.match(arch.help(), /Topics/);
  assert.match(arch.help('profiles'), /Registered profiles/);
  assert.match(arch.renderToString('@help', { theme: 'dark' }), /data-arch-svg="dark"/);
  assert.throws(() => arch.renderToString('@help', { view: 'missing' }), /Unknown view/);
});

test('architecture-level help renders the user example and honors config without validating the working model', () => {
  const source = 'architecture "Test"{\n    @help profiles\n    model {\n    }\n}';
  const model = arch.parse(source);
  assert.equal(model.kind, 'help'); assert.equal(model.title, 'Test');
  assert.equal(arch.validate(source).valid, true);
  assert.match(arch.renderToString(source), /data-arch-help="profiles"/);
  assert.match(arch.renderMarkdown('```arch\n' + source + '\n```'), /data-arch-help="profiles"/);
  for (const command of ['@help', '@help profiles', '@help types; config { profile help_company }']) {
    assert.match(arch.renderToString(`architecture "Test" { ${command}\n model { Unfinished item "Still editing" } }`), /data-arch-help=/);
  }
  const configured = 'architecture "Test" { config { profile help_company }\n @help types\n }';
  assert.match(arch.renderToString(configured), /Product/);
  assert.ok(!arch.renderToString(configured, { profile: 'default' }).includes('Product'));
  assert.match(arch.renderToString('architecture "Test" { @help iconpacks core "}"; model {} }'), /no matches/);
  for (const invalid of ['architecture "Test" { @help profiles; @help types }', 'architecture "Test" { @help bad }', 'architecture "Test" { model { @help profiles } }']) {
    assert.equal(arch.validate(invalid).valid, false, invalid); assert.throws(() => arch.renderToString(invalid), arch.ArchError);
  }
  const literal = arch.parse('architecture "@help profiles" { # @help\n model { service a "@help types" } }');
  assert.equal(literal.kind, undefined);
});

test('help reads live registries, shows inherited profile rules and uses selected profile', () => {
  const parsed = arch.parse('@help iconpacks');
  arch.registerIconPack('help_dynamic', { icons: { '0': { paths: ['M0 0H4V4Z'] }, cloud: { paths: ['M0 0H1V1Z'] } } });
  assert.match(arch.renderToString(parsed).replace(/<[^>]+>/g,''), /help_dynamic · 2 icons/);
  assert.match(arch.help('profiles'), /help_company/);
  assert.match(arch.help('profiles help_company'), /Catalog|@help viewpoints help_company/);
  assert.match(arch.help('types', { profile: 'help_company' }), /Product/);
  assert.match(arch.help('types', { profile: definition }), /Product/);
  const detail = arch.help('types help_company Product');
  for (const token of ['owner', 'required', 'maturity', 'max', 'status', 'planned', 'application']) assert.ok(detail.includes(token), token);
  assert.match(arch.help('types help_company'), /Entity \[abstract\]/);
  assert.match(arch.help('relations help_company depends'), /acyclic/);
  assert.match(arch.help('viewpoints help_company Catalog'), /connections/);
  assert.match(arch.help('types default service', { profile: 'help_company' }), /Profile default/);
  const snapshot = arch.parse('@help types', { profile: 'help_company' });
  arch.registerProfile('help_company', { ...definition, nodeTypes: { Changed: { template: 'service' } }, relationTypes: {}, viewpoints: {} });
  assert.ok(arch.renderToString(snapshot).includes('Product'));
  assert.ok(!arch.help('types', { profile: 'help_company' }).includes('Product'));
  arch.registerProfile('help_company', definition);
});

test('icon help searches originals and aliases, paginates without lost names or geometry exposure', () => {
  const icons = Object.fromEntries(Array.from({ length: 205 }, (_, i) => [`icon_${String(i).padStart(3, '0')}`, { body: '<path d="M0 0H2V2Z"/>' }]));
  arch.registerIconPack('help_many', { prefix: 'upstream', icons, aliases: { alternate: { parent: 'icon_000' } } });
  assert.match(arch.help('iconpacks'), /help_many · 206 icons/);
  assert.match(arch.help('iconpacks help_many ICON_204'), /help_many.icon_204/);
  assert.match(arch.help('icons help_many alternate'), /help_many.alternate/);
  const all = [1, 2, 3].flatMap(page => [...arch.help(`iconpacks help_many "*" ${page}`).matchAll(/^help_many\.([\w_]+)$/gm)].map(m => m[1]));
  assert.deepEqual(all.sort(), [...Object.keys(icons), 'alternate'].sort());
  assert.match(arch.help('iconpacks help_many absent'), /no matches/);
  assert.ok(!arch.help('iconpacks help_many').includes('<path'));
});

test('diagram help is driven by valid option fields; syntax examples can actually render', () => {
  for (const type of DIAGRAMS) for (const field of DIAGRAM_OPTIONS[type]) assert.ok(arch.help(`diagrams ${type}`).includes(field));
  for (const topic of ['syntax']) {
    const lines = arch.help(topic).split('\n'), start = lines.findIndex(line => line.startsWith('architecture '));
    const end = lines.findIndex((line, i) => i > start && line === '}');
    assert.doesNotThrow(() => arch.renderToString(lines.slice(start, end + 1).join('\n'), { profile: 'default' }));
  }
  const inline = arch.help('config').split('\n'), start = inline.indexOf('config {',inline.indexOf('Custom inline profile'));
  const end = inline.findIndex((line, i) => i > start && line === '}');
  const config = inline.slice(start, end + 1).join('\n');
  assert.doesNotThrow(() => arch.renderToString(`architecture "Inline" { ${config} model { actor a "A" product p "P" { owner "Team" } relation e a -> p "Uses" } }`));
  assert.equal([...arch.help('colors').matchAll(/^\w+  #[a-f0-9]{6}$/gm)].length, 147);
  assert.match(arch.help('colors BLUE'), /aliceblue/);
});

test('help separates configuration values from multiline DSL examples', () => {
  const graph = arch.layout('@help config');
  const example = graph.sections.find(section=>section.title==='Dashboard example');
  assert.equal(example.format,'dsl');
  assert.deepEqual(example.lines,['config {','  presentation dashboard','  views [overview, detail]','}']);
  const source = `architecture "Browser presentation" {
    ${example.lines.join('\n')}
    model { service portal "Portal" }
    view overview "Overview" {}
    view detail "Detail" {}
  }`;
  assert.equal(arch.parse(source).config.presentation,'dashboard');
  assert.deepEqual(arch.parse(source).config.views,['overview','detail']);
  for (const option of ['diagram','dashboard','views']) {
    const row = graph.rows.find(row=>row.text.startsWith(option+'  —'));
    assert.equal(row.termsRemaining,option.length);
  }
  assert.ok(graph.rows.some(row=>row.text==='  views [overview, detail]' && row.format==='dsl' && row.inset));
});

test('invalid help commands are clear diagnostics and never execute text', () => {
  for (const source of ['@unknown', '@help unknown', '@help constructor', '@help syntax extra', '@help "bad', '@help icons missing', '@help profiles missing', '@help types default missing', '@help diagrams invalid', '@help iconpacks core * 0', '@help iconpacks core * 2', '@help iconpacks core * 9007199254740992', '@help\narchitecture "Mixed" {}']) {
    assert.throws(() => arch.renderToString(source), arch.ArchError, source);
    const result = arch.validate(source); assert.equal(result.valid, false, source); assert.ok(result.diagnostics.length, source);
  }
  assert.throws(() => arch.help(12), arch.ArchError);
  assert.throws(() => arch.renderToString({ kind: 'help' }), arch.ArchError);
  for (const options of [{ theme: 'bad' }, { idPrefix: 'x" onclick="evil' }]) assert.throws(() => arch.renderToString('@help', options), arch.ArchError);
  const svg = arch.renderToString('@help profiles help_company', { idPrefix: 'safe' });
  assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('&lt;script&gt;'));
  assert.match(svg, /id="safe-title"/);
  assert.notEqual(arch.renderToString('@help'), arch.renderToString('@help'));
  assert.equal(arch.renderToString('@help', { idPrefix: 'same' }), arch.renderToString('@help', { idPrefix: 'same' }));
});

test('long profile and attribute text stays wrapped; JSON indentation survives', () => {
  arch.registerProfile('help_long', { title: '界'.repeat(300) + '\u0000', nodeTypes: { ['Long'.repeat(80)]: { attributes: { note: { enum: ['word'.repeat(200)] } } } } });
  const model = arch.parse('@help types help_long ' + 'Long'.repeat(80)), graph = arch.layout(model);
  assert.ok(graph.rows.every(row => [...row.text].length <= (row.kind === 'heading' ? 78 : 104)));
  assert.ok(graph.rows.some(row => row.text.startsWith('    "note"')));
  assert.ok(!arch.renderToString('@help profiles help_long').includes('\u0000'));
});

test('UAF and NAF help derives available types, attributes and viewpoints from registered JSON', async () => {
  for (const id of ['uaf', 'naf4-uaf']) arch.registerProfile(id, JSON.parse(await readFile(`profiles/${id}.json`, 'utf8')));
  assert.match(arch.help('profiles uaf'), /213/);
  assert.match(arch.help('types uaf Capability'), /template/);
  const naf = arch.getProfile('naf4-uaf');
  for (const name of Object.keys(naf.viewpoints)) assert.ok(arch.help('viewpoints naf4-uaf').includes(name));
  assert.match(arch.help('viewpoints naf4-uaf C1'), /requiredNodes/);
});

test('Studio serves help without DOM globals and core reports its availability', async () => {
  const studio = vm.createContext({});
  vm.runInContext(await readFile('arch.min.js', 'utf8'), studio);
  for (const query of ['', 'diagrams class', 'iconpacks core', 'colors blue', 'connections default service']) {
    assert.equal(studio.arch.help(query), arch.help(query));
    assert.equal(studio.arch.renderToString(`@help ${query}`, { idPrefix: 'help_test' }), arch.renderToString(`@help ${query}`, { idPrefix: 'help_test' }));
  }
  const core = vm.createContext({});
  vm.runInContext(await readFile('arch.core.min.js', 'utf8'), core);
  assert.throws(() => core.arch.renderToString('@help views'), /requires arch\.min\.js/);
  assert.equal(core.arch.validate('@help views').diagnostics[0].code, 'ARCH_STUDIO_REQUIRED');
});

test('help provides sorted catalog links and standalone links to a configured reference host',()=>{
  const profile={nodeTypes:{Zebra:{}, apple:{}, Beta:{}}};
  const definition=arch.layout('@help types',{profile});
  const names=definition.sections.find(section=>section.title==='node types').lines.map(line=>line.split(' ')[0]);
  assert.deepEqual(names,['apple','Beta','Zebra']);
  const landing=arch.renderToString('@help',{helpBaseURL:'https://example.test/studio/?mode=local'});
  assert.match(landing,/href="https:\/\/example\.test\/studio\/\?mode=local&amp;help=viewpoints"/);
  assert.match(landing,/data-arch-help-query="profiles"/);
  const types=arch.renderToString('@help types',{profile});
  assert.ok(types.indexOf('data-arch-help-query="types . apple"')<types.indexOf('data-arch-help-query="types . Beta"'));
  const unsafe=arch.renderToString('@help',{helpBaseURL:'javascript:void(0)'});
  assert.doesNotMatch(unsafe,/href="javascript:/);
});
