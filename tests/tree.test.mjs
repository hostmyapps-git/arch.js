import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as arch from '../src/arch.js';

for(const name of ['uaf','naf4-uaf','naf41-uaf'])arch.registerProfile(name,JSON.parse(await readFile(`profiles/${name}.json`,'utf8')));
const taxonomy=await readFile('examples/taxonomy.arch','utf8');
const doc=(body,options='',styles='')=>`architecture "Tree" {model {${body}}view v "Tree" {diagram tree {${options}} ${styles}}}`;
const three='service root "Root" service a "A" service b "B" relation x root -> a "Child A" relation y root -> b "Child B"';
const center=(n,vertical)=>vertical?n.x+n.width/2:n.y+n.height/2;
const validBounds=graph=>{
  const b=graph.bounds;
  for(const n of graph.nodes){assert.ok(n.x>=b.x&&n.y>=b.y);assert.ok(n.x+n.width<=b.x+b.width&&n.y+n.height<=b.y+b.height);}
  for(const e of graph.edges)for(const p of e.points)assert.ok(p.x>=b.x&&p.y>=b.y&&p.x<=b.x+b.width&&p.y<=b.y+b.height);
};

test('C1 tree infers generalization targets as parents, centers roots and preserves semantic arrow direction',()=>{
  const graph=arch.layout(taxonomy),nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  assert.deepEqual(graph.tree.roots,['c_SAR']);assert.equal(graph.edges.length,5);
  const root=nodes.get('c_SAR'),maritime=nodes.get('c_maritimeSAR'),land=nodes.get('c_landSAR');
  assert.equal(root.treeDepth,0);assert.equal(maritime.treeDepth,1);assert.equal(nodes.get('c_highSeaMaritimeSAR').treeDepth,2);
  assert.equal(center(root,true),(center(maritime,true)+center(land,true))/2);
  for(const edge of graph.edges) {
    const source=nodes.get(edge.source),target=nodes.get(edge.target);
    assert.ok(source.y>target.y);assert.equal(edge.points[0].y,source.y);assert.equal(edge.points.at(-1).y,target.y+target.height);
  }
  assert.match(arch.renderToString(taxonomy,{idPrefix:'taxonomy'}),/data-diagram="tree"/);
  assert.match(arch.renderToString(taxonomy,{idPrefix:'taxonomy'}),/marker-end="url\(#taxonomy-triangle\)"/);validBounds(graph);
});

test('tree handles source-parent links, explicit target-parent links, horizontal layout, forests and isolated nodes deterministically',()=>{
  const text=doc(three+' service lonely "Standalone"'),model=arch.parse(text),before=JSON.stringify(model),graph=arch.layout(model);
  assert.deepEqual(graph.tree.roots,['root','lonely']);assert.ok(graph.nodes.find(n=>n.id==='a').y>graph.nodes.find(n=>n.id==='root').y);
  assert.equal(JSON.stringify(model),before);assert.deepEqual(arch.layout(model),graph);
  const target=arch.layout(doc(three,'parentDirection target','style y {display none}'));
  assert.equal(target.nodes.find(n=>n.id==='root').treeParent,'a');
  const right=arch.layout(doc(three,'orientation right showLabels false curve orthogonal'));
  assert.ok(right.nodes.find(n=>n.id==='a').x>right.nodes.find(n=>n.id==='root').x);
  assert.ok(right.edges.every(e=>!e.labelLines.length&&!e.d.includes('Q')));validBounds(right);
  assert.match(arch.renderToString(doc('package p "Package" {service a "A"}')),/class="arch-node"[^>]*data-node="p"/);
});

test('relation filters include inherited types without changing the model; hides can select a proper tree',()=>{
  const profile={nodeTypes:{service:{template:'service'}},relationTypes:{hierarchy:{style:'generalization'},sub:{extends:'hierarchy'},other:{style:'flow'}}};
  const body='service root "Root" service a "A" service b "B" relation x a -> root "Child" {type sub} relation y b -> root "Child" {type hierarchy} relation cross a -> b "Cross-link" {type other}';
  const model=arch.parse(doc(body,'relations [hierarchy]'),{profile}),graph=arch.layout(model);
  assert.equal(model.edges.length,3);assert.deepEqual(graph.edges.map(e=>e.id),['x','y']);assert.deepEqual(graph.tree.roots,['root']);
  const hidden=arch.layout(doc(three+' relation cross a -> b "Cross"','','style cross {display none} style a {display none}'));
  assert.deepEqual(hidden.nodes.map(n=>n.id),['root','b']);assert.equal(hidden.edges.length,1);
  assert.equal(arch.renderToString(arch.translate(taxonomy),{idPrefix:'same'}),arch.renderToString(taxonomy,{idPrefix:'same'}));
});

