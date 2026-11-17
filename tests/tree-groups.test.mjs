import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

const body='service r "Root" service a "A" service b "B" service outside "Context" relation ra r -> a "A" relation rb r -> b "B" relation context outside -> r "Context"';
const doc=(view='',model=body)=>`architecture "Groups" {model {${model}}view v "V"{tree hierarchy {nodes [r,a,b] direction up} ${view}}}`;
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const get=(g,id)=>g.nodes.find(n=>n.id===id);

test('named trees arrange C2 members upward, preserve context and support group/external placement',async()=>{
  for(const name of ['uaf','naf4-uaf','naf41-uaf'])arch.registerProfile(name,JSON.parse(await readFile(`profiles/${name}.json`,'utf8')));
  const source=await readFile('examples/naf41-enterprise-vision.arch','utf8'),model=arch.parse(source),before=JSON.stringify(model);
  const g=arch.layout(model,{view:'grouped'}),group=g.treeGroups[0];
  assert.equal(g.nodes.length,6);assert.equal(g.edges.length,5);assert.equal(group.orientation,'up');assert.deepEqual(group.roots,['horizon']);
  assert.ok(get(g,'horizon').y>get(g,'vision').y);assert.ok(get(g,'vision').y>get(g,'coverage').y);
  assert.equal(get(g,'maritime').treeGroup,undefined);assert.ok(get(g,'maritime').x+get(g,'maritime').width<group.bounds.x);
  assert.equal(get(g,'maritime').y+get(g,'maritime').height/2,get(g,'vision').y+get(g,'vision').height/2);
  assert.equal(g.edges.find(e=>e.id==='desires').points[0].y,get(g,'horizon').y);
  const placed=arch.layout(model,{view:'positioned'});assert.equal(placed.treeGroups[0].bounds.x,300);assert.equal(get(placed,'maritime').x,0);assert.equal(get(placed,'maritime').y,250);
  assert.equal(JSON.stringify(model),before);assert.deepEqual(arch.layout(model,{view:'grouped'}),g);
});

test('multiple groups have independent directions and remain atomic inside model packages',()=>{
  const source=`architecture "Groups" {model {package p "Package" {${body} service s "Second" service t "Third" relation st s -> t "Link" relation cross b -> s "Cross"}}view v "V"{tree first {nodes [r,a,b] direction left} tree second {nodes [s,t] direction down} place first at (0,0) place second at (1000,0)}}`;
  const g=arch.layout(source),p=get(g,'p');assert.equal(g.treeGroups.length,2);assert.equal(g.nodes.length,7);assert.equal(g.edges.length,5);
  assert.ok(get(g,'r').x>get(g,'a').x);assert.ok(get(g,'t').y>get(g,'s').y);
  for(const n of g.nodes.filter(n=>n!==p)){assert.equal(n.parent,'p');assert.ok(n.x>=p.x&&n.y>=p.y&&n.x+n.width<=p.x+p.width&&n.y+n.height<=p.y+p.height);}
  assert.ok(!g.nodes.some(n=>n.virtualTreeGroup));assert.ok(!overlap(g.treeGroups[0].bounds,g.treeGroups[1].bounds));
  assert.doesNotMatch(arch.renderToString(source),/data-node="first"|data-node="second"|NaN|undefined/);
});

test('all four directions preserve semantic arrows with variable sizes in group and whole-tree layouts',()=>{
  for(const direction of ['up','down','left','right'])for(const grouped of [false,true]) {
    const source=`architecture "Directions" {model {service r "Root" service a "A" relation e a -> r "Kind" {type generalization}}view v "V" {${grouped?`tree hierarchy {nodes [r,a] direction ${direction}}`:`diagram tree {direction ${direction}}`} style r {width 340 height 180} style a {width 160 height 110}}}`;
    const g=arch.layout(source),r=get(g,'r'),a=get(g,'a'),e=g.edges[0];assert.equal(a.treeParent,'r');
    assert.ok(direction==='up'?a.y+a.height<r.y:direction==='down'?a.y>r.y+r.height:direction==='left'?a.x+a.width<r.x:a.x>r.x+r.width);
    assert.equal(e.source,'a');assert.equal(e.target,'r');assert.ok(!overlap(a,r));
    const start=e.points[0];assert.ok(start.x>=a.x&&start.x<=a.x+a.width&&start.y>=a.y&&start.y<=a.y+a.height);
  }
});

test('hierarchy filters preserve cross-links; styles hide members/edges without erasing model semantics',()=>{
  const profile={defaultRelation:'hierarchy',nodeTypes:{service:{template:'service'}},relationTypes:{hierarchy:{style:'flow'},other:{style:'flow'}}};
  const source=doc('',body.replace('"A" relation rb','"A" {type hierarchy} relation rb').replace('"B" relation context','"B" {type hierarchy} relation context')+' relation cross a -> b "Cross" {type other}').replace('direction up','direction up relations [hierarchy]');
  const g=arch.layout(source,{profile});assert.equal(g.edges.length,4);assert.equal(g.edges.find(e=>e.id==='cross').treeGroup,undefined);
  const hidden=arch.layout(doc('style a {display none} style rb {display none}'));assert.deepEqual(hidden.treeGroups[0].nodes,['r','b']);assert.equal(hidden.edges.length,1);
  const empty=arch.layout(doc('style r {display none} style a {display none} style b {display none}'));assert.equal(empty.treeGroups,undefined);assert.deepEqual(empty.nodes.map(n=>n.id),['outside']);
});

