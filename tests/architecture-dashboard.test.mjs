import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.js';
import {cases, document} from './fixtures/naf41/cases.mjs';

const readProfile = async file => JSON.parse(await readFile(new URL('../profiles/'+file,import.meta.url),'utf8'));
const pinnedVersion = '4.1.0-arch.41';
const current = await readProfile('naf41-uaf.json');
for (const definition of [await readProfile('uaf.json'),current.version===pinnedVersion ? current : await readProfile(`naf41/revisions/${pinnedVersion}.json`)]) {
  arch.registerProfile(definition.id,definition);
}
const pinned = `naf41-uaf@${pinnedVersion}`;

test('sparse projections preserve declaration order and presentation hides', () => {
  const extras = Array.from({length:128},(_,i)=>`system spare${i} "Spare ${i}"`).join('\n');
  const views = Array.from({length:8},(_,i)=>`view v${i} "View ${i}" {
    include target, bundle
    exclude removed
    style hidden {display none}
  }`).join('\n');
  const source = `architecture "Sparse views" {
    model {
      package bundle "Bundle" {system first "First" system second "Second"}
      system target "Target"
      ${extras}
      relation hidden target -> first "Hidden"
      relation shown second -> target "Shown"
      relation removed first -> second "Excluded"
    }
    ${views}
  }`;
  const view = arch.architectureReport(source).views[0];
  assert.deepEqual(view.elements,['bundle','first','second','target']);
  assert.deepEqual(view.relationships,['hidden','shown']);
  assert.deepEqual(view.visibleRelationships,['shown']);
});

test('presentation is a runtime setting that round-trips and leaves SVG selection intact', () => {
  const source = `architecture "Dashboard" {
    config { presentation dashboard views detail, overview }
    model { system context "Context" }
    view overview "Overview" {}
    view detail "Detail" {}
    view extra "Extra" {}
  }`;
  const model = arch.parse(source);
  assert.equal(model.profile.id,'default');
  assert.equal(model.config.presentation,'dashboard');
  const json = JSON.parse(arch.translate(source,{format:'json'}));
  assert.equal(json.architecture.config.presentation,'dashboard');
  assert.equal(arch.parse(json).config.presentation,'dashboard');
  assert.equal(arch.architectureReport(json).initialView,'detail');
  assert.deepEqual(arch.layout(json).layouts.map(view=>view.view.id),['detail','overview']);
  assert.match(arch.renderToString(json),/data-arch-views="2"/);
  const bad = arch.validate(source.replace('presentation dashboard','presentation slideshow'));
  assert.equal(bad.valid,false);
  assert.match(bad.diagnostics[0].message,/presentation must be diagram or dashboard/);
  json.architecture.config.presentation = true;
  assert.equal(arch.validate(json).diagnostics[0].path,'/architecture/config/presentation');
  assert.equal(arch.parse(source.replace('presentation dashboard','presentation diagram')).config.presentation,'diagram');
});

