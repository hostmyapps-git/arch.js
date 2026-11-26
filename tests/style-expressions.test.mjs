import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.studio.js';
const source=(styles='',extra='')=>`architecture "Styles" {model {service x "X" service y "Y" service z "Z" relation e x -> y "E"} view v "V" {${styles}} ${extra}}`;
const get=(g,id)=>g.nodes.find(n=>n.id===id);
const valid=s=>assert.deepEqual(arch.validate(s).diagnostics,[]);

test('numeric styles support arithmetic, explicit style references, effective metrics and forward dependency chains',()=>{
 const text=source('style z {width y.width + 20 height y.style.height fontSize y.fontSize} style y {width x.style.width * 2 height 2*x.height fontSize x.fontSize+2} style x {width 200+20 height 120 fontSize 10*1.5}');
 valid(text);const model=arch.parse(text),before=JSON.stringify(model),g=arch.layout(model);
 assert.deepEqual([get(g,'x').width,get(g,'x').height,get(g,'x').textStyle.title],[220,120,15]);
 assert.deepEqual([get(g,'y').width,get(g,'y').height,get(g,'y').textStyle.title],[440,240,17]);
 assert.deepEqual([get(g,'z').width,get(g,'z').height,get(g,'z').textStyle.title],[460,240,17]);
 assert.equal(JSON.stringify(model),before);
 const normal=arch.layout(source('style x {height 120} style y {width x.width height 2*x.height fontSize x.fontSize}'));
 assert.equal(get(normal,'y').width,220);assert.equal(get(normal,'y').textStyle.title,15);
});

test('effective height includes content while style.height remains the configured minimum; placements and routing use resolved geometry',async()=>{
 const text=await readFile('examples/style-expressions.arch','utf8'),model=arch.parse(text),g=arch.layout(model);
 const base=get(g,'base'),measured=get(g,'measured'),minimum=get(g,'minimum');
 assert.ok(base.height>100);assert.equal(measured.height,2*base.height);assert.equal(minimum.height,200);
 assert.equal(measured.width,base.width+80);assert.equal(minimum.width,measured.width);
 assert.equal(measured.x,base.x+base.width+120);assert.equal(minimum.x,measured.x+measured.width+120);
 assert.equal(measured.textStyle.title,18);assert.equal(model.views[0].styles.measured.height,'2 * base.height');
});

test('style math supports unary operators, parentheses, multiplication/division and longest declared dotted/hyphen IDs',()=>{
 const text=source('style x {height 128 width 240} style y {width (x.width+80)*2/2 height -(-x.height)+96 fontSize (+x.fontSize)*2}');
 const g=arch.layout(text);assert.equal(get(g,'y').width,320);assert.equal(get(g,'y').height,224);assert.equal(get(g,'y').textStyle.title,30);
 const ambiguous=source('style x {height 100} style x.style {height 150} style y {height 2*x.style.height}').replace('service z "Z"','service z "Z" service x.style "Dotted"');
 assert.equal(get(arch.layout(ambiguous),'y').height,300,'longest declared ID wins over the style namespace');
 const hyphen=source('style x {height 120} style x.style-other {height 140} style y {height x.style-other.height-x.height+100}').replace('service z "Z"','service z "Z" service x.style-other "Hyphen"');
 assert.equal(get(arch.layout(hyphen),'y').height,120);
 const fieldId=source('style x {height 120} style x.height-z {height 140} style z {height 100} style y {height x.height-z.height}').replace('service z "Z"','service z "Z" service x.height-z "Field-like ID"');
 assert.equal(get(arch.layout(fieldId),'y').height,140,'syntax lowering preserves ambiguous spelling until IDs are known');
 assert.equal(get(arch.layout(fieldId.replace('height x.height-z.height','height x.height - z.height + 100')),'y').height,120,'spaces select subtraction');
});

test('style dependencies detect direct, indirect and intrinsic-height cycles, including draft mode',()=>{
 for(const styles of ['style x {width x.width}', 'style x {height x.height}', 'style x {fontSize x.height/10}', 'style x {height y.height} style y {height x.height}', 'style x {width y.style.width} style y {width x.style.width}']) {
  const report=arch.validate(source(styles));assert.equal(report.valid,false);assert.match(report.diagnostics[0].message,/Circular style dependency/);
  assert.equal(arch.validate(source(styles).replace('model {','config {validation draft} model {')).valid,false);
 }
 valid(source('style x {width 220 height x.style.width}'));
});

