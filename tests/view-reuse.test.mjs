import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as a from '../src/arch.js';
const doc=views=>`architecture "Reuse" {model {service a "A" service b "B" service c "C" relation e a -> b "E" relation f b -> c "F"} ${views}}`;
const base='view base "Base" {include a,b direction down theme dark spacing 120 style a {width 280 height 130} place a at (0,0) place b at (400,100) route e {curve straight color red}}';
const node=(g,id)=>g.nodes.find(n=>n.id===id);
test('extends merges effective selection and fields with local precedence without modifying source',()=>{
 const s=doc(base+'view ext "Extended" {extends base include c style a {height 200} route e {width 3} place c at (b.right+100,b.y)}');
 const m=a.parse(s),before=JSON.stringify(m),g=a.layout(m,{view:'ext'});
 assert.equal(g.nodes.length,3);assert.equal(node(g,'a').width,280);assert.equal(node(g,'a').height,200);assert.equal(g.view.direction,'down');assert.equal(g.view.theme,'dark');assert.equal(g.edges[0].color,'#ff0000');assert.equal(g.edges[0].width,3);assert.equal(a.layout(m,{view:'base'}).nodes.length,2);assert.equal(JSON.stringify(m),before);
});
test('embed preserves local geometry and internal routes, exposes group/card anchors and draws external links once',()=>{
 const s=doc(base+'view host "Host" {include c embed base as region place region at (200,300) place c at (region.right+80,b.y) route f {curve straight via (region.right+40,c.centerY)}}');
 const m=a.parse(s),before=JSON.stringify(m),g=a.layout(m,{view:'host'}),local=a.layout(m,{view:'base'});
 assert.equal(g.nodes.length,3);assert.equal(g.edges.length,2);assert.equal(node(g,'b').x-node(g,'a').x,node(local,'b').x-node(local,'a').x);assert.equal(node(g,'b').y-node(g,'a').y,100);assert.equal(g.treeGroups[0].bounds.x,200);assert.equal(node(g,'c').y,node(g,'b').y);assert.equal(g.edges[0].points.length,2);assert.equal(JSON.stringify(m),before);
});
test('nested embeds, inherited embeds, frame, tree source and outer measured styles work',()=>{
 const s=doc('view leaf "Leaf" {include a} view middle "Middle" {include b embed leaf place leaf at (0,0) place b at (leaf.right+60,0)} view host "Host" {include c embed middle as region {frame true} place region at (0,0) style c {height 2*a.height} place c at (region.right+60,0)} view derived "Derived" {extends host}');
 const g=a.layout(s,{view:'derived'});assert.equal(g.nodes.length,3);assert.equal(node(g,'c').height,2*node(g,'a').height);assert.match(a.renderToString(s,{view:'host'}),/data-embed="region"/);
 const tree=doc('view treeView "Tree" {include a,b diagram tree} view host "Host" {include c embed treeView}');assert.equal(a.layout(tree,{view:'host'}).nodes.length,3);
});
test('reuse detects missing sources, cycles, duplicate group IDs and forbidden internal overrides',()=>{
 for(const views of ['view x "X" {extends missing}','view x "X" {embed x}','view x "X" {extends y} view y "Y" {embed x}',base+'view h "H" {embed base embed base}',base+'view h "H" {embed base as a}',base+'view h "H" {embed base style a {width 300}}',base+'view h "H" {embed base route e {curve straight}}',base+'view h "H" {embed base exclude a}',base+'view h "H" {embed base diagram tree}'])assert.equal(a.validate(doc(views)).valid,false,views);
 const cyclic=doc(base+'view h "H" {include c embed base place base at (c.x,0) place c at (base.x,0)}');assert.equal(a.validate(cyclic).valid,false);
});
test('JSON DSL meta and both bundles preserve reuse declarations and geometry',async()=>{
 const s=doc(base+'view ext "Ext" {extends base style a {height 150}} view host "Host" {include c embed ext as region {frame true} place region at (0,0)}');
 const json=a.translate(s),dsl=a.translate(json,{format:'dsl'});assert.match(dsl,/embed ext as region/);assert.match(dsl,/extends base/);
 const opts={view:'host',idPrefix:'reuse'};assert.equal(a.renderToString(json,opts),a.renderToString(s,opts));assert.equal(a.renderToString(dsl,opts),a.renderToString(s,opts));
 for(const file of ['arch.js','arch.min.js']){const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);assert.equal(c.arch.renderToString(s,opts),a.renderToString(s,opts));}
});

