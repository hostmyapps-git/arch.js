import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.studio.js';

const minimal = () => ({architecture:{name:'JSON',model:{elements:{a:{type:'service',name:'A'},b:{type:'database',name:'B'}},relations:{r:{from:'a',to:'b',name:'Reads',type:'access'}}}}});
const clean = value => JSON.parse(JSON.stringify(value, (key, value) => ['loc','attributeLocs'].includes(key) ? undefined : value));
const equivalent = (json, dsl) => {
  const before=JSON.stringify(json), model=arch.parse(json), text=arch.parse(dsl);
  assert.deepEqual(clean(model),clean(text));
  for(const options of [{idPrefix:'same'}, {idPrefix:'same',theme:'dark'}]) {
    assert.equal(arch.renderToString(json,options),arch.renderToString(text,options));
    assert.equal(arch.renderToString(JSON.stringify(json),options),arch.renderToString(text,options));
  }
  assert.equal(JSON.stringify(json),before,'JSON input stays unchanged');
};

test('JSON objects and strings use the same model, defaults, validation and SVG as DSL',()=>{
  const json=minimal();
  equivalent(json,'architecture "JSON" {model {service a "A" database b "B" relation r a -> b "Reads" {type access}}}');
  assert.equal(arch.validate(json).valid,true);
  assert.deepEqual(clean(arch.layout(json)),clean(arch.layout(arch.parse(json))));
  assert.equal(arch.renderToString(JSON.parse(JSON.stringify(arch.parse(json))),{idPrefix:'same'}),arch.renderToString(json,{idPrefix:'same'}));
});

test('packages, style flags, route defaults and multiple renderer views retain their DSL meaning',async()=>{
  const json=JSON.parse(await readFile('examples/json-architecture.json','utf8'));
  equivalent(json,`architecture "JSON architecture" {
    description "One model, two views, the same rules as the text syntax."
    config {views all}
    model {
      person user "User"
      package platform "Platform" {service api "API" {technology "REST"} database data "Data"}
      relation calls user -> api "Calls"
      relation reads api -> data "Reads" {type access}
    }
    view overview "Overview" {
      direction right place user at (0,100) place platform at (350,0)
      style api {iconPosition right showStereotype false}
      routes {curve straight icon core.cloud iconPosition top}
      route reads {showLabel false}
    }
    view matrix "Relationships" {include user,api,data diagram matrix {rows [user,api] columns [api,data]}}
  }`);
  assert.equal(arch.layout(json).kind,'views');
  assert.equal(arch.layout(json,{view:'matrix',views:'all'}).view.id,'matrix');
});

test('explicit arrays preserve order, reject duplicate IDs and permit forward references',()=>{
  const json={architecture:{name:'Ordered',config:{views:['second','first']},model:{
    relations:[{id:'r',from:'a',to:'b',name:'Flow'}],
    elements:[{id:'b',type:'service',name:'B'},{id:'a',type:'service',name:'A'}]
  },views:[{id:'first',name:'First'},{id:'second',name:'Second'}]}};
  assert.deepEqual(arch.parse(json).nodes.map(n=>n.id),['b','a']);
  assert.deepEqual(arch.layout(json).layouts.map(g=>g.view.id),['second','first']);
  json.architecture.model.elements.push({id:'a',type:'service',name:'Duplicate'});
  assert.equal(arch.validate(json).valid,false);
});

test('inline config follows DSL type/relation/viewpoint/attribute blocks, enums and inheritance',()=>{
  const json={architecture:{name:'Inline',config:{
    id:'company',version:'1',views:'all',styleGroup:{logical:{backgroundColor:'SlateBlue'}},
    type:{actor:{template:'person'},product:{template:'application',styleGroup:'logical',attribute:{
      owners:{type:'reference',targets:['actor'],many:true,minItems:1},level:{enum:['low','high']}
    }}},relation:{uses:{from:['actor'],to:['product'],style:'flow',outgoing:{max:3}}},defaultRelation:'uses',
    viewpoint:{context:{nodes:['actor','product'],relations:['uses'],requiredNodes:['actor','product'],requiredRelations:['uses']}}
  },model:{elements:{a:{type:'actor',name:'User'},b:{type:'product',name:'Portal',owners:['a'],level:'high'}},relations:{r:{from:'a',to:'b',name:'Uses'}}},views:{v:{name:'Context',viewpoint:'context'}}}};
  equivalent(json,`architecture "Inline" {config {
    id company version "1" views all styleGroup logical {backgroundColor SlateBlue}
    type actor {template person}
    type product {template application styleGroup logical attribute owners {type reference targets actor many true minItems 1} attribute level {enum low,high}}
    relation uses {from actor to product style flow outgoing {max 3}} defaultRelation uses
    viewpoint context {nodes actor,product relations uses requiredNodes actor,product requiredRelations uses}
  } model {actor a "User" product b "Portal" {owners [a] level high} relation r a -> b "Uses"}
    view v "Context" {viewpoint context}}`);
  json.architecture.model.elements.b.owners=['missing'];
  const report=arch.validate(json);assert.equal(report.valid,false);assert.match(report.diagnostics[0].path,/\/model\/elements\/b/);
});

