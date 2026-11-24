import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
import {pathSamples,pointOnPath} from '../src/reference-nodes.js';
const doc=(route,more='')=>`architecture "Labels" {model {service a "A" service b "B" service c "C" relation e a -> b "Flow"} view v "V" {place a at (0,0) place b at (600,200) ${route}} ${more}}`;
const node=(g,id)=>g.nodes.find(n=>n.id===id);
const position=(g,f)=>{const p=pointOnPath(pathSamples(g.edges[0].d),f);assert.deepEqual(g.edges[0].label,{x:p.x,y:p.y});};
test('calculated label coordinates use final nodes, styles, place arithmetic and explicit paths',()=>{
 for(const path of ['', 'path "M 0 0 C 20 900 800 100 600 0"']) {
  const source=doc(`style b {height 200} route e {${path} label ((a.right+b.x)/2,b.centerY-20)}`),model=arch.parse(source),before=JSON.stringify(model),g=arch.layout(model);
  assert.deepEqual(g.edges[0].label,{x:(node(g,'a').x+node(g,'a').width+node(g,'b').x)/2,y:node(g,'b').y+node(g,'b').height/2-20});assert.equal(JSON.stringify(model),before);
 }
});
test('relative labels follow final straight, orthogonal, rounded, bezier, free and self paths',()=>{
 for(const curve of ['curve straight','curve orthogonal via (300,-100),(450,400)','curve rounded via (300,-100),(450,400)','curve bezier via (220,-500),(600,-500)','path "M 20 50 Q 200 -400 600 100"'])for(const f of [0,0.2,0.5,1])position(arch.layout(doc(`route e {${curve} label ${f}}`)),f);
 position(arch.layout(doc('route e {label 1/4}').replace('e a -> b','e a -> a')),0.25);
});
test('label defaults, overrides, none and icons retain independent visibility and explicit positions',()=>{
 const s=doc('routes {curve straight label 0.25 icon core.cloud} route e {label (a.right+50,a.centerY-40)}');const g=arch.layout(s);assert.deepEqual(g.edges[0].label,{x:270,y:8});assert.ok(g.edges[0].labelIcon);
 position(arch.layout(doc('routes {label (100,100)} route e {label 0.75}')),0.75);
 const hidden=arch.layout(doc('routes {label 0.5} route e {label none}'));assert.equal(hidden.edges[0].labelHidden,true);assert.equal(hidden.edges[0].labelWidth,0);
});
test('label expressions reference tree/embed groups and imported nodes without mutating source geometry',()=>{
 const group=arch.layout(doc('tree g {nodes [a,b]} place g at (300,400) route e {label (g.centerX,g.y-40)}').replace('place a at (0,0) place b at (600,200)',''));
 assert.equal(group.edges[0].label.x,group.treeGroups[0].bounds.x+group.treeGroups[0].bounds.width/2);
 const source=doc('include a,b route e {label 0.25}','view host "Host" {embed v include c place v at (200,300) place c at (v.right+80,v.y)}');const g=arch.layout(source,{view:'host'});position(g,0.25);
});
test('invalid fractions, arithmetic, unknown and hidden label references report errors',()=>{
 for(const text of ['label -0.1','label 1.1','label 1/0','label (a.x/0,0)','label (missing.x,0)','style c {display none} route e {label (c.x,0)}','label (a.x**,0)']) {
  const route=text.startsWith('style')?text:`route e {${text}}`;assert.equal(arch.validate(doc(route)).valid,false,text);
 }
 assert.throws(()=>arch.layout(doc('route e {label (a.x/(b.x-600),0)}')),arch.ArchError);
 // An explicit path suppresses via evaluation, but never a calculated caption.
 const s=doc('route e {path "M 0 0 L 100 0" label (b.x,0)}').replace('place b at (600,200)','place b at (900,200)');assert.equal(arch.layout(s).edges[0].label.x,900);
});
test('JSON DSL meta and both bundles preserve label expressions and normalize fractions',async()=>{
 for(const label of ['(a.right+40,b.centerY-20)','1/3','0','1']) {
  const source=doc(`route e {curve rounded label ${label}}`),json=arch.translate(source),dsl=arch.translate(json,{format:'dsl'});
  const opts={idPrefix:'labels'};assert.equal(arch.renderToString(json,opts),arch.renderToString(source,opts));assert.equal(arch.renderToString(dsl,opts),arch.renderToString(source,opts));
  for(const file of ['arch.js','arch.min.js']){const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);assert.equal(c.arch.renderToString(source,opts),arch.renderToString(source,opts));}
 }
 const json=JSON.parse(arch.translate(doc('route e {label 0.5}')));json.architecture.views.v.route.e.label=['a.x } model {',0];assert.equal(arch.validate(json).valid,false);
 json.architecture.views.v.route.e.label='1/4';position(arch.layout(json),0.25);
});