test('tree routes retain defaults, overrides, icons, custom labels and reference connectors',()=>{
  const source=doc('routes {curve orthogonal icon core.cloud iconPosition top} route ra {curve straight label (80,-50)} route rb {label none}');
  const g=arch.layout(source),a=g.edges.find(e=>e.id==='ra'),b=g.edges.find(e=>e.id==='rb');assert.equal(a.labelIcon,'core.cloud');assert.equal(a.labelIconPosition,'top');assert.deepEqual(a.label,{x:80,y:-50});assert.equal(a.points.length,2);assert.equal(b.labelWidth,0);assert.ok(!b.d.includes('Q'));
  const override=arch.layout(doc('route ra {showLabel true curve rounded}').replace('direction up','direction up showLabels false curve orthogonal'));
  assert.ok(override.edges.find(e=>e.id==='ra').labelLines.length);assert.equal(override.edges.find(e=>e.id==='rb').labelLines.length,0);
  const via=arch.layout(doc('route ra {from left to right via (-100,100),(-100,-100)}'));assert.ok(via.edges.find(e=>e.id==='ra').points.some(p=>p.x===-100));
  const profile={defaultRelation:'exchange',nodeTypes:{service:{template:'service'},document:{template:'artifact'}},relationTypes:{exchange:{style:'flow',attributes:{payload:{type:'reference',targets:['document'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
  const ref=arch.layout(doc('route info -> ra {to 0.5 via (0,-200) curve rounded}',body.replace('relation ra r -> a "A"','document info "Report" relation ra r -> a "A" {type exchange payload [info]}')),{profile});
  assert.equal(ref.referenceNodes.length,1);assert.equal(ref.referenceNodes[0].edgeId,'ra');assert.ok(ref.referenceNodes[0].points.some(p=>p.y===-200));
});

test('invalid memberships/options/placement produce actionable validation errors, including in draft',()=>{
  for(const [source,message]of [
    [doc().replace('nodes [r,a,b]','nodes []'),/nonempty/],
    [doc().replace('nodes [r,a,b]','nodes [r,r]'),/unique/],
    [doc().replace('nodes [r,a,b]','nodes [r,missing]'),/unknown or excluded/],
    [doc('exclude a'),/unknown or excluded/],
    [doc('tree second {nodes [a]}'),/more than one/],
    [doc().replace('tree hierarchy','tree r'),/conflicting/],
    [doc('place a at (0,0)'),/positioned automatically/],
    [doc('place hierarchy at (0,0) size (200,200)'),/automatic dimensions/],
    [doc('diagram tree'),/connected renderer/],
    [doc().replace('direction up','direction up orientation right'),/Choose direction or orientation/],
    [doc().replace('direction up','direction diagonal'),/direction must/],
    [doc().replace('direction up','foo bar'),/accepts nodes/],
    [doc('',body.replace('service a "A"','package p "P" {service a "A"}')),/same model container/],
    [doc('',body.replace('service a "A"','package a "A" {}')),/containers cannot/],
    [doc('',body+' relation other a -> b "Extra parent"'),/multiple parents/],
  ]) {const result=arch.validate(source,{validation:'draft'});assert.equal(result.valid,false,source);assert.match(result.diagnostics[0].message,message,source);}
  assert.equal(arch.validate(doc('style context {display none}')).valid,true);
});

test('named trees round-trip through JSON/meta, ship in help and both browser bundles',async()=>{
  const source=doc('place hierarchy at (300,0) route ra {icon core.shield}'),json=arch.translate(source),expected=arch.renderToString(source,{idPrefix:'same'});
  assert.deepEqual(JSON.parse(json).architecture.views.v.tree.hierarchy.nodes,['r','a','b']);assert.equal(arch.renderToString(json,{idPrefix:'same'}),expected);
  assert.equal(arch.renderToString(arch.translate(json),{idPrefix:'same'}),expected);
  assert.match(arch.renderToString(source.replace('model {','@meta json\nmodel {')),/direction/);
  assert.match(arch.help('views'),/Named tree layout groups/);assert.match(arch.help('diagrams tree'),/up, right or left/);
  const bad=arch.inspectSource(source.replace('direction up','direction invalid'));assert.ok(bad.diagnostics[0].candidates.some(c=>JSON.stringify(c).includes('up')));
  for(const file of ['arch.js','arch.min.js']){const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);assert.equal(context.arch.renderToString(source,{idPrefix:'same'}),expected);}
});