test('all eight diagram types accept equivalent JSON settings and keep shared model data',()=>{
  const config={type:{thing:{template:'node',attribute:{score:{type:'number'},start:{format:'date'},end:{format:'date'}}}},relation:{flow:{from:['thing'],to:['thing'],style:'flow'}},defaultRelation:'flow',views:'all'};
  const model={elements:{a:{type:'thing',name:'A',score:1,start:'2026-01-01',end:'2026-02-01'},b:{type:'thing',name:'B',score:2,start:'2026-02-01',end:'2026-03-01'}},relations:{r:{from:'a',to:'b',name:'Flow'}}};
  const diagrams={connected:{},sequence:{participants:['a','b'],messages:['r']},state:{initial:'a',finals:['b']},activity:{initial:'a',finals:['b']},matrix:{rows:['a'],columns:['b']},heatmap:{valueAttribute:'score'},timeline:{startAttribute:'start',endAttribute:'end'},class:{propertyFields:['score']}};
  const views=Object.fromEntries(Object.entries(diagrams).map(([type,settings])=>[type,{name:type,diagram:{type,...settings}}]));
  const json={architecture:{name:'Eight',config,model,views}};
  const graph=arch.layout(json);assert.equal(graph.layouts.length,8);
  const svg=arch.renderToString(json);for(const type of Object.keys(diagrams)) assert.ok(svg.includes(`data-view-id="${type}"`));
  views.matrix.style={a:{showIcon:false}};assert.equal(arch.validate(json).valid,false,'connected-only restrictions still apply');
});

test('NAF typed payloads, shared cards and routed assignment arrows work in JSON',async()=>{
  for(const name of ['uaf','naf41-uaf']) arch.registerProfile(name,JSON.parse(await readFile(`profiles/${name}.json`,'utf8')));
  const json=JSON.parse(await readFile('examples/json-naf41.json','utf8'));
  equivalent(json,`architecture "Logical control" {config {profile naf41-uaf views all}
    model {OperationalPerformer fighter "Fighter" OperationalPerformer controller "Controller"
      InformationElement information "Control information"
      relation control controller -> fighter "Controls" {type LogicalInteraction conveyed [information]}}
    view logical "L3 · Logical interactions" {viewpoint L3 place controller at (0,0) place fighter at (600,0)
      routes {curve straight} route information -> control {from bottom to 0.5 via (300,260) curve rounded}}
  }`);
  json.architecture.model.elements.fighter.type='OperationalAgent';
  const report=arch.validate(json);assert.equal(report.valid,false);assert.match(report.diagnostics[0].message,/Concrete subtypes/);
  assert.equal(report.diagnostics[0].path,'/architecture/model/elements/fighter');
  assert.equal(arch.validate(minimal(),{profile:'default'}).valid,true);
  const overridden=minimal();overridden.architecture.config={profile:'naf41-uaf'};
  assert.equal(arch.validate(overridden).valid,false);
  assert.equal(arch.validate(overridden,{profile:'default'}).valid,true,'API profile overrides JSON config');
});

test('JSON routing supports coordinates, multiple waypoints, free paths, label none and per-field overrides',()=>{
  const json=minimal();json.architecture.views={v:{name:'Route',place:{a:{at:[-200,20],size:[200,140]},b:{at:[400,300]}},
    routes:{curve:'rounded',label:'none',icon:'core.cloud',iconPosition:'top'},
    route:{r:{from:[0,90],to:[400,370],via:[[80,90],[80,370]],label:[120,210],showIcon:false,showLabel:true}},
    style:{a:{fontSize:18,width:240,height:160,display:'standard',showIcon:false,showStereotype:false,showDescription:false,showTechnology:false,opacity:0.4}}}};
  // Standard display is implicit; the DSL currently only accepts the explicit logo mode.
  delete json.architecture.views.v.style.a.display;
  equivalent(json,`architecture "JSON" {model {service a "A" database b "B" relation r a -> b "Reads" {type access}}
    view v "Route" {place a at (-200,20) size (200,140) place b at (400,300)
      routes {curve rounded label none icon core.cloud iconPosition top}
      route r {from (0,90) to (400,370) via (80,90),(80,370) label (120,210) showIcon false showLabel true}
      style a {fontSize 18 width 240 height 160 showIcon false showStereotype false showDescription false showTechnology false opacity 0.4}}
  }`);
  json.architecture.views.v.route.r={path:'M0 0 C10 20 30 40 100 100',label:'none',icon:'none'};
  assert.match(arch.renderToString(json),/M0 0 C10 20 30 40 100 100/);
});

test('attribute bags retain custom names without structural collisions and preserve 0/false/string values',()=>{
  const json={architecture:{name:'Values',config:{type:{thing:{attribute:{name:{},value:{type:'number',enum:[0,1]},enabled:{type:'boolean',enum:[true,false]}}}}},model:{elements:{a:{type:'thing',name:'Title',attributes:{name:'Custom name',value:0,enabled:false}}}}}};
  const node=arch.parse(json).nodes[0];assert.equal(node.title,'Title');assert.deepEqual({...node.attributes},{name:'Custom name',value:0,enabled:false});
  json.architecture.model.elements.a.value=1;assert.equal(arch.validate(json).valid,false);
});

