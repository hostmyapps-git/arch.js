import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
const profile={nodeTypes:{actor:{template:'system'},item:{template:'artifact'}},relationTypes:{flow:{style:'dependency',directions:['forward','both'],from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceDisplay:'nodes',referenceLabels:{payload:'Carries'}}}};
const source=(rules='',extra='')=>`architecture "Route styles" {model {
 actor a "A" actor b "B" actor hub "Hub" item data "Dataset"
 relation e1 a -> hub "First" {type flow payload [data]}
 relation e2 b -> hub "Second" {type flow}}
 view v "Routes" {place a at (0,0) place b at (0,350) place hub at (750,150) place data at (350,-250) ${rules}} ${extra}}`;
const layout=rules=>arch.layout(source(rules),{profile});
const render=(rules='',theme='light')=>arch.renderToString(source(rules),{profile,theme,idPrefix:'styles'});
const xml=svg=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');
const groups=(doc,cls)=>[...doc.getElementsByTagName('g')].filter(e=>e.getAttribute('class')===cls);
const edge=(doc,id)=>groups(doc,'arch-edge').find(e=>e.getAttribute('data-edge')===id).getElementsByTagName('path')[0];
const marker=(doc,path,attr='marker-end')=>[...doc.getElementsByTagName('marker')].find(m=>`url(#${m.getAttribute('id')})`===path.getAttribute(attr));

test('route styles inherit field by field, independent of order, without changing the source model or geometry',()=>{
 const defaults='routes {color red width 3 dasharray [8,4]}',local='route e1 {color blue dasharray none}';
 const first=layout(`${defaults} ${local}`),second=layout(`${local} ${defaults}`),plain=layout('');
 assert.equal(render(`${defaults} ${local}`),render(`${local} ${defaults}`));
 assert.deepEqual(first.edges.map(({color,width,dasharray})=>({color,width,dasharray})),[{color:'#0000ff',width:3,dasharray:[]},{color:'#ff0000',width:3,dasharray:[8,4]}]);
 assert.deepEqual(first.edges.map(e=>e.points),plain.edges.map(e=>e.points));
 const model=arch.parse(source(`${defaults} ${local}`),{profile}),before=JSON.stringify(model);arch.layout(model);arch.renderToString(model);assert.equal(JSON.stringify(model),before);
 const path='M 10 20 L 800 200';assert.equal(layout(`routes {path "${path}"} route e1 {color red width 2 dasharray none}`).edges[0].d,path,'style overrides do not discard inherited paths');
 const views=arch.parse(source(defaults,'view clean "Clean" {}'),{profile});assert.equal(arch.layout(views,{view:'clean'}).edges[0].color,undefined);
});

test('dash patterns support numeric arrays, SVG number strings, odd repetition and explicit solid overrides',()=>{
 for(const [input,expected]of [['[8,4]',[8,4]],['"8, 4"',[8,4]],['"8 4"',[8,4]],['[3]',[3,3]],['[1,2,3]',[1,2,3,1,2,3]],['[0,3]',[0,3]],['none',[]],['[]',[]]]) {
  const graph=layout(`routes {dasharray ${input}}`);assert.deepEqual(graph.edges[0].dasharray,expected,input);
  const path=edge(xml(render(`routes {dasharray ${input}}`)),'e1');assert.equal(path.getAttribute('stroke-dasharray'),expected.length?expected.join(' '):'none');
 }
 assert.equal(edge(xml(render()),'e1').getAttribute('stroke-dasharray'),'6 5','semantic dependency pattern remains default');
 const overridden=xml(render('routes {dasharray [8,4]} route e1 {dasharray none}'));assert.equal(edge(overridden,'e1').getAttribute('stroke-dasharray'),'none');assert.equal(edge(overridden,'e2').getAttribute('stroke-dasharray'),'8 4');
});

test('route style validation rejects nonfinite/out-of-range widths, invalid colors and unsafe/malformed dash values',()=>{
 for(const value of ['0','-1','0.01','65','"2"'])assert.throws(()=>layout(`routes {width ${value}}`),/width/i);
 for(const value of ['"#ggg"','"rgb(1,2,3)"','"url(https://invalid)"','true'])assert.throws(()=>layout(`routes {color ${value}}`),/color|string or word/);
 for(const value of ['[-1,2]','[0,0]','[10001,2]','[true,2]','["2",3]','""','"6,,4"','"6,"','"2px 4px"','"url(#a)"','2',`[${Array(33).fill(1).join(',')}]`])assert.throws(()=>layout(`routes {dasharray ${value}}`),/dasharray/);
 for(const rules of ['route e1 {width 0}','route data -> e1 {dasharray [0,0]}','route data -> e1 {color "#nope"}']) {
  const report=arch.validate(source(rules),{profile});assert.equal(report.valid,false);assert.ok(report.diagnostics[0].line>0);
 }
 const json=JSON.parse(arch.translate(source('routes {width 2}'),{profile}));json.architecture.views.v.routes.width=Infinity;assert.equal(arch.validate(json,{profile}).valid,false);
});

