import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.studio.js';
import {inspectPath} from '../src/svg-path.js';

const profile={defaultRelation:'flow',nodeTypes:{item:{template:'node'}},relationTypes:{flow:{style:'dependency'},other:{style:'dependency'},solid:{style:'association'},kind:{style:'generalization'}}};
const source=(grouped=false,options='',routes='',type='flow',reverse=false)=>`architecture "Shared tree" {model {
 item root "Root" item a "A" item b "B"
 relation first ${reverse?'a -> root':'root -> a'} "Branch A" {type ${reverse?'kind':'flow'}}
 relation second ${reverse?'b -> root':'root -> b'} "Branch B" {type ${reverse?'kind':type}}
} view v "Tree" {${grouped?`tree g {nodes root,a,b ${options}}`:`diagram tree {${options}}`} ${routes}}}`;
const layout=(...args)=>arch.layout(source(...args),{profile});

test('whole-tree sharePath is opt-in and distinguishes exact stereotypes from all compatible styles',()=>{
  assert.equal(layout().sharedPaths,undefined);
  assert.equal(layout(false,'sharePath none').sharedPaths,undefined);
  assert.equal(layout(false,'sharePath stereotypes').sharedPaths?.length,2);
  assert.equal(layout(false,'sharePath stereotypes','','other').sharedPaths,undefined);
  assert.equal(layout(false,'sharePath all','','other').sharedPaths?.length,2);
  assert.equal(layout(false,'sharePath all','','solid').sharedPaths,undefined);
  const inherited={...profile,relationTypes:{...profile.relationTypes,child:{extends:'flow'}}};
  assert.equal(arch.layout(source(false,'sharePath stereotypes','','child'),{profile:inherited}).sharedPaths,undefined,'inherited stereotypes retain distinct types');
});

test('whole and named trees share fan-in/fan-out paths in all four orientations with correct SVG markers and bounds',()=>{
  for(const grouped of [false,true])for(const direction of ['up','down','left','right'])for(const reverse of [false,true]) {
    const s=source(grouped,`direction ${direction} sharePath stereotypes`,'','flow',reverse),g=arch.layout(s,{profile});
    assert.equal(g.sharedPaths?.length,2,`${grouped}/${direction}/${reverse}`);
    assert.equal(g.sharedPaths[0].d.match(/ Q /g)?.length,2,'both arms round into the shared stem');
    for(const e of g.edges) {
      assert.ok(e.sharedPath);assert.ok(e.drawD);assert.equal(e.source,reverse?e.id==='first'?'a':'b':'root');
      assert.match(e.drawD,/ Q /,'the default tree curve rounds the painted branch');
      const src=g.nodes.find(n=>n.id===e.source),dst=g.nodes.find(n=>n.id===e.target);
      for(const [p,n]of [[e.points[0],src],[e.points.at(-1),dst]])assert.ok(p.x>=n.x&&p.x<=n.x+n.width&&p.y>=n.y&&p.y<=n.y+n.height);
      for(const p of e.points)assert.ok(p.x>=g.bounds.x&&p.y>=g.bounds.y&&p.x<=g.bounds.x+g.bounds.width&&p.y<=g.bounds.y+g.bounds.height);
    }
    const xml=new DOMParser().parseFromString(arch.renderToString(s,{profile,idPrefix:'tree-shared'}),'image/svg+xml');
    const groups=[...xml.getElementsByTagName('g')];assert.equal(groups.filter(g=>g.getAttribute('class')==='arch-shared-path').length,2);
    assert.equal([...xml.getElementsByTagName('path')].filter(p=>p.hasAttribute('marker-end')).length,reverse?1:2);
  }
});

