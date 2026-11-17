import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

for(const name of ['enterprise','uaf','naf4-uaf','naf41-uaf']) {
  const profile=JSON.parse(await readFile(`profiles/${name}.json`,'utf8'));arch.registerProfile(profile.id,profile);
}
for(const name of ['bootstrap','lucide','tabler'])arch.registerIconPack(name,JSON.parse(await readFile(`icons/${name}.json`,'utf8')));

test('all shipped DSL and JSON models round-trip with identical diagrams and equivalent diagnostics for every view',async()=>{
  const diagram=svg=>svg.includes('data-arch-validation="draft"')?svg.slice(svg.indexOf('<svg x="0" y="0"'),svg.indexOf('<g class="arch-validation-notices"')):svg;
  for(const file of (await readdir('examples')).filter(f=>/\.(arch|json)$/.test(f))) {
    const source=await readFile(`examples/${file}`,'utf8'),translated=arch.translate(source),back=arch.translate(translated);
    const model=arch.parse(source);
    const messages=input=>arch.validate(input).diagnostics.map(d=>d.message);
    assert.deepEqual(messages(translated),messages(source));assert.deepEqual(messages(back),messages(source));
    for(const theme of ['light','dark'])for(const view of model.views) {
      const options={view:view.id,theme,idPrefix:'same'};
      assert.equal(diagram(arch.renderToString(translated,options)),diagram(arch.renderToString(source,options)),`${file}:${view.id}:${theme}`);
      assert.equal(diagram(arch.renderToString(back,options)),diagram(arch.renderToString(source,options)),`${file}:back:${view.id}:${theme}`);
    }
  }
});

test('translation preserves inline profiles, reference attributes, nested packages, point routes and visibility',()=>{
  const source=`architecture "Inline" {config {type thing {template node attribute name {} attribute score {type integer}} relation flow {from thing to thing} defaultRelation flow views all}
    model {thing a "A" {name "Domain name" score 0} thing b "B" {score 1} relation r a -> b "Flow"}
    view v "V" {routes {label none curve straight} route r {label (120,200) from (0,0) to (400,0) via (100,30) icon core.cloud iconPosition top showLabel false} style a {showIcon false showStereotype false}}}`;
  const target=arch.translate(source),parsed=JSON.parse(target);
  assert.equal(parsed.architecture.model.elements.a.attributes.name,'Domain name');
  assert.equal(parsed.architecture.model.elements.a.score,0);
  assert.deepEqual(parsed.architecture.views.v.route.r.label,[120,200]);
  assert.equal(arch.renderToString(target,{idPrefix:'same'}),arch.renderToString(source,{idPrefix:'same'}));
  assert.equal(arch.inspectSource(source).valid,true);
});

test('help sources translate in both directions with their selected profile and query',()=>{
  for(const source of ['@help json','@help types default service','architecture "Help" {config {profile naf41-uaf} @help connections . OperationalPerformer\n}']) {
    const target=arch.translate(source),back=arch.translate(target);
    assert.deepEqual(arch.parse(target).help,arch.parse(source).help);
    assert.deepEqual(arch.parse(back).help,arch.parse(source).help);
    assert.equal(arch.inspectSource(source).valid,true);
  }
});

test('meta diagnostics repair DSL syntax using the original line and nearest valid keyword',()=>{
  const result=arch.inspectSource('architecture "Test" {\n  modle {}\n}');
  assert.equal(result.output,null);assert.equal(result.valid,false);assert.equal(result.sourceFormat,'dsl');assert.equal(result.targetFormat,'json');
  assert.equal(result.diagnostics[0].line,2);assert.equal(result.diagnostics[0].candidates[0].example,'model');
  for(const [source,word] of [['architecture "Test" {model {}','Close the block'],['architecture "Test" {}','Add a model block'],['architecture "Test" {model {service a Wrong}}','Quote the title'],['architecture "T" {model {} view v Wrong {}}','Quote the title']]) {
    assert.ok(arch.inspectSource(source).diagnostics[0].candidates.some(c=>c.label===word),source);
  }
  const punctuation=arch.inspectSource('architecture "T" {model {service a "A"} view v "V" {place a at (0 0)}}');
  assert.ok(punctuation.diagnostics[0].candidates.some(c=>c.example===','));
  const profile=arch.inspectSource('architecture "T" {config {type thing {abstrct true}} model {}}');
  assert.equal(profile.diagnostics[0].candidates[0].example,'abstract');
  const jsonProfile=arch.inspectSource({architecture:{name:'T',config:{type:{thing:{abstrct:true}}},model:{}}});
  assert.equal(jsonProfile.diagnostics[0].candidates[0].example,'abstract');
});