test('custom line colors also reach arrow, triangle, diamond and bidirectional markers; label colors remain themed',()=>{
 for(const style of ['flow','dependency','association','composition','realization','generalization'])for(const theme of ['light','dark']) {
  const p={...profile,relationTypes:{...profile.relationTypes,flow:{...profile.relationTypes.flow,style,directions:['forward']}}};
  const doc=xml(arch.renderToString(source('routes {color "#F00" width 2.5 dasharray [5,3]}'),{profile:p,theme,idPrefix:'styled'})),path=edge(doc,'e1');
  assert.equal(path.getAttribute('stroke'),'#ff0000');assert.equal(path.getAttribute('stroke-width'),'2.5');
  const kind=style==='composition'?'marker-start':'marker-end',head=marker(doc,path,kind);
  if(style!=='association') {assert.ok(head,style);const shape=head.getElementsByTagName('path')[0];assert.equal(shape.getAttribute(style==='composition'?'fill':'stroke'),'#ff0000');}
  const labels=groups(doc,'arch-edge-label');assert.ok(labels.every(label=>label.getElementsByTagName('text')[0].getAttribute('fill')!=='#ff0000'));
 }
 const both=source('routes {color rebeccapurple width 3}').replace('a -> hub','a <-> hub');
 // CSS3 names intentionally exclude later additions such as rebeccapurple.
 assert.equal(arch.validate(both,{profile}).valid,false);
 const doc=xml(arch.renderToString(both.replace('rebeccapurple','purple'),{profile})),path=edge(doc,'e1');
 assert.ok(marker(doc,path,'marker-start'));assert.ok(marker(doc,path,'marker-end'));
 const ids=[...doc.getElementsByTagName('*')].map(e=>e.getAttribute('id')).filter(Boolean);assert.equal(new Set(ids).size,ids.length);
});

test('reference connectors inherit line styles, accept independent overrides and retain automatic obstacle avoidance',()=>{
 const plain=layout(''),styled=layout('routes {color blue width 3 dasharray [8,4]}');
 assert.deepEqual(styled.referenceNodes.map(o=>o.points),plain.referenceNodes.map(o=>o.points));
 const g=layout('routes {color blue width 3 dasharray [8,4]} route data -> e1 {color orange width 2 dasharray none}');
 assert.equal(g.edges[0].color,'#0000ff');assert.equal(g.referenceNodes[0].color,'#ffa500');assert.equal(g.referenceNodes[0].width,2);assert.deepEqual(g.referenceNodes[0].dasharray,[]);
 const doc=xml(render('routes {color blue width 3 dasharray [8,4]} route data -> e1 {color orange width 2 dasharray none}'));
 const path=[...doc.getElementsByTagName('path')].find(p=>p.getAttribute('class')==='arch-reference-connector');
 assert.equal(path.getAttribute('stroke'),'#ffa500');assert.equal(path.getAttribute('stroke-width'),'2');assert.equal(path.getAttribute('stroke-dasharray'),'none');assert.equal(marker(doc,path).getElementsByTagName('path')[0].getAttribute('stroke'),'#ffa500');
 const fallback=[...xml(render()).getElementsByTagName('path')].find(p=>p.getAttribute('class')==='arch-reference-connector');assert.equal(fallback.hasAttribute('stroke-dasharray'),false);
});

test('shared paths require compatible colors, widths and dash patterns and paint the common style once',()=>{
 const base='routes {sharePath stereotypes color red width 2 dasharray [8,4]}';
 const same=layout(`${base} route e1 {color "#F00" dasharray "8 4"}`);
 assert.equal(same.sharedPaths.length,2);assert.equal(same.sharedPaths[0].color,'#ff0000');assert.equal(same.sharedPaths[1].width,2);assert.deepEqual(same.sharedPaths[0].dasharray,[8,4]);
 for(const different of ['color blue','width 3','dasharray none','dasharray [4,8]'])assert.equal(layout(`${base} route e1 {${different}}`).sharedPaths,undefined,different);
 const doc=xml(render(base));for(const g of groups(doc,'arch-shared-path')) {
  const path=g.getElementsByTagName('path')[0];assert.equal(path.getAttribute('stroke'),'#ff0000');assert.equal(path.getAttribute('stroke-width'),'2');assert.equal(path.getAttribute('stroke-dasharray'),'8 4');
 }
 assert.equal(layout('routes {sharePath stereotypes} route e1 {width 1.5 dasharray [6,5]}').sharedPaths.length,2,'explicit defaults match inherited style');
});

test('thick route markers stay within conservative SVG bounds while default and color-only bounds are unchanged',()=>{
 assert.deepEqual(layout('routes {color red}').bounds,layout('').bounds);
 const g=layout('routes {width 64}'),b=g.bounds;
 for(const e of [...g.edges,...g.referenceNodes])for(const p of e.points)assert.ok(p.x-64*12>=b.x&&p.y-64*12>=b.y&&p.x+64*12<=b.x+b.width&&p.y+64*12<=b.y+b.height);
});

test('JSON/DSL/meta preserve route styles, unknown-field candidates include them and both bundles render identically',async()=>{
 const s=source('routes {color blue width 2 dasharray [8,4]} route data -> e1 {color orange dasharray "2,3"}'),json=arch.translate(s,{profile});
 assert.match(json,/"dasharray": \[/);assert.match(json,/"dasharray": "2,3"/);
 assert.equal(arch.renderToString(json,{profile,idPrefix:'same'}),arch.renderToString(s,{profile,idPrefix:'same'}));
 assert.equal(arch.renderToString(arch.translate(json,{profile}),{profile,idPrefix:'same'}),arch.renderToString(s,{profile,idPrefix:'same'}));
 const inspection=arch.inspectSource(s.replace('color blue','colro blue'),{profile});assert.equal(inspection.valid,false);assert.match(JSON.stringify(inspection),/color/);
 assert.match(arch.help('routing'),/dasharray/);
 for(const file of ['arch.js','arch.min.js']) {
  const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
  assert.equal(context.arch.renderToString(s,{profile,idPrefix:'same'}),arch.renderToString(s,{profile,idPrefix:'same'}));
 }
});