test('named-tree rounded branches merge tangentially on the shared stem, including an aligned leaf',()=>{
  const threeBranches=source(true,'sharePath all','routes {curve rounded}','flow',true)
    .replace('item b "B"','item c "C" item b "B"')
    .replace('} view v','relation middle c -> root "Branch C" {type kind} } view v')
    .replace('nodes root,a,b','nodes root,a,c,b');
  const graph=arch.layout(threeBranches,{profile});
  const [spine,stem]=graph.sharedPaths;
  const arms=spine.d.match(/M [^M]+/g).map(path=>inspectPath(path.trim()));
  assert.equal(arms.length,2);
  const join=inspectPath(stem.d)[0];
  const [left,middle,right]=graph.edges.slice().sort((a,b)=>a.points[0].x-b.points[0].x);
  for(const [index,edge] of [left,right].entries()) {
    assert.deepEqual(inspectPath(edge.drawD).at(-1),arms[index][0]);
    assert.deepEqual(arms[index].at(-1),join);
    assert.match(edge.drawD,/ Q /);
    assert.ok(edge.d.startsWith(edge.drawD));
    assert.equal(edge.d.match(/ Q /g)?.length,2);
  }
  assert.doesNotMatch(middle.drawD,/ Q /);
  assert.deepEqual(inspectPath(middle.drawD).at(-1),join);

  const orthogonal=threeBranches.replace('sharePath all','curve orthogonal sharePath all');
  const square=arch.layout(orthogonal,{profile});
  assert.ok(square.edges.every(edge=>edge.sharedPath&&!edge.drawD.includes(' Q ')));
  assert.doesNotMatch(square.sharedPaths[0].d,/ Q /);
  const overrides=orthogonal.replace('routes {curve rounded}', 'route first, second, middle {curve rounded}');
  assert.match(arch.layout(overrides,{profile}).edges[0].drawD,/ Q /);
});

test('named-tree sharing precedence is individual route, tree group, then view routes defaults',()=>{
  assert.equal(layout(true,'sharePath none','routes {sharePath all}').sharedPaths,undefined);
  assert.equal(layout(true,'sharePath stereotypes','routes {sharePath none}').sharedPaths?.length,2);
  assert.equal(layout(true,'','routes {sharePath stereotypes}').sharedPaths?.length,2);
  assert.equal(layout(true,'sharePath stereotypes','route first {sharePath none}').sharedPaths,undefined);
  assert.equal(layout(true,'sharePath none','route first {sharePath all} route second {sharePath all}').sharedPaths?.length,2);
  for(const route of ['via (100,-200)','curve straight','path "M 0 0 L 100 100"'])assert.equal(layout(true,'sharePath all',`route first {${route}}`).sharedPaths,undefined,route);
});

test('named-tree sharing uses final translated coordinates and leaves external links outside the group setting',()=>{
  const s=source(true,'sharePath stereotypes','place g at (-400,250)').replace('item root "Root"','item context "Context" item root "Root"').replace('relation first','relation external root -> context "Context" {type flow} relation first');
  const g=arch.layout(s,{profile});assert.equal(g.sharedPaths?.length,2);
  assert.equal(g.treeGroups[0].bounds.x,-400);assert.equal(g.treeGroups[0].bounds.y,250);
  assert.equal(g.edges.find(e=>e.id==='external').sharedPath,undefined);
  assert.deepEqual(g.sharedPaths[0].edgeIds,['first','second']);
});

test('sharePath roundtrips through JSON and source, preserves immutable input and works in both bundles',async()=>{
  for(const grouped of [false,true]) {
    const s=source(grouped,'sharePath stereotypes'),model=arch.parse(s,{profile}),before=JSON.stringify(model),g=arch.layout(model);
    assert.deepEqual(arch.layout(model),g);assert.equal(JSON.stringify(model),before);
    const json=arch.translate(s,{profile}),expected=arch.renderToString(s,{profile,idPrefix:'tree-shared'});
    assert.equal(arch.renderToString(json,{profile,idPrefix:'tree-shared'}),expected);
    assert.equal(arch.renderToString(arch.translate(json,{profile}),{profile,idPrefix:'tree-shared'}),expected);
    for(const file of ['arch.core.min.js', 'arch.min.js']) {
      const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);
      assert.equal(c.arch.renderToString(s,{profile,idPrefix:'tree-shared'}),expected);
    }
  }
  for(const grouped of [false,true]) {
    const report=arch.validate(source(grouped,'sharePath invalid'),{profile});
    assert.equal(report.valid,false);assert.match(report.diagnostics[0].message,/sharePath must be none, stereotypes or all/);
  }
  assert.match(arch.help('diagrams tree'),/sharePath/);assert.match(arch.help('views'),/sharePath/);
});