test('meta diagnostics repair JSON syntax, duplicate keys, misspelled fields and coordinate values',()=>{
  const misspelled={architecture:{name:'T',model:{},views:{v:{name:'V',dierection:'right'}}}};
  const result=arch.inspectSource(JSON.stringify(misspelled,null,2));
  assert.equal(result.output,null);assert.equal(result.diagnostics[0].path,'/architecture/views/v/dierection');
  assert.equal(result.diagnostics[0].candidates[0].example,'direction');
  const invalid=arch.inspectSource('{\n "architecture": {\n');assert.equal(invalid.output,null);assert.ok(invalid.diagnostics[0].line>=2);assert.ok(invalid.diagnostics[0].candidates.length);
  assert.match(arch.inspectSource('{"architecture":{"name":"A","name":"B","model":{}}}').diagnostics[0].candidates[0].label,/unique/);
  const point={architecture:{name:'T',model:{elements:{a:{type:'service',name:'A'}}},views:{v:{name:'V',place:{a:{at:[0]}}}}}};
  assert.equal(arch.inspectSource(point).diagnostics[0].candidates[0].example,'[0, 0]');
});

test('semantic errors still show translated source plus profile-specific concrete and typo candidates',()=>{
  const source='architecture "Bad" {model {servic a "A"}}';
  const result=arch.inspectSource(source);assert.ok(result.output);assert.equal(result.valid,false);assert.equal(result.diagnostics[0].candidates[0].example,'service');
  const abstract='architecture "Bad" {config {profile naf41-uaf} model {OperationalAgent fighter "Fighter"}}';
  const report=arch.inspectSource(abstract);
  assert.ok(report.output);assert.equal(report.valid,false);assert.ok(report.diagnostics[0].candidates.some(c=>c.example.includes('OperationalPerformer')));
  const json=arch.translate(abstract),jsonReport=arch.inspectSource(json);
  assert.ok(jsonReport.diagnostics[0].candidates.some(c=>c.example==='"type": "OperationalPerformer"'));
  assert.ok(jsonReport.diagnostics[0].path);
});

test('correction candidates resolve actual IDs and required values without applying guesses',()=>{
  const bad='architecture "Bad" {model {service api "API" relation r api -> apii "Flow"}}';
  const result=arch.inspectSource(bad);assert.equal(result.diagnostics[0].candidates[0].example,'api');
  const missing='architecture "Missing" {config {type thing {attribute value {type integer required true min 2}}} model {thing a "A"}}';
  const report=arch.inspectSource(missing);assert.ok(report.output);assert.equal(report.diagnostics[0].candidates[0].example,'value 2');
  assert.ok(report.diagnostics.every(d=>d.candidates.every(c=>typeof c.example==='string')));
  assert.ok(arch.inspectSource('architecture "P" {config {profile defaut} model {}}').diagnostics[0].candidates.some(c=>c.example==='default'));
});

test('translation is deterministic, non-mutating, explicit about format and safely serializes user text',()=>{
  const input={architecture:{name:'<script>alert(1)</script>',model:{elements:{a:{type:'service',name:'A "quoted"\nline'}}}}};
  const before=JSON.stringify(input),dsl=arch.translate(input);
  assert.equal(arch.translate(input),dsl);assert.equal(JSON.stringify(input),before);
  assert.equal(arch.parse(dsl).title,input.architecture.name);
  assert.equal(arch.parse(arch.translate(dsl)).nodes[0].title,input.architecture.model.elements.a.name);
  assert.throws(()=>arch.translate(dsl,{format:'xml'}),/dsl or json/);
  assert.equal(arch.inspectSource(dsl,{format:'xml'}).valid,false);
  assert.ok(arch.translate(dsl,{format:'dsl'}).startsWith('architecture'));
  assert.ok(arch.translate(input,{format:'json'}).startsWith('{'));
});

test('both browser bundles expose conversion and diagnostics with the same output',async()=>{
  const source='architecture "T" {model {service a "A"}}';
  for(const file of ['arch.js','arch.min.js']) {
    const context={};vm.createContext(context);vm.runInContext(await readFile(file,'utf8'),context);
    assert.equal(context.arch.translate(source),arch.translate(source));
    assert.equal(context.arch.inspectSource('architecture "T" {modle {}}').diagnostics[0].candidates[0].example,'model');
  }
});
