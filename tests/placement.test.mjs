import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

const body='service a "A" service b "B" service c "C" relation ab a -> b "Calls"';
const doc=(view,model=body)=>`architecture "Placement" {model {${model}}view v "V"{${view}}}`;
const node=(g,id)=>g.nodes.find(n=>n.id===id);

test('placement sums align independent coordinates, offsets and dimensions regardless of declaration order',()=>{
  const source=doc('place a at (b.x + 20, c.y - 40) place c at (0,400) place b at (300,100)'),model=arch.parse(source),before=JSON.stringify(model),g=arch.layout(model);
  assert.deepEqual([node(g,'a').x,node(g,'a').y],[320,360]);assert.deepEqual(g.edges[0].points[0],{x:430,y:360});
  assert.equal(JSON.stringify(model),before);assert.deepEqual(arch.layout(model),g);
  const dimensions=arch.layout(doc('place a at (b.right + b.width - a.width + 20, b.bottom + 40) place b at (100,200)'));
  assert.equal(node(dimensions,'a').x,node(dimensions,'b').x+node(dimensions,'b').width+20);assert.equal(node(dimensions,'a').y,node(dimensions,'b').y+node(dimensions,'b').height+40);
  const center=arch.layout(doc('place a at (b.centerX, b.centerY) place b at (300,100)'));
  assert.deepEqual([node(center,'a').x,node(center,'a').y],[410,148]);
  const numbers=arch.layout(doc('place a at (10 + 20 - 5, -20 + 40 - 5)'));
  assert.deepEqual([node(numbers,'a').x,node(numbers,'a').y],[25,15]);
});

test('reference parsing preserves dotted/hyphenated IDs, negatives, compact arithmetic and finite limits',()=>{
  const source=doc('place a at (group.part-1.x+20-5, group.part-1.y -20 + 1e1) place group.part-1 at (-40,100)',body+'service group.part-1 "ID"');
  const g=arch.layout(source);assert.deepEqual([node(g,'a').x,node(g,'a').y],[-25,90]);
  for(const expr of ['a.foo','a.x ** 2','a.x % 2','a.x +','a.x 20','"a.x"','a.x + '.repeat(33)+'0','1e309'])assert.equal(arch.validate(doc(`place b at (${expr},0)`)).valid,false,expr);
  assert.throws(()=>arch.layout(doc('place a at (b.x + 10000000,0) place b at (100,0)')),/Resolved placement a.x.*outside/);
  const report=arch.validate(doc('place a at (b.wdth,0)'));assert.match(report.diagnostics[0].message,/Invalid placement coordinate/);
});

test('compact reference subtraction binds declared IDs and matches spaced DSL/JSON in both bundles',async()=>{
  const id='service_situationInformationConsolidation',model=`service ${id} "Situation" service doc "Document"`;
  let expected;
  for(const gap of ['',' ','  ','\n']) {
    const source=doc(`place ${id} at (400,300) place doc at (${id}.x+${id}.width,${id}.y${gap}-${gap}${id}.height)`,model);
    const graph=arch.layout(source);assert.deepEqual([node(graph,'doc').x,node(graph,'doc').y],[620,204]);
    const svg=arch.renderToString(source,{idPrefix:'compact'});expected??=svg;assert.equal(svg,expected);
    const json=JSON.parse(arch.translate(source));json.architecture.views.v.place.doc.at=[`${id}.x+${id}.width`,`${id}.y-${id}.height`];
    assert.equal(arch.renderToString(json,{idPrefix:'compact'}),svg);
    assert.equal(arch.renderToString(arch.translate(json),{idPrefix:'compact'}),svg);
    if(gap==='')for(const file of ['arch.js','arch.min.js']) {
      const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
      assert.equal(context.arch.renderToString(source,{idPrefix:'compact'}),svg);
    }
  }
  const arithmetic=arch.layout(doc('place a at ((b.x-b.width)/2,c.y-b.height*2) place b at (400,300) place c at (0,500)'));
  assert.deepEqual([node(arithmetic,'a').x,node(arithmetic,'a').y],[90,308]);
  const typo=arch.validate(doc(`place doc at (${id}.x,se0rvice_situationInformationConsolidation.y-${id}.height)`,model));
  assert.match(typo.diagnostics[0].message,/reference: se0rvice_situationInformationConsolidation;/);
  assert.match(arch.validate(doc('place a at (b.x-a.width,0) place b at (a.x,0)')).diagnostics[0].message,/Circular placement dependency/);
});