test('style expressions reject invalid references, missing explicit values, unsafe grammar and resolved range/division errors',()=>{
 for(const [styles,pattern]of [
  ['style y {height missing.height}',/Unknown or hidden style reference/],
  ['exclude x style y {height x.height}',/Unknown or hidden/],
  ['style x {display none} style y {height x.style.height}',/Unknown or hidden/],
  ['style y {height x.style.height}',/Missing explicit style value/],
  ['style y {height x.y}',/style|coordinate/i],
  ['style y {height Math.max(1,2)}',/style|coordinate/i],
  ['style y {height 100/0}',/zero/],
  ['style y {width 10}',/between/],
  ['style y {fontSize "100*2"}',/between/],
  ['style y {height 2 *}',/operand/],
 ]) {const r=arch.validate(source(styles));assert.equal(r.valid,false,styles);assert.match(r.diagnostics[0].message,pattern);assert.ok(r.diagnostics[0].line>0);}
 for(const styles of ['style x {height 100} style y {height x.style.height/(x.style.height-100)}','style x {width 200} style y {width x.width*100000}','style x {fontSize 15} style y {fontSize x.fontSize*5}'])
  assert.throws(()=>arch.layout(source(styles)),arch.ArchError);
 const inspect=arch.inspectSource(source('style y {height missing.height}'));assert.ok(inspect.diagnostics[0].candidates.length);
});

test('expressions remain view-local, work on tree members and packages through explicit styles, and reject late package/group metrics',()=>{
 const text=source('style x {height 120} style y {height x.height*2}','view second "Other" {style x {height 200} style y {height x.height*2}}');
 assert.equal(get(arch.layout(text,{view:'v'}),'y').height,240);assert.equal(get(arch.layout(text,{view:'second'}),'y').height,400);
 const tree=source('diagram tree {parentDirection source} style x {height 120} style y {height x.height*2}');
 assert.equal(get(arch.layout(tree),'y').height,240);
 const group=source('tree g {nodes [x,y] parentDirection source} style x {height 120} style y {height x.height*2}');
 assert.equal(get(arch.layout(group),'y').height,240);
 const pack=`architecture "P" {model {package p "P" {service x "X" service y "Y"}} view v "V" {style p {height 180} style x {height p.style.height} style y {height x.height*2}}}`;
 const graph=arch.layout(pack);assert.equal(get(graph,'x').height,180);assert.equal(get(graph,'y').height,360);assert.ok(get(graph,'p').height>180);
 assert.equal(arch.validate(pack.replace('height p.style.height','height p.height')).valid,false);
 assert.equal(arch.validate(source('tree g {nodes [x,y]} style z {height g.height}')).valid,false);
 for(const diagram of ['sequence','class','state'])assert.equal(arch.validate(source(`diagram ${diagram} {} style y {height 2*x.height}`)).valid,false);
});

test('JSON/DSL/meta preserve symbolic styles, reject injection and keep both distribution bundles equivalent',async()=>{
 const text=source('style x {height 120 width 240} style y {height 2*x.height width x.style.width+40 fontSize x.fontSize}');
 const json=JSON.parse(arch.translate(text,{format:'json'}));assert.equal(json.architecture.views.v.style.y.height,'2 * x.height');
 const dsl=arch.translate(json,{format:'dsl'});assert.match(dsl,/height 2 \* x.height/);
 assert.equal(arch.renderToString(json,{idPrefix:'style'}),arch.renderToString(text,{idPrefix:'style'}));
 assert.equal(arch.renderToString(dsl,{idPrefix:'style'}),arch.renderToString(text,{idPrefix:'style'}));
 for(const file of ['arch.core.min.js', 'arch.min.js']) {const ctx=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),ctx);assert.equal(ctx.arch.renderToString(text,{idPrefix:'style'}),arch.renderToString(text,{idPrefix:'style'}));}
 json.architecture.views.v.style.y.height='x.height } model {';const invalid=arch.validate(json);assert.equal(invalid.valid,false);assert.match(invalid.diagnostics[0].path,/style\/y\/height/);
 const model=arch.parse(text);model.views[0].styles.y.height='2 * x.height';assert.ok(arch.validate(model).valid);
});

test('graphical reference cards used as measured style anchors remain canonical in shared and per-edge modes',()=>{
 const profile={nodeTypes:{actor:{},item:{}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{data:{type:'reference',targets:['item']}},referenceLabels:{data:'Conveys'},referenceDisplay:'nodes'}}};
 const text=`architecture "Refs" {model {actor a "A" actor b "B" item info "Info" relation e a -> b "Carries" {type flow data info}} view v "V" {referenceOccurrences perEdge style a {height info.height*2}}}`;
 const g=arch.layout(text,{profile});assert.equal(get(g,'a').height,get(g,'info').height*2);assert.equal(g.referenceNodes[0].node,get(g,'info'));assert.equal(g.referenceNodes[0].explicit,true);
});