test('one pinned architecture validates and renders all 47 NAF viewpoints', () => {
  const profile=arch.getProfile(pinned);
  const model={elements:{},relations:{}}, views={};
  for (const id of Object.keys(profile.viewpoints)) {
    const part=JSON.parse(arch.translate(document(id,cases[id]),{format:'json'})).architecture.model;
    const namespaced = key => `${id}.${key}`;
    for (const [kind,definitions] of [['elements',profile.nodeTypes],['relations',profile.relationTypes]]) {
      for (const [key,item] of Object.entries(part[kind] ?? {})) {
        const fields = {...item};
        for (const [attribute,value] of Object.entries(fields)) {
          const endpoint = kind==='relations' && ['from','to'].includes(attribute);
          if (endpoint || definitions[item.type].attributes[attribute]?.type==='reference')
            fields[attribute]=Array.isArray(value)?value.map(namespaced):namespaced(value);
        }
        model[kind][namespaced(key)] = fields;
      }
    }
    views[id]={name:id,viewpoint:id,include:Object.keys(part.elements).map(namespaced)};
  }
  const source = {architecture:{name:'NAF viewpoint regression',config:{profile:pinned,views:['Ar']},model,views}};
  const report = arch.architectureReport(source,{validation:'strict',checkRendering:true});
  assert.deepEqual(report.diagnostics,[]);
  assert.equal(report.views.length,47);
  const html=arch.renderDashboardToHTML(source,{validation:'strict'});
  const payload=JSON.parse(html.match(/<script type="application\/json" id="model">([^]*?)<\/script>/)[1]);
  assert.equal(payload.helpPages[''].title,'arch.js · Help');
  assert.ok(payload.helpPages['config'].sections.some(section=>section.title==='Browser presentation'));
  assert.match(payload.helpPages['viewpoints . Ar'].title,/viewpoints/);
  assert.deepEqual(Object.keys(payload.report.previews),Object.keys(views));
  for (const [id,entry] of Object.entries(payload.report.previews)) {
    assert.ok(entry.svg,id);
    assert.doesNotMatch(entry.svg,/\b(?:NaN|Infinity|undefined)\b/);
    assert.equal(new DOMParser().parseFromString(entry.svg,'image/svg+xml').documentElement.localName,'svg');
  }
});

test('L4 performer links satisfy strict validation and project into lanes', async () => {
  const input=await readFile(new URL('../examples/naf41-logical-activities.arch',import.meta.url),'utf8');
  assert.deepEqual(arch.validate(input,{validation:'strict'}).diagnostics,[]);
  const report = arch.architectureReport(input,{validation:'strict'});
  const view = report.views.find(v=>v.id==='l4Swimlane');
  assert.ok(view.relationships.includes('performLog'));
  assert.ok(!view.visibleRelationships.includes('performLog'));
  const svg = arch.renderToString(input,{view:view.id,validation:'strict'});
  assert.match(svg,/data-node="controller"/);
  assert.match(svg,/data-edge="logToAssess"/);
  assert.doesNotMatch(svg,/data-edge="(?:performLog|holds)"/);
  const ambiguous=input.replace('relation performLog', 'relation other rescue -> log "Also performs" {type PerformsOperationalActivity}\n    relation performLog');
  assert.match(arch.validate(ambiguous).diagnostics.map(d=>d.message).join('\n'),/Multiple performers match lanes/);
});

test('Ar retains required context and dated prints a directed correction', async () => {
  const source=await readFile(new URL('../examples/naf41-foundation-viewpoints.arch',import.meta.url),'utf8');
  const report=arch.architectureReport(source,{validation:'strict',checkRendering:true});
  assert.deepEqual(report.diagnostics,[]);
  const view=report.views.find(v=>v.id==='ar');
  assert.ok(view.elements.includes('status'));
  assert.ok(!view.visibleElements.includes('status'));
  const typo=source.replace('datedOnly true','dated true');
  const error=arch.inspectSource(typo,{format:'dsl'}).diagnostics.find(issue=>issue.message.includes('does not apply'));
  assert.match(error.message,/Use datedOnly true/);
  assert.ok(error.candidates.some(candidate=>candidate.example.includes('datedOnly')));
  assert.match(arch.renderToString('architecture "Empty timeline" {model { system context "Context" } view test "Test" { diagram timeline { datedOnly true } }}'),/No dated elements/);
});

test('reports keep view membership, link model elements to diagrams and isolate failed views', () => {
  const source=`architecture "Example </script>" {
    config {views overview}
    model { service api "API" system system "System" relation connect api -> system "Uses" }
    view overview "Overview" { include api,system }
    view details "Details" { represents api extends overview }
    view invalid "Invalid" { diagram timeline }
  }`;
  const report=arch.architectureReport(source,{validation:'strict',checkRendering:true});
  assert.deepEqual(report.views.filter(view=>view.elements.includes('api')).map(view=>view.id),
    ['overview','details','invalid']);
  assert.deepEqual(report.views.filter(view=>view.error).map(view=>view.id),['invalid']);
  assert.equal(report.views[1].represents,'api');
  assert.equal(report.views[1].extends,'overview');
  const html=arch.renderDashboardToHTML(source);
  assert.ok(html.includes('Example &lt;/script&gt;'));
  assert.ok(html.includes('Example \\u003c/script>'));
  assert.ok(arch.translate(source,{format:'json'}).includes('"represents": "api"'));
});

