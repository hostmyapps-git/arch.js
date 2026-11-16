import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const example=await readFile('examples/meta.arch','utf8');
const xml=s=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(s,'image/svg+xml');

test('view-level @meta directives, shorthand meta and JSON source syntax select explicit source formats',()=>{
  for(const directive of ['@meta json','meta json']) {
    const source=`architecture "T" {model {} view code "Source" {${directive}\n}}`;
    const m=arch.parse(source);assert.equal(m.views[0].meta,'json');
    assert.equal(arch.layout(m).kind,'meta');assert.match(arch.renderToString(source),/data-arch-meta="json"/);
  }
  for(const field of ['@meta','meta']) {
    const json={architecture:{name:'T',model:{},views:{code:{name:'Source',[field]:'dsl'}}}};
    assert.equal(arch.layout(json).format,'dsl');assert.match(arch.renderToString(json),/data-arch-meta="dsl"/);
    assert.match(arch.translate(json),/@meta dsl/);
  }
});

test('architecture-level @meta adds named selectable views and retains deterministic order',()=>{
  const source='architecture "T" {config {views all} model {} view overview "Overview" {}\n@meta json\n@meta dsl\n}';
  const model=arch.parse(source);assert.deepEqual(model.views.map(v=>v.id),['overview','meta-json','meta-dsl']);
  assert.deepEqual(arch.layout(model).layouts.map(g=>g.view.id),['overview','meta-json','meta-dsl']);
  assert.equal(arch.layout(model,{view:'meta-dsl'}).kind,'meta');
  const json={architecture:{name:'T',model:{},views:{overview:{name:'Overview'}},'@meta':'json'}};
  assert.deepEqual(arch.parse(json).views.map(v=>v.id),['overview','meta-json']);
  assert.equal(arch.parse('architecture "Only source" {model {} @meta json\n}').views[0].id,'meta-json');
});

test('source views compose with diagrams in one standalone SVG and support explicit selection and themes',()=>{
  const model=arch.parse(example),before=JSON.stringify(model),graph=arch.layout(model);
  assert.equal(graph.layouts.length,3);assert.deepEqual(graph.layouts.map(g=>g.kind??'connected'),['connected','meta','meta']);
  assert.equal(graph.nodes.length,2);assert.equal(graph.edges.length,1);
  for(const theme of ['light','dark']) {
    const svg=arch.renderToString(model,{theme,idPrefix:'mixed'}),doc=xml(svg);
    assert.equal(doc.documentElement.getAttribute('data-arch-views'),'3');
    const metas=[...doc.getElementsByTagName('svg')].filter(e=>e.hasAttribute('data-arch-meta'));
    assert.deepEqual(metas.map(e=>e.getAttribute('data-arch-meta')),['json','dsl']);
    assert.ok(metas.every(e=>e.getAttribute('data-arch-svg')===theme));
    const ids=[...doc.getElementsByTagName('*')].filter(e=>e.hasAttribute('id')).map(e=>e.getAttribute('id'));assert.equal(new Set(ids).size,ids.length);
  }
  assert.equal(JSON.stringify(model),before);assert.equal(arch.layout(model,{views:['dslSource','overview']}).layouts[0].format,'dsl');
});

test('meta exports the complete architecture once, including its own directive without recursive expansion',()=>{
  const model=arch.parse(example),json=arch.layout(model,{view:'jsonSource'}),dsl=arch.layout(model,{view:'dslSource'});
  const document=JSON.parse(json.source);assert.equal(document.architecture.views.jsonSource['@meta'],'json');
  assert.equal(document.architecture.views.dslSource['@meta'],'dsl');assert.equal(Object.keys(document.architecture.model.elements).length,2);
  assert.equal(arch.validate(json.source).valid,true);assert.equal(arch.validate(dsl.source).valid,true);
  assert.ok(dsl.source.includes('@meta json'));assert.ok(dsl.source.includes('@meta dsl'));
  assert.equal((json.source.match(/"@meta"/g)??[]).length,2);
  assert.ok(json.rows.length<200);assert.equal(arch.layout(model,{view:'jsonSource'}).source,json.source);
});