test('shared paths use the full logical route and reference captions honor explicit label positions',()=>{
 const source='architecture "Shared" {model {service a "A" service b "B" service c "C" relation e a -> b "One" relation f a -> c "Two"} view v "V" {place a at (0,150) place b at (700,0) place c at (700,300) routes {sharePath all label 0.25}}}';
 const g=arch.layout(source);assert.ok(g.sharedPaths.length);position(g,0.25);
 const profile={nodeTypes:{actor:{},info:{}},relationTypes:{flow:{attributes:{payload:{type:'reference',targets:['info'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
 const text='architecture "Ref" {model {actor a "A" actor b "B" info i "Data" relation e a -> b "E" {type flow payload [i]}} view v "V" {place a at (0,0) place b at (700,0) route e {label (i.centerX,i.y-30)}}}';
 const refs=arch.layout(text,{profile});assert.equal(node(refs,'i').referenceOnly,undefined);assert.equal(refs.edges[0].label.y,node(refs,'i').y-30);
 const relative=arch.layout(text.replace('label (i.centerX,i.y-30)','label 0.3'),{profile});position(relative,0.3);
});

test('fixed label offsets follow route length in either direction, clamp endpoints and survive JSON/bundles',async()=>{
 for(const path of ['curve straight','curve rounded via (300,-200),(450,400)','curve bezier via (200,-500),(600,-100)','path "M 0 0 L 100 0 M 200 0 L 400 0"'])for(const offset of [-80,20,100000,-100000]) {
  const source=doc(`route e {${path} label 1/2 offset ${offset}}`),g=arch.layout(source),edge=g.edges[0],points=pathSamples(edge.d),length=points.slice(1).reduce((n,p,i)=>n+(p.move?0:Math.hypot(p.x-points[i].x,p.y-points[i].y)),0);
  position(g,Math.max(0,Math.min(1,.5+offset/length)));
  assert.equal(arch.renderToString(source,{idPrefix:'offset'}),arch.renderToString(arch.translate(source),{idPrefix:'offset'}));
 }
 const source=doc('routes {label 0.25 offset 60} route e {label 0.5 offset -20}');
 for(const file of ['arch.js','arch.min.js']){const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);assert.equal(c.arch.renderToString(source,{idPrefix:'offset'}),arch.renderToString(source,{idPrefix:'offset'}));}
 const zero=arch.layout(doc('route e {path "M 20 30 L 20 30" label 0.5 offset 200}'));assert.deepEqual(zero.edges[0].label,{x:20,y:30});
 const direct=arch.layout(doc('route e {curve straight label 0 offset 80}'));assert.ok(Math.abs(Math.hypot(direct.edges[0].label.x-direct.edges[0].points[0].x,direct.edges[0].label.y-direct.edges[0].points[0].y)-80)<1e-6);
 const end=arch.layout(doc('route e {curve straight label 1 offset -40}'));assert.ok(end.edges[0].label.x<end.edges[0].points.at(-1).x);
});
test('fixed offsets reject invalid ranges, unsupported coordinate combinations and malformed JSON',()=>{
 for(const label of ['0.5 offset 10000001','0.5 offset "bad"','(a.x,b.y) offset 20','0.5 offset 20 offset 10'])assert.equal(arch.validate(doc(`route e {label ${label}}`)).valid,false);
 const json=JSON.parse(arch.translate(doc('route e {label 0.5}')));
 for(const label of [{position:1.5,offset:20},{position:.5,offset:'bad'},{position:.5,offset:1e8},{position:.5,offset:20,extra:true}]){json.architecture.views.v.route.e.label=label;assert.equal(arch.validate(json).valid,false);}
});

test('sideOffset follows the local path direction after offset, including bidirectional routes',()=>{
 const forward=doc('route e {from right to left curve straight label 0.5 sideOffset 24}')
   .replace('a -> b','a <-> b').replace('(600,200)','(600,0)');
 const backward=forward.replace('a <-> b','b <-> a').replace('from right to left','from left to right');
 for (const [source,delta] of [[forward,-24],[backward,24]]) {
  const edge=arch.layout(source).edges[0];
  assert.equal(edge.direction,'both');
  assert.equal(edge.label.y,edge.points[0].y+delta);
 }
 const bent='path "M 0 0 L 100 0 L 100 100"';
 assert.deepEqual(arch.layout(doc(`route e {${bent} label 0.25 offset 70 sideOffset -24}`)).edges[0].label,{x:76,y:20});
 assert.deepEqual(arch.layout(doc(`route e {${bent} label 0.5 sideOffset 24}`)).edges[0].label,{x:100,y:-24});
 assert.deepEqual(arch.layout(doc('route e {path "M 20 30 L 20 30" label 0.5 sideOffset 200}')).edges[0].label,{x:20,y:30});

 const source=doc('route e {path "M 0 0 Q 50 80 100 100" label 1/2 sideOffset a.width/10 offset 10}');
 const edge=arch.layout(source).edges[0], anchor=pointOnPath(pathSamples(edge.d),0.5,10);
 const delta={x:edge.label.x-anchor.x,y:edge.label.y-anchor.y};
 assert.ok(Math.abs(Math.hypot(delta.x,delta.y)-22)<1e-8);
 assert.ok(Math.abs(delta.x*anchor.dx+delta.y*anchor.dy)<1e-8);
 const json=arch.translate(source), options={idPrefix:'side-offset'};
 assert.deepEqual(JSON.parse(json).architecture.views.v.route.e.label,{position:0.5,offset:10,sideOffset:'a.width / 10'});
 assert.equal(arch.renderToString(json,options),arch.renderToString(source,options));
 assert.equal(arch.renderToString(arch.translate(json,{format:'dsl'}),options),arch.renderToString(source,options));
 for (const label of ['0.5 sideOffset 10000001','0.5 sideOffset missing.width','0.5 sideOffset 5 sideOffset 10'])
  assert.equal(arch.validate(doc(`route e {label ${label}}`)).valid,false,label);
});

test('standalone sideOffset shifts the automatically chosen label and composes with explicit placement',()=>{
 const path='path "M 100 40 L 0 40"';
 for (const [label,delta] of [['',24],['label (30,70)',24],['label 0.5 sideOffset -8',16]]) {
  const base=doc(`route e {${path} ${label}}`), input=doc(`route e {sideOffset a.width / 10 + 2 ${path} ${label}}`);
  const original=arch.layout(base).edges[0].label;
  const expected=label.includes('sideOffset')?{x:50,y:40+delta}:{x:original.x,y:original.y+delta};
  assert.deepEqual(arch.layout(input).edges[0].label,expected);
  assert.deepEqual(arch.layout(arch.translate(input)).edges[0].label,expected);
 }
 assert.equal(arch.validate(doc('route e {sideOffset missing.width}')).valid,false);
});

test('offset expressions use final card/group measures, retain source expressions and match JSON and bundles',async()=>{
 const source=doc('style a {width 300} route e {label 0 offset (a.width/2 + b.height/4) curve straight}').replace('place b at (600,200)','place b at (900,0)');
 const m=arch.parse(source),before=JSON.stringify(m),g=arch.layout(m),edge=g.edges[0];assert.equal(edge.label.x,edge.points[0].x+node(g,'a').width/2+node(g,'b').height/4);assert.equal(JSON.stringify(m),before);
 const json=arch.translate(source);assert.equal(typeof JSON.parse(json).architecture.views.v.route.e.label.offset,'string');assert.equal(arch.renderToString(json,{idPrefix:'expression-offset'}),arch.renderToString(source,{idPrefix:'expression-offset'}));
 assert.equal(arch.renderToString(arch.translate(json,{format:'dsl'}),{idPrefix:'expression-offset'}),arch.renderToString(source,{idPrefix:'expression-offset'}));
 for(const file of ['arch.js','arch.min.js']){const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);assert.equal(c.arch.renderToString(source,{idPrefix:'expression-offset'}),arch.renderToString(source,{idPrefix:'expression-offset'}));}
 const tree=arch.layout(doc('tree g {nodes [a,b]} route e {label 0.5 offset -g.width/8}').replace('place a at (0,0) place b at (600,200)',''));assert.ok(Number.isFinite(tree.edges[0].label.x));
 const free=arch.layout(doc('route e {path "M 0 0 L 900 0" label 0 offset a.width/2}'));assert.equal(free.edges[0].label.x,node(free,'a').width/2);
});
test('offset expression validation rejects invisible/unknown anchors and unsafe or undefined calculations',()=>{
 for(const rules of ['route e {label 0.5 offset missing.width/2}','style c {display none} route e {label 0.5 offset c.width/2}','route e {label 0.5 offset a.width/0}','route e {label 0.5 offset a.width**2}'])assert.equal(arch.validate(doc(rules)).valid,false,rules);
 assert.throws(()=>arch.layout(doc('route e {label 0.5 offset a.width/(b.width-220)}')),arch.ArchError);
 assert.throws(()=>arch.layout(doc('route e {label 0.5 offset a.width*100000}')),arch.ArchError);
 const json=JSON.parse(arch.translate(doc('route e {label 0.5}')));json.architecture.views.v.route.e.label={position:.5,offset:'a.width } model {'};const r=arch.validate(json);assert.equal(r.valid,false);assert.match(r.diagnostics[0].path,/label\/offset/);
});
