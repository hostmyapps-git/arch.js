import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const positions=['top','left','bottom','right'];
const types=['person','system','application','service','component','database','queue','interface','capability','process','artifact','node'];
const source=(style='',type='system')=>`architecture "Presentation" {model {${type} n "Visible title" {description "Visible description" technology "Visible technology" stereotype "Visible stereotype"}} view custom "Custom" {style n {${style}}} view plain "Plain" {}}`;
const xml=s=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(s,'image/svg+xml');
const root=d=>[...d.getElementsByTagName('g')].find(g=>g.getAttribute('data-node')==='n');
const text=g=>[...g.getElementsByTagName('text')].map(t=>t.textContent).join(' ');

test('node icon positions reserve card space for every non-container template',()=>{
 for(const type of types)for(const position of positions) {
  const model=arch.parse(source(`iconPosition ${position} width 160 height 96 fontSize 32`,type)),before=JSON.stringify(model),node=arch.layout(model).nodes[0],box=node.iconBox;
  assert.ok(box.x>=0&&box.y>=0&&box.x+box.size<=node.width&&box.y+box.size<=node.height,`${type}/${position}`);
  if(position==='bottom')assert.ok(box.y>node.textStyle.technologyY);
  if(position==='top')assert.ok(box.y+box.size<node.textStyle.badgeY);
  if(position==='right')assert.ok(box.x>node.textStyle.badgeX);
  const d=xml(arch.renderToString(model));assert.equal(root(d).getAttribute('data-icon-position'),position);
  assert.equal(JSON.stringify(model),before);
 }
});

test('logo alignment preserves aspect ratio and padding while the default remains centered',()=>{
 arch.registerIconPack('node-align',{icons:{wide:{width:300,height:100,body:'<rect width="300" height="100" fill="#f00"/>'},tall:{width:100,height:300,body:'<rect width="100" height="300" fill="#00f"/>'}}});
 for(const shape of ['wide','tall'])for(const position of positions) {
  const model=arch.parse(source(`display logo icon node-align.${shape} iconPosition ${position} width 260 height 180`));
  const g=root(xml(arch.renderToString(model))),icon=[...g.getElementsByTagName('g')].find(e=>e.hasAttribute('data-icon'));
  const [x,y,scale]=[...icon.getAttribute('transform').matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>+m[0]);
  assert.ok(x>=15.9&&y>=15.9);assert.ok(x+(shape==='wide'?300:100)*scale<=244.2&&y+(shape==='wide'?100:300)*scale<=164.2);
  if(position==='top')assert.equal(y,16);if(position==='left')assert.equal(x,16);
  assert.equal(g.getElementsByTagName('text').length,0);
 }
 const centered=root(xml(arch.renderToString(source('display logo icon node-align.wide width 260 height 180'))));
 assert.equal(centered.getAttribute('data-icon-position'),'center');
});

test('package icons stay in their headers and visibility does not hide contained children',()=>{
 for(const position of positions) {
  const model=arch.parse(`architecture "Packages" {model {package n "Long package title that may wrap" {system child "Child"}} view v "V" {style n {iconPosition ${position} width 160 fontSize 32 showStereotype false}}}`),graph=arch.layout(model),node=graph.nodes.find(n=>n.id==='n'),child=graph.nodes.find(n=>n.id==='child');
  assert.ok(node.iconBox.y+node.iconBox.size<node.headerHeight);assert.ok(child.y>=node.y+node.headerHeight);
  const d=xml(arch.renderToString(model));assert.ok(text(root(d)).replace(/\s/g,'').includes('Longpackage'));assert.ok(!text(root(d)).includes('PACKAGE'));
 }
 const d=xml(arch.renderToString('architecture "Packages" {model {package n "Hidden" {system child "Child"}} view v "V" {style n {showIcon false showLabel false showStereotype false}}}'));
 assert.equal(root(d).getElementsByTagName('text').length,0);assert.ok([...d.getElementsByTagName('g')].some(g=>g.getAttribute('data-node')==='child'));
});