test('embedded projections retain hidden edges, packages and graphical reference attachments',()=>{
 const profile={nodeTypes:{actor:{},item:{},package:{container:true,template:'package'}},relationTypes:{flow:{attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes',referenceConnectorLabels:true}}};
 const s='architecture "Refs" {model {actor a "A" actor b "B" item data "Data" actor c "C" relation e a -> b "Flow" {type flow payload [data]} relation hidden b -> a "Hidden" {type flow}} view base "Base" {include a,b,data style hidden {display none}} view host "Host" {embed base include c place base at (100,200) place c at (base.right+80,base.y)}}';
 const g=a.layout(s,{profile,view:'host'});assert.equal(g.edges.length,1);assert.equal(g.referenceNodes.length,1);assert.ok(g.referenceNodes[0].connectorLabel);assert.match(a.renderToString(s,{profile,view:'host'}),/data-reference-for="e"/);
 const shared=a.layout(s.replace('relation hidden b -> a', 'relation second b -> a \"Second\" {type flow payload [data]} relation hidden b -> a'),{profile,view:'host'});assert.equal(shared.referenceNodes.length,2);assert.equal(shared.referenceNodes[0].node,shared.referenceNodes[1].node);
 const pack='architecture "Packages" {model {package p "P" {service a "A" service b "B" relation e a -> b "E"}} view base "Base" {include p} view host "Host" {embed base place base at (100,200)}}';
 const original=a.layout(pack,{view:'base'}),embedded=a.layout(pack,{view:'host'});assert.equal(node(original,'b').x-node(original,'a').x,node(embedded,'b').x-node(embedded,'a').x);assert.equal(node(original,'p').width,node(embedded,'p').width);
});
test('embedding-only hosts show only source selection and preserve placed card dimensions in style expressions',()=>{
 const s=doc('view base "Base" {include a place a at (0,0) size (420,160)} view only "Only" {embed base} view host "Host" {embed base include c style c {width a.width height a.height}}');
 assert.equal(a.layout(s,{view:'only'}).nodes.length,1);const g=a.layout(s,{view:'host'});assert.equal(node(g,'c').width,420);assert.equal(node(g,'c').height,node(g,'a').height);
});
test('NAF S3 and derived/embedded S7 validate independently',async()=>{
 for(const id of ['uaf','naf41-uaf'])a.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
 const text=await readFile('examples/naf41-view-reuse.arch','utf8');assert.deepEqual(a.validate(text).diagnostics,[]);
 for(const view of ['s3','s7','embeddedS7'])assert.equal(a.layout(text,{view}).nodes.length,9);
 assert.equal(a.validate(text.replace('viewpoint S7','viewpoint C1')).valid,false);
});

test('extended views fit moved content instead of retaining the empty origin',()=>{
 const text=doc('view base "Base" {include a,b place a at (0,0) place b at (400,240)} view ext "Ext" {extends base place a at (-1.5*a.width,b.centerY-a.height/2)}');
 const g=a.layout(text,{view:'ext'});assert.equal(node(g,'a').y,240);assert.equal(g.bounds.y,192);
 const moved=doc('view base "Base" {include a place a at (900,700)}');const p=a.layout(moved);assert.equal(p.bounds.x,852);assert.equal(p.bounds.y,652);
 const negative=a.layout(moved.replace('(900,700)','(-900,-700)'));assert.equal(negative.bounds.width,p.bounds.width);assert.equal(negative.bounds.height,p.bounds.height);
 const empty=a.layout(doc('view empty "Empty" {exclude a,b,c}'));assert.ok(Number.isFinite(empty.bounds.width)&&empty.bounds.width>0);
});
test('tight outer bounds retain the full visible embedding frame',()=>{
 const g=a.layout(doc('view base "Base" {include a place a at (900,700)} view host "Host" {embed base {frame true} place base at (500,600)}'),{view:'host'});
 const box=g.embeddingGroups[0].bounds;assert.ok(g.bounds.x<=box.x&&g.bounds.y<=box.y);assert.ok(g.bounds.x+g.bounds.width>=box.x+box.width&&g.bounds.y+g.bounds.height>=box.y+box.height);
});