test('true-tree validation rejects ambiguous parents, parallel links, cycles, self-links, bidirectionality and invalid options',()=>{
  for(const [text,pattern]of [
    [doc(three+' relation other a -> b "Second parent"'),/multiple parents/],
    [doc(three+' relation other root -> a "Parallel"'),/Parallel tree relationships/],
    [doc('service a "A" service b "B" relation x a -> b "X" relation y b -> a "Y"'),/contains a cycle/],
    [doc('service a "A" relation x a -> a "Self"'),/self-link/],
    [doc(three.replace('root -> a','root <-> a')),/bidirectional/],
    [doc(three,'parentDirection reverse'),/parentDirection must/],
    [doc(three,'orientation diagonal'),/orientation must/],
    [doc(three,'curve bezier'),/curve must/],
    [doc(three,'siblingGap 0'),/siblingGap must/],
    [doc(three,'levelGap 801'),/levelGap must/],
    [doc(three,'showLabels "false"'),/showLabels must/],
    [doc(three,'relations [missing]'),/unknown or invisible reference/],
    [doc(three,'','place root at (0,0)'),/place\/route/],
    [doc(three,'','route x {from top}'),/place\/route/],
  ])assert.match(arch.validate(text,{validation:'draft'}).diagnostics[0].message,pattern,text);
});

test('asymmetric subtrees and variable card sizes have no overlaps, aligned ranks and centered parents in both orientations',()=>{
  const body='service r "Root" service a "A" service b "B" service c "C" service a1 "A1" service a2 "A2" service a3 "A3" service b1 "B1" relation ra r -> a "A" relation rb r -> b "B" relation rc r -> c "C" relation aa a -> a1 "First" relation ab a -> a2 "Second" relation ac a -> a3 "Third" relation ba b -> b1 "Child"';
  const styles='style a {width 400 height 180 fontSize 22} style b {width 160 height 120 iconPosition bottom} style a2 {fontSize 28 width 190}';
  for(const orientation of ['down','right']) {
    const graph=arch.layout(doc(body,`orientation ${orientation}`,styles)),byId=new Map(graph.nodes.map(n=>[n.id,n])),vertical=orientation==='down';
    for(const parent of graph.nodes) {
      const children=graph.nodes.filter(n=>n.treeParent===parent.id);
      if(children.length)assert.equal(center(parent,vertical),(center(children[0],vertical)+center(children.at(-1),vertical))/2);
    }
    for(let i=0;i<graph.nodes.length;i++)for(const b of graph.nodes.slice(i+1)) {
      const a=graph.nodes[i];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${a.id}/${b.id}`);
    }
    assert.ok(byId.get('a').width===400);validBounds(graph);
  }
});

test('tree styles, long Unicode labels, fixed colors and hidden text remain bounded without dropping source text',()=>{
  const title='Capability '+ '漢字 🙂 Überwachung '.repeat(12);
  const text=doc(three.replace('"A"',JSON.stringify(title)).replace('"Child A"',JSON.stringify('Specialization '+title)),
    'siblingGap 16 levelGap 16','style root {showIcon false showStereotype false backgroundColor Gold opacity 1} style a {width 160 fontSize 20 iconPosition right} style b {display logo icon core.cloud}');
  for(const theme of ['light','dark']) {
    const graph=arch.layout(text,{theme}),svg=arch.renderToString(text,{theme});validBounds(graph);
    assert.ok(graph.nodes.find(n=>n.id==='a').height>100);assert.match(svg,/fill="#ffd700"/);assert.ok(svg.includes('漢字'));assert.match(svg,/data-display="logo"/);
    assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
  }
});

test('empty and deep trees, JSON and API adapters, draft notices, stacking and both standalone bundles work',async()=>{
  assert.doesNotMatch(arch.renderToString(doc('')),/NaN|Infinity|undefined/);
  const body=Array.from({length:1000},(_,i)=>`service n${i} "N${i}"${i?` relation e${i} n${i-1} -> n${i} ""`:''}`).join(' ');
  const deep=arch.layout(doc(body,'showLabels false'));assert.equal(deep.nodes.at(-1).treeDepth,999);validBounds(deep);
  const stacked=taxonomy.replace('config { profile naf41-uaf }','config { profile naf41-uaf views all }');assert.equal(arch.layout(stacked).layouts.length,2);
  const incomplete='architecture "Draft tree" {config {validation draft type service {template service attribute owner {required true}}}model {service a "A"}view v "V"{diagram tree}}';
  assert.equal(arch.layout(incomplete).kind,'notices');assert.match(arch.renderToString(incomplete),/arch-validation-notices/);
  assert.match(arch.renderMarkdown('```arch\n'+doc(three)+'\n```'),/data-diagram="tree"/);
  assert.match(arch.renderToString('@help diagrams tree'),/Automatic taxonomy/);
  assert.ok(arch.inspectSource(doc(three,'orientation invalid')).candidates?.length||arch.inspectSource(doc(three,'orientation invalid')).diagnostics[0].candidates.length);
  const expected=arch.renderToString(doc(three),{idPrefix:'same'});
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);assert.equal(context.arch.renderToString(doc(three),{idPrefix:'same'}),expected);
  }
});