test('node visibility switches independently control icon, stereotype, title, description and technology',()=>{
 const cases=[['showIcon','data-icon'],['showStereotype','Visible stereotype'],['showLabel','Visible title'],['showDescription','Visible description'],['showTechnology','Visible technology']];
 for(const [field,hidden] of cases)for(const theme of ['light','dark']) {
  const d=xml(arch.renderToString(source(`${field} false`),{theme})),g=root(d),visible=text(g);
  if(field==='showIcon')assert.equal([...g.getElementsByTagName('g')].filter(e=>e.hasAttribute(hidden)).length,0);
  else assert.ok(!visible.toLowerCase().includes(hidden.toLowerCase()),field);
  assert.match(g.getElementsByTagName('title')[0].textContent,/Visible title/);
 }
 const minimal=xml(arch.renderToString(source('showLabel false showStereotype false showDescription false showTechnology false')));
 assert.equal(root(minimal).getElementsByTagName('text').length,0);assert.ok([...root(minimal).getElementsByTagName('g')].some(e=>e.hasAttribute('data-icon')));
 assert.doesNotThrow(()=>arch.renderToString(source('showIcon false icon unknown.icon')));
 assert.doesNotThrow(()=>arch.renderToString(source('display logo showIcon false icon unknown.icon')));
});

test('route text and icons can be controlled separately with defaults and per-route overrides',()=>{
 const doc=rules=>`architecture "Routes" {model {system a "A" system b "B" relation r a -> b "Edge title" relation reply b -> a "Reply"} view v "V" {${rules}}}`;
 for(const showIcon of [true,false])for(const showLabel of [true,false]) {
  const d=xml(arch.renderToString(doc(`routes {icon core.cloud showIcon ${showIcon} showLabel ${showLabel}}`)));
  const groups=[...d.getElementsByTagName('g')],label=groups.find(g=>g.getAttribute('data-label-for')==='r');
  assert.equal(!!label,showIcon||showLabel);if(!label)continue;
  assert.equal(label.getElementsByTagName('text').length,showLabel?1:0);
  assert.equal([...label.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-icon')).length,showIcon?1:0);
 }
 const graph=arch.layout(arch.parse(doc('routes {icon core.cloud showIcon false showLabel false} route r {showIcon true}')));
 assert.equal(graph.edges[0].labelIcon,'core.cloud');assert.equal(graph.edges[0].labelLines.length,0);assert.equal(graph.edges[1].labelWidth,0);
 const hidden=arch.layout(arch.parse(doc('routes {icon core.cloud showIcon true showLabel true} route r {label none}')));
 assert.equal(hidden.edges[0].labelIcon,undefined);assert.equal(hidden.edges[0].labelLines.length,0);
});

test('node visibility and positions are view-local and carry over to reference occurrences',()=>{
 const model=arch.parse(source('iconPosition bottom showStereotype false showDescription false')),before=JSON.stringify(model);
 assert.equal(arch.layout(model).nodes[0].badgeLines.length,0);assert.equal(arch.layout(model,{view:'plain'}).nodes[0].badgeLines.length,1);
 const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
 const doc='architecture "Ref" {model {actor a "A" actor b "B" item data "Dataset" relation r a -> b "Carries" {type flow payload [data]}} view v "V" {style data {iconPosition bottom showLabel false showStereotype false} routes {showLabel false showIcon false}}}';
 const graph=arch.layout(arch.parse(doc,{profile}));assert.equal(graph.referenceNodes[0].node.iconPosition,'bottom');assert.equal(graph.referenceNodes[0].node.titleLines.length,0);assert.equal(graph.referenceNodes[0].route,undefined);
 assert.equal(JSON.stringify(model),before);
});

test('visibility booleans and icon positions validate with English diagnostics and connected-only checks',()=>{
 for(const [field,value] of [['iconPosition','middle'],['showIcon','1'],['showLabel','"false"'],['showStereotype','yes'],['showDescription','0'],['showTechnology','none']])assert.equal(arch.validate(source(`${field} ${value}`)).valid,false,field);
 const specialized=source('iconPosition right').replace('style n {','diagram class {} style n {');assert.equal(arch.validate(specialized).valid,false);
 const visibility=source('showIcon false').replace('style n {','diagram class {} style n {');assert.equal(arch.validate(visibility).valid,false);
 assert.equal(arch.validate('architecture "E" {model {system a "A" system b "B" relation r a -> b "E"} view v "V" {routes {showIcon "true"}}}').valid,false);
});
