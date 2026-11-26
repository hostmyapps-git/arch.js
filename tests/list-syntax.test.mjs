import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

const model='application a "A" {description "First"} application b "B" application c "C" relation flow a -> b "Calls" {type flow}';
const doc=(view,contents=model)=>`architecture "Lists" {model {${contents}} view v "V" {${view}}}`;
const source=doc('include a,b,c exclude c propertyFields [title,description] diagram connected {propertyFields [id,type]} style a {propertyFields [title]} tree g {nodes [a,b] direction down} place g at (0,0)');

test('both list syntaxes normalize identically at every supported view, diagram, style and tree location',()=>{
  const expected=arch.translate(source),svg=arch.renderToString(source,{idPrefix:'lists'});
  const options=[['include a,b,c','include [a,b,c]'],['exclude c','exclude [c]'],['propertyFields [title,description]','propertyFields title,description'],['propertyFields [id,type]','propertyFields id,type'],['propertyFields [title]','propertyFields title'],['nodes [a,b]','nodes a,b']];
  for(let mask=0;mask<64;mask++) {
    let variant=source;
    options.forEach(([a,b],i)=>{if(mask&(1<<i))variant=variant.replace(a,b);});
    assert.deepEqual(arch.validate(variant).diagnostics,[],variant);
    assert.equal(arch.translate(variant),expected,'source JSON is independent of list spelling');
    assert.equal(arch.renderToString(variant,{idPrefix:'lists'}),svg);
  }
});

test('single entries normalize to arrays and stop before following options on the same line',()=>{
  const s=doc('include a exclude c tree g {nodes a direction down} propertyFields title style a {propertyFields id width 250} diagram connected {propertyFields type}');
  const v=arch.parse(s).views[0];
  assert.deepEqual(v.include,['a']);assert.deepEqual(v.exclude,['c']);assert.deepEqual(v.trees.g.nodes,['a']);
  assert.deepEqual(v.propertyFields,['title']);assert.deepEqual(v.styles.a.propertyFields,['id']);assert.deepEqual(v.diagram.propertyFields,['type']);
  assert.equal(v.trees.g.direction,'down');assert.equal(v.styles.a.width,250);
  assert.equal(arch.validate(s).valid,true);
  for(const renderer of ['tree','class'])for(const fields of ['title,type','[title,type]'])assert.equal(arch.validate(doc(`diagram ${renderer} {propertyFields ${fields}}`)).valid,true);
  assert.equal(arch.validate(doc('propertyFields "title", "type"')).valid,true,'quoted property names remain supported');
  assert.equal(arch.validate(doc('tree g {nodes ["a","b"]}')).valid,true,'quoted tree members remain supported for JSON roundtrips');
});

test('explicit empty lists retain their selection and clearing meanings in DSL, JSON and translation',()=>{
  const s=doc('include [] exclude [] propertyFields [] diagram connected {propertyFields []}');
  const v=arch.parse(s).views[0];assert.deepEqual(v.include,[]);assert.deepEqual(v.exclude,[]);
  assert.equal(arch.layout(s).nodes.length,0,'explicit empty include selects no elements');
  const json=arch.translate(s);
  assert.equal(arch.renderToString(json,{idPrefix:'empty'}),arch.renderToString(s,{idPrefix:'empty'}));
  assert.equal(arch.renderToString(arch.translate(json),{idPrefix:'empty'}),arch.renderToString(s,{idPrefix:'empty'}));
  assert.equal(arch.layout(doc('exclude []')).nodes.length,3,'empty exclude removes nothing');
  const clear=doc('propertyFields title,description style a {propertyFields []}');
  assert.equal(arch.layout(clear).nodes.find(n=>n.id==='a').propertyRows.length,0,'empty style clears inherited fields');
  assert.match(arch.validate(doc('tree g {nodes []}')).diagnostics[0].message,/nonempty list/);
});