test('JSON help replaces the diagram and uses selected profiles just like @help',()=>{
  assert.equal(arch.help('json').includes('architecture'),true);
  assert.equal(arch.parse({'@help':'styles'}).kind,'help');
  assert.equal(arch.parse({architecture:{name:'Help',config:{profile:'default'},'@help':'types . service'}}).kind,'help');
  assert.match(arch.renderToString({'@help':'json'}),/<svg/);
  assert.equal(arch.validate({'@help':'profiles\narchitecture "Injected"'}).valid,false);
  assert.equal(arch.parse({'@help':'iconpacks core "x;}"'}).kind,'help','Quoted filter separators retain DSL meaning');
});

test('JSON errors identify pointers and source lines, and duplicate escaped keys are rejected',()=>{
  const json='{\n "architecture": {\n  "name": "Bad",\n  "model": {"elements": {"a": {"type": "service", "name": "A"}}},\n  "views": {"v": {"name": "View", "spacing": 0}}\n }\n}';
  const report=arch.validate(json);assert.equal(report.valid,false);assert.equal(report.diagnostics[0].line,5);assert.equal(report.diagnostics[0].path,'/architecture/views/v');
  for(const source of ['{"architecture":{"name":"A","name":"B","model":{}}}',String.raw`{"architecture":{"name":"A","\u006eame":"B","model":{}}}`]) {
    const r=arch.validate(source);assert.equal(r.valid,false);assert.match(r.diagnostics[0].message,/Duplicate JSON key/);
  }
  const malformed=arch.validate('{"architecture":');assert.equal(malformed.valid,false);assert.equal(malformed.diagnostics[0].code,'ARCH_JSON');
});

test('JSON rejects unsupported structure, injected identifiers, invalid Unicode and non-JSON values',()=>{
  const cases=[[],null,{architecture:{name:'Missing model'}},{architecture:{name:'X',model:{unknown:{}}}},
    {architecture:{name:'X',model:{elements:{a:{type:'service; model',name:'A'}}}}},
    {architecture:{name:'X',model:{elements:{a:{type:'service',name:'A\u0000'}}}}},
    {architecture:{name:'X',model:{elements:{a:{type:'service',name:'A',description:null}}}}}];
  for(const value of cases) assert.throws(()=>arch.parse(value),arch.ArchError);
  for(const invalid of [NaN,Infinity,undefined,()=>{},new Date()]) {const j=minimal();j.architecture.description=invalid;assert.throws(()=>arch.parse(j),arch.ArchError);}
  const cyclic=minimal();cyclic.architecture.model.self=cyclic;assert.throws(()=>arch.parse(cyclic),/Cyclic JSON/);
  assert.equal(arch.validate('{'.repeat(2_000_001)).valid,false);
  const deep=minimal();let cursor=deep.architecture;for(let i=0;i<130;i++)cursor=cursor.deep={};assert.throws(()=>arch.parse(deep),/nesting exceeds/);
  const large=minimal();large.architecture.model.elements=Array.from({length:1001},(_,i)=>({id:`n${i}`,type:'service',name:'N'}));assert.throws(()=>arch.parse(large),/1000 elements/);
  const j=minimal();j.architecture.model.elements.a.type='database';j.architecture.views={v:{name:'X',place:{a:{at:[1e8,0]}}}};assert.equal(arch.validate(j).valid,false);
});

test('JSON documents work in Markdown arch fences and existing parsed models still render',()=>{
  const json=minimal(), source=JSON.stringify(json);
  assert.match(arch.renderMarkdown(`\`\`\`arch\n${source}\n\`\`\``),/<svg/);
  const mixed=arch.renderMarkdown(`\`\`\`arch\n${source}\n\`\`\`\n\`\`\`arch\narchitecture "DSL" {model {service a "A"}}\n\`\`\``);
  assert.equal((mixed.match(/<svg\b/g)??[]).length,2,'DSL and JSON can be mixed in separate arch blocks');
  assert.equal(arch.renderToString(arch.parse(json),{idPrefix:'same'}),arch.renderToString(json,{idPrefix:'same'}));
});

test('both browser bundles accept JSON documents and retain source parity',async()=>{
  const json=JSON.parse(await readFile('examples/json-architecture.json','utf8'));
  for(const name of ['arch.core.min.js', 'arch.min.js']) {
    const sandbox={};vm.createContext(sandbox);vm.runInContext(await readFile(name,'utf8'),sandbox);
    assert.equal(sandbox.arch.renderToString(JSON.stringify(json),{idPrefix:'same'}),arch.renderToString(json,{idPrefix:'same'}));
    assert.equal(sandbox.arch.renderToString(json,{idPrefix:'same'}),arch.renderToString(json,{idPrefix:'same'}),'Objects from another JS realm are valid JSON input');
  }
});
