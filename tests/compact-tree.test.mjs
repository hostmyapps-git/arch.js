import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

const body='service r "Root" service water "Waterborne Rescue" service air "Airborne Rescue" service space "Space Rescue" service a "A" service b "B" service c "C" service d "D" relation rw r -> water "groups" relation ra r -> air "groups" relation rs r -> space "groups" relation wa water -> a "groups" relation wb water -> b "groups" relation wc water -> c "groups" relation wd water -> d "groups"';
const doc=(model=body,options='',grouped=false,styles='')=>`architecture "Compact" {model {${model}} view v "Tree" {${grouped?`tree hierarchy {nodes ${[...model.matchAll(/service (\w+) /g)].map(m=>m[1]).join(',')} ${options}}`:`diagram tree {${options}}`} ${styles}}}`;
const overlaps=(a,b)=>a.x<b.x+b.width-1e-7&&a.x+a.width>b.x+1e-7&&a.y<b.y+b.height-1e-7&&a.y+a.height>b.y+1e-7;
function checkGeometry(g) {
  const labels=g.edges.filter(e=>e.labelLines.length||e.labelIcon).map(e=>({id:'label '+e.id,x:e.label.x-e.labelWidth/2,y:e.label.y-e.labelHeight/2,width:e.labelWidth,height:e.labelHeight}));
  const boxes=[...g.nodes,...labels],bounds=g.bounds;
  for(let i=0;i<boxes.length;i++) {
    const a=boxes[i];assert.ok(a.x>=bounds.x-1e-7&&a.y>=bounds.y-1e-7&&a.x+a.width<=bounds.x+bounds.width+1e-7&&a.y+a.height<=bounds.y+bounds.height+1e-7,a.id+' fits bounds');
    for(const b of boxes.slice(i+1))assert.equal(overlaps(a,b),false,`${a.id} overlaps ${b.id}`);
  }
  const vertical=['up','down'].includes(g.tree?.orientation??g.treeGroups?.[0]?.orientation);
  const center=n=>vertical?n.x+n.width/2:n.y+n.height/2;
  for(const parent of g.nodes) {
    const children=g.nodes.filter(n=>n.treeParent===parent.id);
    if(children.length)assert.ok(Math.abs(center(parent)-(center(children[0])+center(children.at(-1)))/2)<1e-7,'parent stays centered: '+parent.id);
  }
}

test('shallow siblings use space above a wide subtree instead of reserving its full rectangle',()=>{
  for(const grouped of [false,true]) {
    const g=arch.layout(doc(body,'direction down',grouped)),get=id=>g.nodes.find(n=>n.id===id);
    assert.equal(get('air').x-get('water').x-get('water').width,48);
    assert.equal(get('space').x-get('air').x-get('air').width,48);
    const descendants=['a','b','c','d'].map(get),width=Math.max(...descendants.map(n=>n.x+n.width))-Math.min(...descendants.map(n=>n.x));
    assert.ok(width>get('space').x-get('water').x,'lower-level space is reused on the upper level');
    checkGeometry(g);
  }
});

test('per-rank contours keep competing deep subtrees, variable cards, labels and icons apart in all orientations',()=>{
  const model=body+' service e "E" service f "F" service g "G" service h "H" relation ae air -> e "A longer relationship title" relation af air -> f "Another title" relation cg c -> g "Nested" relation fh f -> h "Nested"';
  const styles='style water {width 400 height 180 fontSize 22} style e {width 170 height 250} style c {width 310 fontSize 28}';
  for(const grouped of [false,true])for(const direction of ['down','up','right','left'])for(const sharePath of ['none','stereotypes']) {
    const g=arch.layout(doc(model,`direction ${direction} siblingGap 32 sharePath ${sharePath}`,grouped,styles+(grouped?' routes {icon core.cloud iconPosition top}':'')));
    checkGeometry(g);
  }
});

test('forest packing also reuses free levels while retaining root order and double sibling gap',()=>{
  const g=arch.layout(doc(body+' service other "Other root"','direction down'));
  const root=g.nodes.find(n=>n.id==='r'),other=g.nodes.find(n=>n.id==='other');
  assert.equal(other.x-root.x-root.width,96);assert.deepEqual(g.tree.roots,['r','other']);
  checkGeometry(g);
});

test('deterministic unbalanced forests retain collision-free occupied ranks and stable input',()=>{
  let seed=73;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let sample=0;sample<6;sample++) {
    let model='',styles='';
    for(let i=0;i<36;i++) {
      model+=`service n${i} "Node ${i}" `;
      if(i&&i%13)model+=`relation e${i} n${random(i)} -> n${i} "${i%4?'Contains':'A long label to test the occupied contour'}" `;
      styles+=`style n${i} {width ${160+random(5)*45} height ${96+random(4)*29} fontSize ${12+random(3)*5}} `;
    }
    for(const direction of ['down','right']) {
      const parsed=arch.parse(doc(model,`direction ${direction} siblingGap 16`,false,styles)),before=JSON.stringify(parsed),g=arch.layout(parsed);
      checkGeometry(g);assert.equal(JSON.stringify(parsed),before);assert.deepEqual(arch.layout(parsed),g);
    }
  }
});

test('compact tree demo keeps JSON, named groups, shared paths and both bundles equivalent',async()=>{
  const source=await readFile('examples/compact-tree.arch','utf8');
  assert.deepEqual(arch.validate(source).diagnostics,[]);
  for(const view of ['down','right','named']) {
    const g=arch.layout(source,{view});checkGeometry(g);assert.ok(g.sharedPaths?.length);
    const expected=arch.renderToString(source,{view,idPrefix:'compact'});
    assert.equal(arch.renderToString(arch.translate(source),{view,idPrefix:'compact'}),expected);
    for(const file of ['arch.core.min.js', 'arch.min.js']) {
      const c=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),c);
      assert.equal(c.arch.renderToString(source,{view,idPrefix:'compact'}),expected);
    }
  }
});
