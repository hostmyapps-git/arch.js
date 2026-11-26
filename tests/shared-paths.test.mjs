import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.studio.js';
import {pathSamples} from '../src/reference-nodes.js';
const profile={nodeTypes:{actor:{},item:{}},relationTypes:{flow:{style:'dependency',from:['actor'],to:['actor'],directions:['forward','both'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceDisplay:'nodes',referenceLabels:{payload:'Carries'}},other:{style:'dependency',from:['actor'],to:['actor']},solid:{style:'association',from:['actor'],to:['actor']}}};
const source=(rules='',type='flow',reverse=false)=>`architecture "Shared paths" {model {
 actor a "A" actor b "B" actor hub "Hub"
 relation e1 ${reverse?'hub -> a':'a -> hub'} "Applies to" {type flow}
 relation e2 ${reverse?'hub -> b':'b -> hub'} "Applies to" {type ${type}}}
 view v "Network" {place a at (0,0) place b at (0,300) place hub at (700,150) ${rules}}}`;
const layout=(rules='',type='flow',reverse=false)=>arch.layout(source(rules,type,reverse),{profile});
const xml=svg=>new DOMParser().parseFromString(svg,'image/svg+xml');

test('path sharing is opt-in; stereotypes shares only the same exact type; all still requires compatible styles',()=>{
 assert.equal(layout().sharedPaths,undefined);
 assert.equal(layout('routes {sharePath none}').sharedPaths,undefined);
 assert.equal(layout('routes {sharePath stereotypes}').sharedPaths.length,2);
 assert.equal(layout('routes {sharePath stereotypes}','other').sharedPaths,undefined);
 assert.equal(layout('routes {sharePath all}','other').sharedPaths.length,2);
 assert.equal(layout('routes {sharePath all}','solid').sharedPaths,undefined);
 const inherited={...profile,relationTypes:{...profile.relationTypes,child:{extends:'flow'}}};
 assert.equal(arch.layout(source('routes {sharePath stereotypes}','child'),{profile:inherited}).sharedPaths,undefined);
});

test('local options win; explicit geometry, straight/bezier, mixed directions and parallel links remain independent',()=>{
 for(const rules of ['route e1 {sharePath none}','route e1 {via (400,-100)}','route e1 {path "M 220 48 L 700 198"}','route e1 {curve straight}','route e1 {curve bezier via (300,0),(500,0)}'])
  assert.equal(layout(`routes {sharePath stereotypes} ${rules}`).sharedPaths,undefined,rules);
 assert.equal(layout('routes {sharePath none} route e1 {sharePath stereotypes} route e2 {sharePath stereotypes}').sharedPaths.length,2);
 assert.equal(arch.layout(source('routes {sharePath all}').replace('a -> hub','a <-> hub'),{profile}).sharedPaths,undefined);
 assert.equal(arch.layout(source('routes {sharePath stereotypes}').replace('b -> hub','a -> hub'),{profile}).sharedPaths,undefined);
 assert.throws(()=>layout('routes {sharePath unknown}'),/sharePath must be none, stereotypes or all/);
});

test('fan-in and fan-out work in all four orientations and keep full logical paths with one shared marker',()=>{
 for(const reverse of [false,true])for(const direction of ['left','right','top','bottom']) {
  let s=source('routes {sharePath stereotypes}', 'flow',reverse);
  const coords={left:[[0,0],[0,300],[700,150]],right:[[900,0],[900,300],[0,150]],top:[[0,0],[500,0],[250,700]],bottom:[[0,900],[500,900],[250,0]]}[direction];
  for(const [i,id]of ['a','b','hub'].entries())s=s.replace(new RegExp(`place ${id} at \\([^)]*\\)`),`place ${id} at (${coords[i]})`);
  const g=arch.layout(s,{profile});assert.equal(g.sharedPaths?.length,2,`${direction} ${reverse}`);
  for(const e of g.edges) {
   assert.equal(e.points.length,4);assert.equal(e.drawStart,!reverse);assert.equal(e.drawEnd,reverse);
   assert.ok(e.d.length>e.drawD.length);assert.equal(e.sharedPath,'shared-1');
  }
  const svg=xml(arch.renderToString(s,{profile}));
  assert.equal(svg.getElementsByTagName('g').length>0,true);
  const paths=[...svg.getElementsByTagName('g')].filter(g=>g.getAttribute('class')==='arch-shared-path');
  assert.equal(paths.length,2);
  const markers=[...svg.getElementsByTagName('path')].filter(p=>p.hasAttribute('marker-end'));
  assert.equal(markers.length,reverse?2:1);
 }
});

test('labels and icons remain distinct; explicit positions and hidden labels are respected',()=>{
 const g=layout('routes {sharePath stereotypes icon core.cloud iconPosition right} route e1 {label (350,-80)} route e2 {showLabel false}');
 assert.equal(g.sharedPaths.length,2);assert.deepEqual(g.edges[0].label,{x:350,y:-80});
 assert.equal(g.edges[0].labelIcon,'core.cloud');assert.equal(g.edges[1].labelIcon,'core.cloud');assert.deepEqual(g.edges[1].labelLines,[]);
 const hidden=layout('routes {sharePath stereotypes label none}');assert.ok(hidden.edges.every(e=>e.labelWidth===0));
 const svg=arch.renderToString(source('routes {sharePath stereotypes}'),{profile});
 for(const id of ['e1','e2'])assert.ok(svg.includes(`data-label-for="${id}"`));
 assert.ok(svg.includes('data-shared-for="e1 e2"'));
});

test('the shared stem rounds its bend when the hub is at the end of the shared spine',()=>{
 const s=source('routes {curve rounded sharePath all}').replace('(700,150)','(700,-220)');
 const g=arch.layout(s,{profile}),[spine,stem]=g.sharedPaths;
 assert.match(stem.d,/ Q /);
 assert.deepEqual(pathSamples(stem.d)[0],pathSamples(spine.d)[0]);
 for(const edge of g.edges)assert.equal(edge.d.endsWith(stem.d.slice(stem.d.indexOf(' Q '))),true);
});

test('obstructed corridors and insufficient space fall back to independent routes',()=>{
 const obstructed=source('routes {sharePath stereotypes} place block at (500,100)').replace('actor hub "Hub"','actor hub "Hub" actor block "Obstacle"');
 assert.equal(arch.layout(obstructed,{profile}).sharedPaths,undefined);
 assert.equal(arch.layout(source('routes {sharePath stereotypes}').replace('(700,150)','(260,150)'),{profile}).sharedPaths,undefined);
});

test('graphical reference attachments follow the complete shared logical path, without inheriting sharePath',()=>{
 const s=source('routes {sharePath stereotypes} route data -> e1 {to 1} place data at (400,-250)')
  .replace('actor hub "Hub"','actor hub "Hub" item data "Data"').replace('type flow}','type flow payload [data]}');
 const g=arch.layout(s,{profile});assert.equal(g.sharedPaths.length,2);
 const e=g.edges.find(e=>e.id==='e1'),ref=g.referenceNodes[0];
 const last=pathSamples(e.d).at(-1);assert.equal(ref.anchor.x,last.x);assert.equal(ref.anchor.y,last.y);
 assert.equal(ref.route.sharePath,undefined);
 assert.throws(()=>arch.parse(s.replace('route data -> e1 {to 1}','route data -> e1 {sharePath all}'),{profile}),/Unknown routing attribute: sharePath/);
});

test('JSON/DSL round-trips preserve sharePath; layouts are repeatable without modifying the model',()=>{
 const model=arch.parse(source('routes {sharePath stereotypes} route e1 {sharePath all}'),{profile}),before=JSON.stringify(model);
 const json=arch.translate(source('routes {sharePath stereotypes}'),{profile});
 assert.match(json,/"sharePath": "stereotypes"/);
 assert.equal(arch.layout(json,{profile}).sharedPaths.length,2);
 assert.match(arch.translate(json,{profile}),/sharePath "?stereotypes"?/);
 assert.deepEqual(arch.layout(model),arch.layout(model));assert.equal(JSON.stringify(model),before);
 assert.match(arch.help('routing'),/sharePath/);
});

test('NAF C8 p.101 vocabulary validates and shared paths also work inside a named tree group',async()=>{
 for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
 const s=await readFile('examples/shared-paths.arch','utf8');assert.equal(arch.validate(s).valid,true);
 assert.equal(arch.layout(s).sharedPaths.length,2);
 const tree=s.replace(/place search at.*\n\s*place availability at.*\n\s*place maritime at[^\n]*/,'tree g {nodes [search,availability,maritime] parentDirection target direction left}');
 const g=arch.layout(tree);assert.equal(g.sharedPaths?.length,2);
});