test('dashboard sources preserve authored views and the model declarations they depend on', () => {
  const source = `architecture "View source" {
    config {
      views other
      type item { attribute owner { type reference targets item } }
      relation link { from item to item }
      defaultRelation link
    }
    model {
      item first "First" { owner context }
      item second "Second"
      item context "Context"
      item outside "Outside"
      item irrelevant "Irrelevant </script>"
      relation shown first -> second "Visible"
      relation skipped first -> outside "Skipped"
    }
    view base "Base" { include first, second exclude skipped }
    view derived "Derived" { extends base style first { width 200 } }
    view overview "Overview" { embed derived as body }
    view other "Other" { include irrelevant }
  }`;
  const html = arch.renderDashboardToHTML(source,{validation:'strict'});
  const {sources} = JSON.parse(html.match(/<script type="application\/json" id="model">([^]*?)<\/script>/)[1]);
  const overview = sources.overview;
  assert.ok(overview.dsl);
  assert.deepEqual(JSON.parse(overview.json),JSON.parse(arch.translate(overview.dsl,{format:'json'})));
  const {architecture} = JSON.parse(overview.json);
  assert.deepEqual(architecture.config.views,['overview']);
  assert.deepEqual(Object.keys(architecture.views),['base','derived','overview']);
  assert.deepEqual(Object.keys(architecture.model.elements),['first','second','context','outside']);
  assert.deepEqual(Object.keys(architecture.model.relations),['shown','skipped']);
  assert.equal(architecture.model.elements.first.owner,'context');
  assert.equal(architecture.views.derived.extends,'base');
  assert.equal(architecture.views.overview.embed.body.view,'derived');
  assert.equal(arch.validate(overview.dsl,{validation:'strict'}).valid,true);
  assert.deepEqual(arch.layout(overview.dsl).nodes.map(node=>node.id),arch.layout(source,{view:'overview'}).nodes.map(node=>node.id));
  assert.match(sources.other.dsl,/Irrelevant <\/script>/);
  assert.equal(html.match(/<\/script>/g).length,2);
});

test('relative rows, waypoint trunks, route endpoint geometry and obstacle avoidance compose', () => {
  const source=`architecture "Layout" {
    model {
      system start "Start" system obstacle "Obstacle" system a "A" system b "B"
      relation one start -> a "To A" relation two start -> b "To B"
    }
    view clear "Clear route" {
      exclude two
      place start at (0, 0)
      row [start, obstacle, a] { gap 90 }
      place b bottom of a
      routes { avoidObstacles true }
    }
    view trunk "Trunk" {
      place start at (0, 0)
      place a at (680, -200)
      column a, b { gap 300 }
      routes { curve orthogonal sharePath all }
      route one, two { from right to left via (routeSource.right + 70, routeSource.centerY), (430, routeTarget.centerY) }
    }
  }`;
  const clear=arch.layout(source,{view:'clear'});
  const nodes=Object.fromEntries(clear.nodes.map(node=>[node.id,node]));
  assert.equal(nodes.a.x,nodes.obstacle.x+nodes.obstacle.width+90);
  assert.ok(clear.edges[0].points.some(point=>point.y < nodes.obstacle.y || point.y > nodes.obstacle.y+nodes.obstacle.height));
  const trunk=arch.layout(source,{view:'trunk'});
  assert.equal(trunk.sharedPaths?.length,1);
  assert.equal(trunk.sharedPaths[0].edgeIds.length,2);
  assert.notEqual(trunk.edges[0].points.at(-1).y,trunk.edges[1].points.at(-1).y);
  assert.equal(trunk.edges[0].points[1].x,trunk.nodes.find(node=>node.id==='start').width+70);
  const json=arch.translate(source,{format:'json'});
  assert.deepEqual(arch.validate(json).diagnostics,[]);
});