test('compact arithmetic preserves longer declared dotted/hyphenated IDs, with spaces disambiguating subtraction',()=>{
  const model=body+' service root "Root" service offset "Offset" service root.x-offset "Long ID"';
  const at='place root at (300,100) place offset at (0,40) place root.x-offset at (800,500)';
  const graph=arch.layout(doc(`${at} place a at (root.x-offset.y,0) place b at (root.x - offset.y,0)`,model));
  assert.equal(node(graph,'a').x,500);assert.equal(node(graph,'b').x,260);
  assert.match(arch.validate(doc(`${at} place a at (root.x-offset.y,0) style root.x-offset {display none}`,model)).diagnostics[0].message,/reference: root.x-offset;/);
  const source=doc(`${at} place a at (root.x-offset.y,0) place b at (root.x - offset.y,0)`,model);
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'long-id'}),arch.renderToString(source,{idPrefix:'long-id'}));
});

test('cycles report coordinate chains including cross-axis, tree membership, automatic context and package sizing',()=>{
  for(const [view,model,pattern]of [
    ['place a at (a.x + 1,0)',body,/a.x -> a.x/],
    ['place a at (b.y,0) place b at (0,a.x)',body,/a.x -> b.y -> a.x/],
    ['tree group {nodes [a,b]} place group at (a.x,0)',body,/group.x|a.x/],
    ['tree group {nodes [a,b]} place group at (c.x,0)',body+'relation context c -> a "Link"',/group.x|c.x/],
    ['place a at (p.right + 20,0)','package p "P" {service a "A"}',/p.width -> a.x -> p.width/],
    ['place p at (a.x,0)','package p "P" {service a "A"}',/p.x -> a.x -> p.x/],
  ]) {
    const report=arch.validate(doc(view,model),{validation:'draft'});assert.equal(report.valid,false);assert.match(report.diagnostics[0].message,/Circular placement dependency/);assert.match(report.diagnostics[0].message,pattern);assert.ok(report.diagnostics[0].line);
  }
  assert.equal(arch.validate(doc('place a at (a.width + 20, a.height + 20)')).valid,true);
  assert.equal(arch.validate(doc('place a at (b.x,0) place b at (300,a.y + 20)')).valid,true,'independent axes do not form a cycle');
  const repair=arch.inspectSource(doc('place a at (a.x,0)'));assert.ok(repair.diagnostics[0].candidates.some(c=>/fixed coordinate/.test(c.label)));
});

test('tree member references use final group positions, move internal paths and retain canonical context',()=>{
  const source=doc('tree group {nodes [a,b] direction up} place group at (c.right + 80, c.y) place c at (100,200)'),g=arch.layout(source);
  const group=g.treeGroups[0];assert.equal(group.bounds.x,400);assert.equal(group.bounds.y,200);
  assert.equal(node(g,'a').treeGroup,'group');assert.equal(g.edges[0].points[0].y,node(g,'a').y);
  const external=arch.layout(doc('tree group {nodes [a,b] direction up} place group at (300,100) place c at (group.x - c.width - 80,b.y + 20)'));
  assert.equal(node(external,'c').x,0);assert.equal(node(external,'c').y,node(external,'b').y+20);
  const automatic=arch.layout(doc('tree group {nodes [a,b] direction up} place group at (anchor.x + 300, anchor.y) place anchor at (500,200)',body+'service anchor "Anchor" relation context c -> a "Link"'));
  assert.equal(automatic.treeGroups[0].bounds.x,800);assert.equal(node(automatic,'c').y+48,node(automatic,'a').y+48);assert.ok(node(automatic,'c').x+220<800);
  assert.doesNotMatch(arch.renderToString(source),/NaN|Infinity|undefined/);
});