test('source SVG wraps long lines, preserves indentation and escapes user text without foreignObject',()=>{
  const json={architecture:{name:'<safe>',model:{elements:{a:{type:'service',name:'<script>'+('Long 漢🙂 '.repeat(60))+'</script>'}}},views:{code:{name:'Code & source','@meta':'json'}}}};
  const graph=arch.layout(json),doc=xml(arch.renderToString(json,{idPrefix:'code'}));
  assert.ok(graph.rows.some(r=>r.continuation));assert.ok(graph.rows.some(r=>/^ +"/.test(r.text)));
  assert.equal(doc.getElementsByTagName('script').length,0);assert.equal(doc.getElementsByTagName('foreignObject').length,0);
  assert.ok([...doc.getElementsByTagName('text')].some(e=>e.getAttribute('xml:space')==='preserve'));
  assert.ok(graph.rows.every(r=>r.y<graph.bounds.height));assert.match(arch.renderToString(json),/&lt;script&gt;/);
});

test('meta views are independent of domain viewpoint requirements while model validation remains active',async()=>{
  for(const id of ['uaf','naf41-uaf'])arch.registerProfile(id,JSON.parse(await readFile(`profiles/${id}.json`,'utf8')));
  const source='architecture "NAF" {config {profile naf41-uaf} model {OperationalPerformer p "Performer"} view code "Source" {@meta json\n}}';
  assert.equal(arch.validate(source).valid,true);assert.equal(arch.layout(arch.parse(source)).kind,'meta');
  assert.equal(arch.validate(source.replace('OperationalPerformer','OperationalAgent')).valid,false,'An abstract model type cannot be hidden by a source view');
  assert.equal(arch.validate(source.replace('view code','view missing "Missing viewpoint" {} view code')).valid,false,'Other views still require a viewpoint');
});

test('invalid formats, duplicate directives, mixed diagram settings and context-free @meta fail clearly',()=>{
  const wrap=content=>`architecture "T" {model {} view code "Source" {${content}\n}}`;
  for(const body of ['@meta yaml','@meta','@meta json extra','@meta json\n@meta dsl','meta json meta dsl','meta json diagram connected','meta json viewpoint L3','meta json include a','meta json routes {curve straight}','meta json spacing 100','meta json direction down'])
    assert.equal(arch.validate(wrap(body)).valid,false,body);
  assert.throws(()=>arch.parse('@meta json'),/@meta requires architecture source/);
  assert.throws(()=>arch.parse('architecture "T" {model {} @meta json\n@meta json\n}'),/Duplicate view ID/);
  assert.equal(arch.validate({architecture:{name:'T',model:{},views:{code:{name:'Code','@meta':'yaml'}}}}).valid,false);
  const bad=arch.parse(wrap('meta json'));bad.views[0].meta='yaml';assert.equal(arch.validate(bad).valid,false);
  assert.ok(arch.inspectSource(wrap('@meta yaml')).diagnostics[0].candidates.some(c=>c.example==='@meta json'));
});

test('Markdown and both bundles preserve architecture source views and translation round trips',async()=>{
  const model=arch.parse(example),source=arch.translate(example),back=arch.translate(source);
  assert.match(arch.renderMarkdown('```arch\n'+example+'\n```'),/data-arch-meta="json"/);
  const options={idPrefix:'same'};assert.equal(arch.renderToString(back,options),arch.renderToString(model,options));
  for(const name of ['arch.js','arch.min.js']) {
    const context={};vm.createContext(context);vm.runInContext(await readFile(name,'utf8'),context);
    assert.equal(context.arch.renderToString(example,options),arch.renderToString(model,options));
  }
});
