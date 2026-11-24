import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as arch from '../src/arch.js';

for (const file of ['uaf.json', 'naf41-uaf.json']) {
  const definition = JSON.parse(await readFile(new URL(`../profiles/${file}`, import.meta.url), 'utf8'));
  arch.registerProfile(definition.id, definition);
}

const source = `architecture "While typing" {
  config { syntaxRecovery true }
  model {
    service a "A"
    service unfinished "Still typing
    service c "C"
    relation invalid a -> "Missing target"
    relation omitted a -> unfinished "Dependent relationship"
    relation kept a -> c "Valid relationship"
  }
  view v "Overview" {
    include [a, unfinished, c]
    route
    place c at (a.right + 100, 0)
    route omitted { curve straight }
    route kept { width 9 invalid option }
    route kept { color red }
  }
}`;

test('partial rendering retains current model and view declarations on either side of a syntax error', () => {
  const { graph, svg } = arch.renderDiagram(source);
  assert.deepEqual(graph.nodes.map(({id}) => id), ['a', 'c']);
  assert.deepEqual(graph.edges.map(({id}) => id), ['kept']);
  assert.ok(graph.nodes[1].x >= graph.nodes[0].x + graph.nodes[0].width + 99);
  assert.equal(graph.view.routes.kept.width, undefined);
  assert.equal(graph.view.routes.kept.color, 'red');
  assert.deepEqual(graph.syntaxDiagnostics.map(({line}) => line), [5, 7, 13, 16]);
  assert.ok(graph.syntaxDiagnostics.every(diagnostic => diagnostic.code === 'ARCH_SYNTAX' && diagnostic.column > 0));
  assert.match(svg, /data-arch-syntax="true"/);
  assert.match(svg, /#fef2f2/);
  assert.doesNotMatch(svg, /data-node="unfinished"/);
});

test('partially written blocks at EOF still show completed entries', () => {
  const text = 'architecture "Editing" { model { service a "Ready"\nservice b';
  const { graph } = arch.renderDiagram(text, {syntaxRecovery:true});
  assert.deepEqual(graph.nodes.map(({id}) => id), ['a']);
  assert.match(graph.syntaxDiagnostics[0].message, /element title/);
  assert.match(graph.syntaxDiagnostics[1].message, /Unclosed model/);
  assert.match(graph.syntaxDiagnostics[2].message, /Unclosed architecture/);
});

test('siblings in a package survive an incomplete child declaration', () => {
  const text = `architecture "Editing" {
    model {
      package group "Package" {
        service a "A"
        service b "Unclosed
        service c "C"
        relation e a -> c "Flow"
      }
    }
  }`;
  const model = arch.parsePreview(text);
  assert.deepEqual(model.nodes.map(({id,parent}) => [id,parent]), [['group',null],['a','group'],['c','group']]);
  assert.deepEqual(model.edges.map(({id}) => id), ['e']);
  assert.equal(arch.renderDiagram(model).graph.syntaxDiagnostics[0].line, 5);
});

test('recovery resumes after a semicolon or a malformed routing block with a missing closing brace', () => {
  const text = `architecture "Editing" {
    model { service a "A"; service bad ?; service c "C"; relation e a -> c "Flow" }
    view v "View" {
      route e { width 5
      place c at (400, 200)
    }
  }`;
  const { graph } = arch.renderDiagram(text, {syntaxRecovery:true});
  assert.deepEqual(graph.nodes.map(({id}) => id), ['a','c']);
  assert.equal(graph.view.places.c.at.x, 400);
  assert.equal(graph.view.routes.e, undefined);
  assert.equal(graph.syntaxDiagnostics.length, 2);
});

test('dependent profile references, tree members and coordinate overrides only use known remaining elements', () => {
  const profile = {
    nodeTypes:{service:{template:'service'}},
    relationTypes:{link:{attributes:{records:{type:'reference',targets:['service'],many:true}}}},
    defaultRelation:'link',
  };
  const text = `architecture "Dependent elements" {
    model {
      service a "A"
      service b
      service c "C"
      relation kept a -> c "Valid" { records [a, b] }
    }
    view v "View" {
      tree cluster { nodes [b] }
      place c at (cluster.right, b.bottom)
      style c { height b.height * 2 }
      route kept { via (b.centerX, b.centerY) }
    }
  }`;
  const model = arch.parsePreview(text, {profile});
  assert.deepEqual(model.edges[0].attributes.records, ['a']);
  assert.equal(Object.keys(model.views[0].trees).length, 0);
  assert.equal(Object.keys(model.views[0].places).length, 0);
  assert.equal(Object.keys(model.views[0].styles).length, 0);
  assert.equal(Object.keys(model.views[0].routes).length, 0);
  assert.equal(arch.renderDiagram(model).graph.syntaxDiagnostics.length, 1);
});

test('strict APIs, JSON and blocking semantic checks retain their error behavior', () => {
  assert.throws(() => arch.parse(source), arch.ArchError);
  assert.throws(() => arch.translate(source, 'json'), arch.ArchError);
  assert.equal(arch.validate(source).valid, false);
  assert.throws(() => arch.renderToString(source, {syntaxRecovery:false}), arch.ArchError);
  assert.throws(() => arch.renderToString(source.replace('syntaxRecovery true', 'syntaxRecovery false')), arch.ArchError);
  assert.throws(() => arch.renderToString(source.replace('syntaxRecovery true', ''), {}), arch.ArchError);
  assert.throws(() => arch.renderToString('{"architecture":', {syntaxRecovery:true}), arch.ArchError);
  assert.throws(() => arch.parsePreview('architecture "Broken header'), arch.ArchError);
  assert.throws(() => arch.parsePreview(source.replace('a -> c "Valid relationship"', 'a -> missing "Valid relationship"')), /Unknown endpoint/);
});

test('NAF P2 keeps rendering when EquipmentTyp is entered and suggests EquipmentType', async () => {
  const text = `architecture "Equipment" {
  config {profile naf41-uaf validation draft syntaxRecovery true}
  model {
    EquipmentType radio "Radio" {isStandardConfiguration true}
    EquipmentTyp equipmentType_commandPost "Command Post" {isStandardConfiguration true}
    EquipmentType aircraft "Aircraft" {isStandardConfiguration true}
    relation affected radio -> equipmentType_commandPost "Depends on" {type PhysicalDependency}
    relation retained radio -> aircraft "Depends on" {type PhysicalDependency}
  }
  view p2 "P2" {
    viewpoint P2
    include [radio, equipmentType_commandPost, aircraft]
    place aircraft at (equipmentType_commandPost.right, 100)
    route affected {curve straight}
    route retained {curve straight}
  }
}`;
  const {graph, svg} = arch.renderDiagram(text);
  assert.deepEqual(graph.nodes.map(node => node.id), ['radio','aircraft']);
  assert.deepEqual(graph.edges.map(edge => edge.id), ['retained']);
  assert.deepEqual(graph.syntaxDiagnostics.map(({code,line,column,candidates}) => ({code,line,column,candidates})),
    [{code:'ARCH_UNKNOWN_TYPE',line:5,column:5,candidates:['EquipmentType']}]);
  assert.match(svg, /Type errors — partial preview/);
  assert.match(svg, /EquipmentType\?/);
  assert.match(svg, /data-arch-diagnostic-help="types naf41-uaf"/);
  const linkedSVG = arch.renderToString(text, {helpBaseURL:'https://example.test/studio?mode=local'});
  assert.match(linkedSVG, /href="https:\/\/example\.test\/studio\?mode=local&amp;help=types\+naf41-uaf"/);
  assert.throws(() => arch.parse(text), /Unknown element type/);
  assert.equal(arch.validate(text).valid, false);
  assert.throws(() => arch.renderDiagram(text, {syntaxRecovery:false}), /Unknown element type/);
  assert.throws(() => arch.renderDiagram(text.replace('Radio" {isStandardConfiguration true}', 'Radio" {isStandardConfiguration invalid}')),
    /radio.isStandardConfiguration: expected boolean/);
  const corrected = arch.renderDiagram(text.replace('EquipmentTyp equipmentType_commandPost', 'EquipmentType equipmentType_commandPost'));
  assert.ok(corrected.graph.nodes.some(node => node.id === 'equipmentType_commandPost'));
  assert.ok(corrected.graph.edges.some(edge => edge.id === 'affected'));
  assert.equal(corrected.graph.syntaxDiagnostics, undefined);

  const example = await readFile(new URL('../examples/naf41-resource-viewpoints.arch', import.meta.url), 'utf8');
  const editing = example.replace('EquipmentType command "Command Post"', 'EquipmentTyp command "Command Post"');
  const partial = arch.renderDiagram(arch.parsePreview(editing));
  assert.equal(partial.graph.syntaxDiagnostics[0].elementId, 'command');
  assert.ok(partial.graph.layouts.some(layout => layout.view.id === 'p3'));
  assert.ok(partial.graph.layouts.some(layout => layout.view.id === 'p6'));
  assert.ok(partial.graph.diagnostics.some(diagnostic => diagnostic.viewId === 'p3' && diagnostic.incomplete));
  assert.match(partial.svg, /Draft — \d+ validation notices/);
  assert.match(partial.svg, /data-arch-diagnostic-help="viewpoints naf41-uaf P3"/);
  assert.equal(arch.validate(editing).valid, false);
});

test('NAF P3 recovers while its mandatory relationship type is being entered', async () => {
  const example = (await readFile(new URL('../examples/naf41-resource-viewpoints.arch', import.meta.url), 'utf8'))
    .replaceAll(/\bsignal\b/g, 'p3.1');
  const declaration = 'relation p3.1 radio -> command "Radio Channel"';
  const complete = declaration + ' { type ResourceInteraction interaction channel }';
  const untyped = example.replace(complete, declaration + ' { interaction channel }');
  const {graph, svg} = arch.renderDiagram(arch.parsePreview(untyped));
  const p3 = graph.layouts.find(layout => layout.view.id === 'p3');
  assert.ok(p3.nodes.some(node => node.id === 'radio'));
  assert.ok(p3.nodes.some(node => node.id === 'command'));
  assert.ok(p3.edges.length > 0);
  assert.ok(!p3.edges.some(edge => edge.id === 'p3.1'));
  const [diagnostic] = graph.syntaxDiagnostics;
  assert.equal(diagnostic.code, 'ARCH_MISSING_TYPE');
  assert.equal(diagnostic.elementId, 'p3.1');
  assert.equal(diagnostic.line, untyped.split('\n').findIndex(line => line.includes(declaration)) + 1);
  assert.match(svg, /Type errors — partial preview/);
  assert.match(svg, /requires an explicit type/);
  assert.ok(graph.diagnostics.some(diagnostic => diagnostic.viewId === 'p3' && diagnostic.incomplete));
  assert.throws(() => arch.parse(untyped), /Relationship p3\.1 requires an explicit type/);
  assert.equal(arch.validate(untyped).valid, false);

  const typingType = example.replace(complete, declaration + ' { interaction channel type }');
  assert.equal(arch.renderDiagram(typingType, {syntaxRecovery:true}).graph.syntaxDiagnostics[0].code, 'ARCH_SYNTAX');
  const finished = arch.renderDiagram(example, {syntaxRecovery:true}).graph;
  assert.equal(finished.syntaxDiagnostics, undefined);
  assert.ok(finished.layouts.find(layout => layout.view.id === 'p3').edges.some(edge => edge.id === 'p3.1'));
});

test('the default relationship type is applied in the preview when available', () => {
  const text = 'architecture "Default type" { model { service a "A" service b "B" relation e a -> b "Flow" } }';
  const {graph} = arch.renderDiagram(text, {syntaxRecovery:true});
  assert.equal(graph.edges[0].type, 'flow');
  assert.equal(graph.syntaxDiagnostics, undefined);
});

test('NAF P5 previews the valid graph when a state group is used as the source of enables', async () => {
  const example = (await readFile(new URL('../examples/naf41-resource-viewpoints.arch', import.meta.url), 'utf8'))
    .replace('relation enableApproach moving -> approach', 'relation p5.2 progress -> approach')
    .replace('    diagram state\n', '    diagram connected\n    route p5.2 {curve straight}\n');
  const model = arch.parsePreview(example);
  assert.ok(model.edges.some(edge => edge.id === 'enableDeploy'));
  assert.ok(!model.edges.some(edge => edge.id === 'p5.2'));
  assert.equal(model.views.find(view => view.id === 'p5').routes['p5.2'], undefined);
  const {graph, svg} = arch.renderDiagram(model, {view:'p5'});
  assert.ok(graph.nodes.some(node => node.id === 'progress'));
  assert.ok(graph.edges.some(edge => edge.id === 'enableDeploy'));
  assert.ok(graph.edges.some(edge => edge.id === 'stateArrive'));
  const [diagnostic] = graph.syntaxDiagnostics;
  assert.equal(diagnostic.code, 'ARCH_RELATION_ENDPOINT_TYPE');
  assert.equal(diagnostic.elementId, 'p5.2');
  assert.equal(diagnostic.line, example.split('\n').findIndex(line => line.includes('relation p5.2')) + 1);
  assert.match(diagnostic.message, /source of type ResourceStateGroup is not allowed for StateEnablesResourceFunction/);
  assert.match(diagnostic.message, /Allowed source types: ResourceState\./);
  assert.match(svg, /Type errors — partial preview/);
  assert.equal(arch.validate(example).valid, false);
  assert.throws(() => arch.renderDiagram(example, {view:'p5'}), /source of type ResourceStateGroup is not allowed/);
  const repaired = arch.renderDiagram(example.replace('p5.2 progress -> approach', 'p5.2 moving -> approach'), {view:'p5',syntaxRecovery:true}).graph;
  assert.ok(repaired.edges.some(edge => edge.id === 'p5.2'));
  assert.equal(repaired.syntaxDiagnostics, undefined);
});

test('NAF P3 temporarily omits the prohibited P2 edge from the P3 projection only', async () => {
  const example = (await readFile(new URL('../examples/naf41-resource-viewpoints.arch', import.meta.url), 'utf8'))
    .replaceAll(/\bradioVoice\b/g, 'p2.5');
  const text = example.replace('    exclude p2.5\n', '');
  const model = arch.parsePreview(text);
  assert.ok(model.edges.some(edge => edge.id === 'p2.5'));
  assert.equal(model.views.find(view => view.id === 'p3').exclude, undefined);
  const {graph, svg} = arch.renderDiagram(model, {views:['p2','p3']});
  const [p2, p3] = graph.layouts;
  assert.ok(p2.edges.some(edge => edge.id === 'p2.5'));
  assert.ok(p3.edges.some(edge => edge.id === 'signal'));
  assert.ok(!p3.edges.some(edge => edge.id === 'p2.5'));
  assert.deepEqual(graph.syntaxDiagnostics.map(({code,viewId,elementId,line}) => ({code,viewId,elementId,line})), [
    {code:'ARCH_VIEWPOINT_RELATION',viewId:'p3',elementId:'p2.5',line:text.split('\n').findIndex(line => line.includes('relation p2.5')) + 1}
  ]);
  assert.match(svg, /Viewpoint errors — partial preview/);
  assert.match(graph.syntaxDiagnostics[0].message, /Use exclude p2\.5/);
  assert.equal(arch.renderDiagram(model, {view:'p2'}).graph.syntaxDiagnostics, undefined);
  assert.equal(arch.renderDiagram(example, {view:'p3',syntaxRecovery:true}).graph.syntaxDiagnostics, undefined);
  assert.throws(() => arch.renderDiagram(text), /p3: Relationship type PhysicalDependency is not allowed/);
  assert.equal(arch.validate(text).valid, false);
});

test('viewpoint recovery respects the host viewpoint when a source view is embedded', () => {
  const text = `architecture "Embedded relationships" {
    config {
      type service { template service }
      relation connects { from service to service style flow }
      relation depends { from service to service style dependency }
      viewpoint Detail { nodes service relations connects, depends }
      viewpoint Summary { nodes service relations connects }
    }
    model {
      service a "A" service b "B" service c "C"
      relation x a -> b "Depends on" { type depends }
      relation y b -> c "Connects to" { type connects }
    }
    view detail "Detail" { viewpoint Detail }
    view summary "Summary" { viewpoint Summary embed detail }
  }`;
  const {graph} = arch.renderDiagram(text, {syntaxRecovery:true, views:'all'});
  assert.deepEqual(graph.layouts.map(layout => layout.edges.map(edge => edge.id)), [['x','y'], ['y']]);
  assert.equal(graph.syntaxDiagnostics[0].viewId, 'summary');
  assert.match(graph.syntaxDiagnostics[0].message, /embedded source view/);
});

test('unknown relationship types and nested declarations recover alongside parser errors', () => {
  const text = `architecture "Editing" {
    model {
      service a "A"
      packge container "Unavailable" { service child "Child" }
      service unfinished
      service c "C"
      relation one a -> c "Unknown relationship" {type dependenc}
      relation two a -> child "Removed with container"
      relation three a -> c "Valid"
    }
    view v "V" { route one {} route two {} }
  }`;
  const {graph, svg} = arch.renderDiagram(text, {syntaxRecovery:true});
  assert.deepEqual(graph.nodes.map(node => node.id), ['a','c']);
  assert.deepEqual(graph.edges.map(edge => edge.id), ['three']);
  assert.deepEqual(graph.syntaxDiagnostics.map(({code,line,candidates}) => ({code,line,candidates})), [
    {code:'ARCH_UNKNOWN_TYPE',line:4,candidates:['package']},
    {code:'ARCH_SYNTAX',line:5,candidates:undefined},
    {code:'ARCH_UNKNOWN_TYPE',line:7,candidates:['dependency']},
  ]);
  assert.match(svg, /Syntax and type errors — partial preview/);
});

test('Conveyes suggests the physical or logical relationship appropriate to each pair of endpoints', async () => {
  for (const [file, relationId, type] of [
    ['naf41-resource-viewpoints.arch', 'channelVoice', 'ConveysPhysicalResource'],
    ['naf41-interactions-cutout.arch', 'detail', 'ConveysLogicalResource']
  ]) {
    const source = await readFile(new URL(`../examples/${file}`, import.meta.url), 'utf8');
    const text = source.replace(`type ${type}`, 'type Conveyes');
    const {graph, svg} = arch.renderDiagram(text, {syntaxRecovery:true});
    const [diagnostic] = graph.syntaxDiagnostics;
    assert.equal(diagnostic.elementId, relationId);
    assert.deepEqual(diagnostic.candidates, [type]);
    assert.match(svg, /Suggested relationship types/);
    assert.match(svg, new RegExp(`type ${type}`));
    assert.ok(!graph.edges.some(edge => edge.id === relationId));
  }
});

test('missing relationship types suggest concrete types for the current endpoint order and direction', () => {
  const profile = {
    nodeTypes:{service:{}, data:{}},
    relationTypes:{
      Forward:{from:['service'],to:['data']},
      Bidirectional:{from:['service'],to:['data'],directions:['both']},
      Reversed:{from:['data'],to:['service'],directions:['both']},
      Abstract:{from:['service'],to:['data'],directions:['both'],abstract:true}
    }
  };
  const text = 'architecture "Typing" { model { service a "A" data b "B" relation edge a <-> b "Flow" } }';
  const {graph} = arch.renderDiagram(text, {profile, syntaxRecovery:true});
  assert.deepEqual(graph.syntaxDiagnostics[0].candidates, ['Bidirectional']);
});

test('syntax recovery does not change valid multiline DSL or its JSON round trip', () => {
  const text = 'architecture "Valid" { config {syntaxRecovery true} model { service\n a\n "A" } }';
  assert.equal(arch.parsePreview(text).nodes[0].title, 'A');
  assert.equal(arch.renderDiagram(text).graph.syntaxDiagnostics, undefined);
  const json = JSON.parse(arch.translate(text, 'json'));
  assert.equal(json.architecture.config.syntaxRecovery, true);
  assert.equal(arch.parse(json).config.syntaxRecovery, true);
});

test('syntax and draft notices remain distinct and support dark mode', () => {
  const profile = {nodeTypes:{service:{template:'service',attributes:{owner:{required:true}}}}};
  const text = 'architecture "Draft" { model { service a "A"\n service b\n } }';
  const options = {profile, validation:'draft', syntaxRecovery:true, theme:'dark'};
  const { svg, graph } = arch.renderDiagram(text, options);
  assert.match(svg, /data-arch-syntax="true"/);
  assert.match(svg, /#450a0a/);
  assert.match(svg, /data-arch-validation="draft"/);
  assert.match(svg, /Missing required attribute owner/);
  assert.equal(graph.syntaxDiagnostics.length, 1);
  assert.equal(graph.diagnostics.length, 1);
  assert.doesNotMatch(arch.renderToString(text, {...options,showValidation:false}), /arch-validation-notices/);
  assert.match(arch.renderToString(text, {...options,showValidation:false}), /arch-syntax-notices/);
});