test('package coordinates use the target content space, cross-container references align and final package sizes grow',()=>{
  const model='package p "P" {service a "A" service b "B"} service outside "Outside"';
  const sibling=arch.layout(doc('place p at (100,100) place a at (b.right + 20,b.y) place b at (0,0)',model));
  assert.equal(node(sibling,'a').x,node(sibling,'b').x+240);assert.equal(node(sibling,'a').y,node(sibling,'b').y);assert.equal(node(sibling,'p').width,516);
  const cross=arch.layout(doc('place p at (500,100) place outside at (1000,800) place a at (outside.x,outside.y)',model));
  assert.deepEqual([node(cross,'a').x,node(cross,'a').y],[1000,800]);assert.ok(node(cross,'p').width>=748);assert.ok(node(cross,'p').height>=824);
  const numeric=arch.layout(doc('place p at (500,100) place outside at (a.x + 20,200) place a at (10,10)',model));
  assert.equal(node(numeric,'outside').x,node(numeric,'a').x+20);assert.equal(node(numeric,'a').x,538);assert.equal(node(numeric,'outside').y,200);
  assert.throws(()=>arch.layout(doc('place p at (500,100) place a at (outside.x,0) place outside at (0,0)',model)),/falls outside parent p content/);
});

test('unknown/excluded/hidden targets are rejected, and graphical references used as anchors keep one canonical card',()=>{
  for(const view of ['place a at (missing.x,0)','place a at (b.x,0) exclude b','place a at (b.x,0) style b {display none}'])assert.match(arch.validate(doc(view)).diagnostics[0].message,/Unknown or hidden placement reference/);
  const profile={defaultRelation:'exchange',nodeTypes:{service:{template:'service'},document:{template:'artifact'}},relationTypes:{exchange:{style:'flow',attributes:{payload:{type:'reference',targets:['document'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
  const g=arch.layout(doc('place c at (info.right + 40,info.y)','service a "A" service b "B" service c "C" document info "Report" relation flow a -> b "Exchange" {payload [info]}'),{profile});
  const info=node(g,'info');assert.ok(!info.referenceOnly);assert.equal(node(g,'c').x,info.x+info.width+40);assert.equal(g.referenceNodes.length,1);assert.equal(g.referenceNodes[0].node,info);
});

test('DSL/JSON/meta preserve symbolic expressions and report JSON paths; endpoint/size points stay numeric',async()=>{
  const source=doc('place a at (b.x + 20,c.y - 40) place b at (300,100) place c at (0,400)'),json=arch.translate(source),expected=arch.renderToString(source,{idPrefix:'same'});
  assert.deepEqual(JSON.parse(json).architecture.views.v.place.a.at,['b.x + 20','c.y - 40']);
  assert.equal(arch.renderToString(json,{idPrefix:'same'}),expected);assert.equal(arch.renderToString(arch.translate(json),{idPrefix:'same'}),expected);
  assert.match(arch.renderToString(source.replace('model {','@meta json\nmodel {')),/b.x \+ 20/);
  const invalid=JSON.parse(json);invalid.architecture.views.v.place.a.at[0]='missing.x';assert.match(arch.validate(invalid).diagnostics[0].path,/place\/a/);
  invalid.architecture.views.v.place.a.at[0]='b.wdth';assert.match(arch.validate(invalid).diagnostics[0].path,/place\/a\/at\/0/);
  for(const view of ['place a at (0,0) size (b.width,96)','route ab {from (b.x,0)}'])assert.equal(arch.validate(doc(view)).valid,false);
  assert.match(arch.help('routing'),/Coordinate references/);
  const arithmetic=source.replace('b.x + 20','b.x + 20 * 2').replace('c.y - 40','(c.y - 40) / 2');
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    assert.equal(context.arch.renderToString(source,{idPrefix:'same'}),expected);
    assert.equal(context.arch.renderToString(arithmetic,{idPrefix:'same'}),arch.renderToString(arithmetic,{idPrefix:'same'}));
  }
});

test('long reference chains resolve iteratively, and view-local placements remain independent when stacked',()=>{
  const count=1000,model=Array.from({length:count},(_,i)=>`service n${i} "Node"`).join(' '),places=Array.from({length:count},(_,i)=>`place n${i} at (${i?`n${i-1}.x + 2`:0},0)`).reverse().join(' ');
  const g=arch.layout(doc(places,model));assert.equal(node(g,`n${count-1}`).x,2*(count-1));
  const source=doc('place a at (b.x + 20,0) place b at (100,0)').replace(/}$/, 'view second "Second" {place a at (b.x - 40,0) place b at (600,0)}}');
  const stacked=arch.layout(source,{views:'all'});assert.equal(stacked.layouts.length,2);assert.equal(node(arch.layout(source,{view:'v'}),'a').x,120);assert.equal(node(arch.layout(source,{view:'second'}),'a').x,560);
});

test('placement arithmetic honors precedence, left associativity, unary signs, grouping and compact reference syntax',()=>{
  for(const [expression,expected]of [
    ['b.x + 20 * 3',360],['(b.x + 20) / 2',160],['b.x / 2 * 3',450],
    ['b.x / (2 * 3)',50],['b.centerX - a.width / 2',300],['-(b.x - 400) * -2',-200],
    ['b.x+-20',280],['b.x--20',320],['b.x*2/3',200],['100 / 10 / 2',5],
    ['b.x - (40 - 20)',280],['b.x / -(-2)',150],
  ]) {
    const source=doc(`place a at (${expression},0) place b at (300,100)`),g=arch.layout(source);
    assert.equal(node(g,'a').x,expected,expression);
    const json=arch.translate(source);assert.equal(arch.renderToString(json,{idPrefix:'math'}),arch.renderToString(source,{idPrefix:'math'}));
    assert.equal(arch.renderToString(arch.translate(json),{idPrefix:'math'}),arch.renderToString(source,{idPrefix:'math'}));
  }
});

test('arithmetic dependencies preserve parent coordinate conversion, centering, nonlinear references and cycle detection',()=>{
  const model='package p "P" {service a "A" service b "B"} service c "Context"';
  const g=arch.layout(doc('place p at (500,100) place b at (100,100) place a at (b.centerX - a.width / 2,b.centerY - a.height / 2)',model));
  assert.equal(node(g,'a').x,node(g,'b').x);assert.equal(node(g,'a').y,node(g,'b').y);
  const nonlinear=arch.layout(doc('place p at (500,100) place b at (100,100) place a at (b.x * b.width / 100,b.y / (b.height / 96))',model));
  assert.equal(node(nonlinear,'a').x,748);assert.equal(node(nonlinear,'a').y,node(nonlinear,'b').y);
  const tiny=arch.layout(doc('place p at (500,100) place b at (0,0) place a at (b.x / 1e-323 * 0,0)',model));
  assert.equal(node(tiny,'a').x,node(tiny,'b').x,'nonfinite symbolic origin coefficients must use local evaluation');
  assert.match(arch.validate(doc('place a at (b.width * c.x,0) place c at (a.x / 2,0)')).diagnostics[0].message,/Circular placement dependency/);
  assert.equal(arch.validate(doc('place a at (a.width / 2,a.height * 2)')).valid,true);
  assert.match(arch.validate(doc('place a at (p.width / 2,0)',model)).diagnostics[0].message,/Circular placement dependency/);
});

test('division by zero, nonfinite calculations, unsupported operators and excessive nesting report placement errors',()=>{
  for(const expression of ['1 / 0','b.x / 0','b.x / (2 - 2)','1 / -0']) {
    const report=arch.validate(doc(`place a at (${expression},0)`));assert.equal(report.valid,false);assert.match(report.diagnostics[0].message,/Division by zero/);assert.ok(report.diagnostics[0].line);
  }
  const dynamic=doc('place a at (b.x / (b.width - 220),0)');assert.equal(arch.validate(dynamic).valid,true);assert.throws(()=>arch.layout(dynamic),/Division by zero/);
  const json=JSON.parse(arch.translate(doc('place a at (b.x / 2,0)')));json.architecture.views.v.place.a.at[0]='b.x / 0';assert.match(arch.validate(json).diagnostics[0].path,/at\/0/);
  for(const expression of ['b.x /','b.x // 2','b.x ** 2','Math.max(b.x,2)','('.repeat(17)+'b.x'+')'.repeat(17),'()'])assert.equal(arch.validate(doc(`place a at (${expression},0)`)).valid,false,expression);
  assert.match(arch.validate(doc('place a at (1 / 1e-323,0)')).diagnostics[0].message,/remain finite/);
  const repair=arch.inspectSource(doc('place a at (b.x / 0,0)'));assert.ok(repair.diagnostics[0].candidates.some(c=>/nonzero/.test(c.label)));
});
