import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

const profile=()=>({nodeTypes:{service:{template:'service',attributes:{owner:{required:true}}}},relationTypes:{link:{from:['service'],to:['service'],style:'flow',directions:['forward','both'],outgoing:{min:1,max:2},incoming:{min:1,max:2}}},defaultRelation:'link'});
const source=(body='service a "A"',extra='',config='')=>`architecture "Draft" {${config} model {${body}} ${extra}}`;
const pair='service a "A" {owner "Ops"} service b "B" {owner "Ops"} relation link a <-> b "Exchange"';
const defaultPair=pair.replaceAll(' {owner "Ops"}','');

test('draft turns only incomplete profile requirements into warnings and preserves strict validation',()=>{
  const text=source(),p=profile();
  assert.equal(arch.validate(text,{profile:p}).valid,false);assert.throws(()=>arch.renderToString(text,{profile:p}),/Missing required attribute/);
  const options={profile:p,validation:'draft'},report=arch.validate(text,options);
  assert.equal(report.valid,true);assert.equal(report.conformant,false);assert.equal(report.diagnostics.length,3);
  assert.ok(report.diagnostics.every(d=>d.severity==='warning'&&d.incomplete&&d.line));
  const graph=arch.layout(text,options),svg=arch.renderToString(text,{...options,idPrefix:'draft'});
  assert.equal(graph.kind,'notices');assert.equal(graph.nodes.length,1);assert.match(svg,/data-arch-validation="draft"/);assert.match(svg,/class="arch-validation-notices"/);
  assert.match(svg,/Missing required attribute owner/);assert.match(svg,/viewBox="0 0 420 /);
  assert.equal(Number(svg.match(/ height="([\d.]+)"/)[1]),graph.bounds.height);
  const parsed=arch.parse(text,options);assert.equal(arch.layout(JSON.parse(JSON.stringify(parsed))).kind,'notices');
  assert.equal(arch.validate(parsed,{validation:'strict'}).valid,false);
});

test('draft preserves type, value, reference, cardinality maximum, cycle, syntax and routing errors',()=>{
  const options={profile:profile(),validation:'draft'};
  for(const body of ['unknown a "A"','service a "A" {owner 3}',pair+' relation extra a -> missing "Missing"',pair+' relation x a -> b "X" relation y a -> b "Y"']) {
    assert.equal(arch.validate(source(body),options).valid,false,body);assert.throws(()=>arch.renderToString(source(body),options),arch.ArchError);
  }
  const p=profile();p.nodeTypes.service.attributes.ref={type:'reference',targets:['service']};
  assert.equal(arch.validate(source('service a "A" {ref absent}'),{profile:p,validation:'draft'}).valid,false);
  p.relationTypes.link.acyclic=true;assert.equal(arch.validate(source(pair),{profile:p,validation:'draft'}).valid,false);
  assert.equal(arch.validate(source(pair,'view v "V" {route link {curve invalid}}'),options).valid,false);
  assert.throws(()=>arch.renderToString('architecture "Broken" {model {',{validation:'draft'}),arch.ArchError);
  assert.throws(()=>arch.renderToString(source(),{validation:'relaxed'}),/validation must be strict or draft/);
});

test('draft permits missing viewpoint contents, connections and viewpoint selection; completed models have no footer',()=>{
  const p=profile();p.requireViewpoint=true;p.viewpoints={context:{nodes:['service'],relations:['link'],requiredRelations:['link'],requiredNodes:['service'],connections:[{nodes:['service'],relations:['link'],direction:'outgoing',min:1,max:2}]}};
  const options={profile:p,validation:'draft'};
  assert.match(arch.renderToString(source(),options),/requires a viewpoint/);
  const empty=source('','view v "V" {viewpoint context}'),report=arch.validate(empty,options);
  assert.equal(report.valid,true);assert.equal(report.diagnostics.length,2);
  assert.match(arch.renderToString(source(undefined,'view v "V" {viewpoint context}'),options),/outgoing connections/);
  const complete=source(pair,'view v "V" {viewpoint context}');
  assert.equal(arch.renderToString(complete,{...options,idPrefix:'same'}),arch.renderToString(complete,{profile:p,idPrefix:'same'}));
});

test('draft config and API precedence, JSON translations, notices once below stacked views, themes, and XML escaping',()=>{
  const text=source('service a "A"','view one "One" {} view two "Two" {}','config {validation draft extends default type service {template service attribute owner {required true}} views all}');
  const json=arch.translate(text);assert.equal(JSON.parse(json).architecture.config.validation,'draft');
  assert.deepEqual(arch.validate(json).diagnostics.map(d=>d.message),arch.validate(text).diagnostics.map(d=>d.message));
  assert.match(arch.renderToString(json),/arch-validation-notices/);
  assert.match(arch.translate(json),/validation "draft"/);
  assert.throws(()=>arch.renderToString(text,{validation:'strict'}),/Missing required attribute/);
  for(const theme of ['light','dark']) {
    const graph=arch.layout(text,{theme}),svg=arch.renderToString(text,{theme});
    assert.equal(graph.content.kind,'views');assert.ok(graph.bounds.height>graph.content.bounds.height);
    assert.equal((svg.match(/class="arch-validation-notices"/g)??[]).length,1);assert.match(svg,new RegExp(`data-arch-svg="${theme}"`));
  }
  const malicious=text.replace('architecture "Draft"','architecture "<script>"');
  const escaped=arch.renderToString(malicious);assert.doesNotMatch(escaped,/<script/);assert.match(escaped,/&lt;script&gt;/);
  assert.equal(arch.inspectSource(text).valid,true);assert.equal(arch.inspectSource(text).diagnostics[0].severity,'warning');
});

test('relationship display none hides paths, labels and reference connectors without changing model semantics',()=>{
  const config='config {extends default relation link {style flow directions [both] from service to service outgoing {min 1}} defaultRelation link}';
  const text=source(defaultPair,'view hidden "Hidden" {style link {display none} route link {icon core.cloud}} view shown "Shown" {style link {display standard}}',config);
  const model=arch.parse(text);assert.equal(model.edges.length,1);
  assert.equal(arch.layout(model,{view:'hidden'}).edges.length,0);assert.equal(arch.layout(model,{view:'shown'}).edges.length,1);
  const svg=arch.renderToString(model,{view:'hidden'});assert.doesNotMatch(svg,/class="arch-edge"|class="arch-edge-label"|data-icon="core.cloud"/);
  assert.equal(arch.validate(model).valid,true);
  const json=arch.translate(text);assert.equal(JSON.parse(json).architecture.views.hidden.style.link.display,'none');
  assert.equal(arch.renderToString(json,{view:'hidden',idPrefix:'same'}),arch.renderToString(text,{view:'hidden',idPrefix:'same'}));
  assert.throws(()=>arch.parse(source(defaultPair,'view v "V" {style link {display logo}}')),/Relationship styles support only display none or standard/);
  assert.throws(()=>arch.parse(source(defaultPair,'view v "V" {style link {display none width 300}}')),/Relationship styles support only/);
});

test('hidden edges disappear from matrices and explicit sequence messages and cannot produce carried reference connectors',()=>{
  const directed=defaultPair.replace('<->','->');
  for(const diagram of ['matrix {rows [a] columns [b]}','sequence {participants [a,b] messages [link]}','class']) {
    const text=source(directed,`view v "V" {diagram ${diagram} style link {display none}}`),graph=arch.layout(text),svg=arch.renderToString(text);
    assert.equal(graph.edges.length,0);assert.doesNotMatch(svg,/data-edge="link"|data-label-for="link"/);
    if(diagram.startsWith('matrix'))assert.match(svg,/>·<\/tspan>/);
  }
  const p=profile();p.nodeTypes.info={template:'artifact'};p.relationTypes.link.attributes={conveyed:{type:'reference',targets:['info'],many:true}};p.relationTypes.link.referenceLabels={conveyed:'Conveys'};p.relationTypes.link.referenceDisplay='nodes';
  const text=source(pair.replace('"Exchange"','"Exchange" {conveyed [i]}')+' info i "Information"','view v "V" {style link {display none} route i -> link {curve straight}}');
  const graph=arch.layout(text,{profile:p});assert.equal(graph.referenceNodes.length,0);assert.doesNotMatch(arch.renderToString(text,{profile:p}),/arch-reference-connector/);
});

test('draft and hidden edges work in both bundles and Markdown; example remains editable and input AST is unchanged',async()=>{
  const text=await readFile('examples/draft.arch','utf8'),model=arch.parse(text),before=JSON.stringify(model);
  assert.equal(arch.layout(model).edges.length,0);const expected=arch.renderToString(model,{idPrefix:'same'});assert.equal(JSON.stringify(model),before);
  assert.match(arch.renderMarkdown('```arch\n'+text+'\n```'),/arch-validation-notices/);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);assert.equal(context.arch.renderToString(text,{idPrefix:'same'}),expected);
  }
});