test('style target lists and single targets merge in source order per field',()=>{
  for(const targets of ['[a, b]','a, b']) {
    const declarations=`style a {height 120 width 240}
      style ${targets} {display none width 280}
      style b {display standard height 140}
      style [b, c] {width 320}
      style a {display standard}
      style [c, flow] {display none}`;
    const input=doc(declarations), graph=arch.layout(input);
    assert.deepEqual(graph.nodes.map(({id,width,height})=>[id,width,height]),[['a',280,120],['b',320,140]]);
    assert.equal(graph.edges.length,0);
    const json=arch.translate(input);
    assert.deepEqual(JSON.parse(json).architecture.views.v.style,{
      a:{height:120,width:280,display:'standard'}, b:{width:320,display:'standard',height:140},
      c:{width:320,display:'none'}, flow:{display:'none'}
    });
    assert.equal(arch.renderToString(json,{idPrefix:'styles'}),arch.renderToString(input,{idPrefix:'styles'}));
  }
});

test('list alternatives retain errors for missing commas, malformed arrays, duplicates and invalid entries',()=>{
  for(const view of ['include [a b]','include [a,]','include [[a]]','include [a','include 1','exclude [] ,a','tree g {nodes a b}','tree g {nodes [a,a]}','tree g {nodes [a,]}','propertyFields title,type,','propertyFields [title,title]','propertyFields [title,1]','style a {propertyFields title,title}','style [] {}','style [a b] {}','style a, {}','style [a, missing] {display none}','style [a, flow] {width 280}','diagram connected {propertyFields [[title]]}']) {
    const result=arch.validate(doc(view));assert.equal(result.valid,false,view);
    assert.ok(result.diagnostics[0].line>0);assert.ok(result.diagnostics[0].column>0);
  }
});

test('route target lists apply and override properties per relationship in source order',()=>{
  const contents=`${model} relation reply b -> c "Reply" relation virtual a -> c "Alternate"`;
  for(const targets of ['flow, reply','[flow, reply]']) {
    const input=doc(`routes {color gray width 1}
      route flow {width 2 from right}
      route ${targets} {from bottom 1/2 to top color blue curve rounded}
      route reply {to bottom width 4}
      route virtual, reply {curve straight}`,contents);
    const json=arch.translate(input);
    assert.deepEqual(JSON.parse(json).architecture.views.v.route,{
      flow:{width:2,from:{side:'bottom',position:0.5},to:'top',color:'blue',curve:'rounded'},
      reply:{from:{side:'bottom',position:0.5},to:'bottom',color:'blue',curve:'straight',width:4},
      virtual:{curve:'straight'},
    });
    assert.equal(arch.renderToString(input,{idPrefix:'route-lists'}),arch.renderToString(json,{idPrefix:'route-lists'}));
  }
  const state=doc('diagram state route flow, reply {curve straight}',contents);
  const separate=doc('diagram state route flow {curve straight} route reply {curve straight}',contents);
  assert.equal(arch.renderToString(state,{idPrefix:'route-lists'}),arch.renderToString(separate,{idPrefix:'route-lists'}));
  for(const [route,message] of [
    ['route [] {}',/at least one relationship ID/],
    ['route flow, {}',/Expected: identifier/],
    ['route flow, missing {}',/Unknown relationship: missing/],
    ['route flow, reply {curve straight curve rounded}',/Duplicate routing attribute: curve/],
  ]) assert.match(arch.validate(doc(route,contents)).diagnostics[0]?.message??'',message);
});

test('source translation, meta and both browser bundles preserve list meanings',async()=>{
  const s=source.replace('include a,b,c','include [a,b,c]').replace('nodes [a,b]','nodes a,b').replace('propertyFields [title,description]','propertyFields title,description')
    .replace('style a {propertyFields [title]}','style [a,b] {propertyFields [title]} style a {propertyFields type}');
  const expected=arch.renderToString(s,{idPrefix:'lists'});
  assert.equal(arch.renderToString(arch.translate(s),{idPrefix:'lists'}),expected);
  const meta=arch.renderToString(s.replace(/}$/, 'view meta "Source" { @meta json\n }}'),{view:'meta'});
  assert.match(meta,/include/);assert.match(meta,/propertyFields/);
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    assert.equal(context.arch.renderToString(s,{idPrefix:'lists'}),expected);
    assert.deepEqual(JSON.parse(context.arch.translate(s)),JSON.parse(arch.translate(s)));
  }
});