test('display none hides nodes, incident edges and package descendants even when explicitly included',()=>{
  const text=source('package outer "Outer" {package inner "Inner" {service a "A"}} service b "B" relation link a -> b "Link"',
    'view one "One" {include a,b style outer {display none}} view two "Two" {style a {display none}} view three "Three" {style a {display standard}}');
  const model=arch.parse(text),before=JSON.stringify(model);
  assert.deepEqual(arch.layout(model,{view:'one'}).nodes.map(n=>n.id),['b']);
  assert.equal(arch.layout(model,{view:'two'}).nodes.some(n=>n.id==='a'),false);assert.equal(arch.layout(model,{view:'two'}).edges.length,0);
  assert.equal(arch.layout(model,{view:'three'}).edges.length,1);
  const hidden=arch.renderToString(model,{view:'two'});assert.doesNotMatch(hidden,/data-node="a"|data-edge="link"/);
  assert.equal(JSON.stringify(model),before);
  assert.equal(arch.renderToString(arch.translate(text),{view:'one',idPrefix:'same'}),arch.renderToString(text,{view:'one',idPrefix:'same'}));
  assert.match(arch.renderToString('@help styles'),/Hide nodes, packages or relationships/);
});

test('all specialist renderers filter hidden participants and members safely, including empty views',async()=>{
  const model=arch.parse(await readFile('examples/diagrams.arch','utf8'));
  for(const view of model.views) {
    const original=arch.layout(model,{view:view.id});if(!original.nodes.length)continue;
    const changed=JSON.parse(JSON.stringify(model)),copy=changed.views.find(v=>v.id===view.id),hidden=original.nodes[0].id;
    copy.styles[hidden]={display:'none'};
    assert.equal(arch.layout(changed,{view:view.id}).nodes.some(n=>n.id===hidden),false,view.id);
    assert.doesNotMatch(arch.renderToString(changed,{view:view.id}),/NaN|Infinity|undefined/,view.id);
    for(const node of model.nodes)copy.styles[node.id]={display:'none'};
    assert.equal(arch.layout(changed,{view:view.id}).nodes.length,0);assert.doesNotMatch(arch.renderToString(changed,{view:view.id}),/NaN|Infinity|undefined/,view.id);
  }
});

test('presentation hides do not satisfy or suppress semantic requirements and both bundles hide nodes',async()=>{
  const p=profile();p.viewpoints={v:{nodes:['service'],relations:['link'],requiredNodes:['service'],requiredRelations:['link']}};
  const text=source(pair,'view v "V" {viewpoint v style a {display none}}');
  assert.equal(arch.validate(text,{profile:p}).valid,true);assert.deepEqual(arch.layout(text,{profile:p}).nodes.map(n=>n.id),['b']);
  const hidden=source(defaultPair,'view v "V" {style a {display none}}'),expected=arch.renderToString(hidden,{idPrefix:'same'});
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);assert.equal(context.arch.renderToString(hidden,{idPrefix:'same'}),expected);
  }
});
