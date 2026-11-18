import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const profile={nodeTypes:{actor:{template:'person'},document:{template:'artifact'}},relationTypes:{exchange:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['document'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
const source=(view='',body='')=>`architecture "References" {model {actor a "Source" actor b "Target" document first "Report" document second "Report" document third "Other report" relation flow a -> b "Sends" {type exchange payload [first, second, third]} ${body}} view v "V" {${view}}}`;
const xml=svg=>new DOMParser({onError:(level,message)=>{throw new Error(message);}}).parseFromString(svg,'image/svg+xml');
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

test('automatic reference-bearing edge captions choose the free side for horizontal and vertical attachments',()=>{
  const labeled={...profile,relationTypes:{exchange:{...profile.relationTypes.exchange,referenceConnectorLabels:true}}};
  for(const [vertical,side]of [[false,-1],[false,1],[true,-1],[true,1]]) {
    const placements=vertical?
      `place a at (0,0) place b at (0,700) place first at (${side<0?-500:600},(a.bottom+b.y)/2-first.height/2) route flow {from bottom to top curve straight}`:
      `place a at (0,0) place b at (700,0) place first at ((a.right+b.x)/2-first.width/2,${side<0?-400:400}) route flow {from right to left curve straight}`;
    const text=source(`exclude second,third ${placements}`).replace('[first, second, third]','[first]');
    const model=arch.parse(text,{profile:labeled}),before=JSON.stringify(model),graph=arch.layout(model),edge=graph.edges[0];
    const axis=vertical?'x':'y',anchor=graph.referenceNodes[0].anchor;
    assert.ok((edge.label[axis]-anchor[axis])*side<0,'label faces away from attached card');
    assert.equal(JSON.stringify(model),before);
    assert.equal(arch.renderToString(text,{profile:labeled,idPrefix:'side'}),arch.renderToString(arch.translate(text,{profile:labeled}),{profile:labeled,idPrefix:'side'}));
  }
});

test('graphical reference cards preserve the original templates, show all payloads and attach to their own edge',()=>{
  const model=arch.parse(source(),{profile}),before=JSON.stringify(model),graph=arch.layout(model);
  assert.equal(graph.referenceNodes.length,3);
  assert.equal(graph.edges.length,1);
  assert.deepEqual(graph.edges[0].labelLines,['Sends']);
  for(const [i,ref] of graph.referenceNodes.entries()) {
    assert.equal(ref.edgeId,'flow');assert.equal(ref.node.template,'artifact');
    assert.equal(ref.anchor.y,graph.edges[0].points[0].y);
    for(const other of graph.referenceNodes.slice(i+1))assert.ok(!overlap(ref.node,other.node));
    for(const actor of graph.nodes.filter(n=>n.type==='actor'))assert.ok(!overlap(ref.node,actor));
    assert.ok(ref.node.x>=graph.bounds.x&&ref.node.y>=graph.bounds.y);
    assert.ok(ref.node.x+ref.node.width<=graph.bounds.x+graph.bounds.width);
    assert.ok(ref.node.y+ref.node.height<=graph.bounds.y+graph.bounds.height);
  }
  for(const theme of ['light','dark']) {
    const d=xml(arch.renderToString(model,{theme,idPrefix:'refs'})),groups=[...d.getElementsByTagName('g')];
    assert.equal(groups.filter(g=>g.getAttribute('class')==='arch-edge-reference').length,3);
    assert.equal([...d.getElementsByTagName('path')].filter(p=>p.getAttribute('class')==='arch-reference-connector').length,3);
    assert.equal(groups.filter(g=>g.getAttribute('data-node')==='first').length,1,'no detached duplicate card');
    const ids=new Set([...d.getElementsByTagName('*')].map(e=>e.getAttribute('id')).filter(Boolean));
    for(const element of d.getElementsByTagName('*'))for(const attr of [...element.attributes])for(const match of attr.value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.has(match[1]),match[1]);
  }
  assert.equal(JSON.stringify(model),before);
  const differentHeights=arch.layout(arch.parse(source('style a {height 140} style b {height 120}'),{profile}));
  assert.ok(differentHeights.referenceNodes.every(ref=>ref.node.y+ref.node.height<0),'a short vertical routing segment must not move horizontal-flow references beside the actors');
});

test('shared payloads reuse one card with an attachment to each edge; explicit cards retain their position',()=>{
  const shared='relation reply b -> a "Returns" {type exchange payload [first]}';
  const graph=arch.layout(arch.parse(source('',shared),{profile}));
  assert.equal(graph.referenceNodes.filter(r=>r.nodeId==='first').length,2);
  assert.deepEqual(graph.referenceNodes.filter(r=>r.nodeId==='first').map(r=>r.edgeId),['flow','reply']);
  const refs=graph.referenceNodes.filter(r=>r.nodeId==='first');
  assert.equal(refs[0].node,refs[1].node);
  const sharedDoc=xml(arch.renderToString(source('',shared),{profile}));
  const sharedCard=[...sharedDoc.getElementsByTagName('g')].filter(g=>g.getAttribute('class')==='arch-edge-reference'&&g.getAttribute('data-reference-node')==='first');
  assert.equal(sharedCard.length,1);assert.equal(sharedCard[0].getAttribute('data-reference-for'),'flow reply');
  const placed=arch.layout(arch.parse(source('place first at (40, -300)',shared),{profile}));
  for(const occurrence of placed.referenceNodes.filter(r=>r.nodeId==='first')) {
    assert.equal(occurrence.node.x,40);assert.equal(occurrence.node.y,-300);assert.equal(occurrence.explicit,true);
  }
  const d=xml(arch.renderToString(source('place first at (40, -300)',shared),{profile}));
  assert.equal([...d.getElementsByTagName('g')].filter(g=>g.getAttribute('data-node')==='first').length,1);
  arch.registerIconPack('reference-gradient',{icons:{document:{width:24,height:24,body:'<defs><linearGradient id="paint"><stop stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="24" height="24" fill="url(#paint)"/>'}}});
  const colored=xml(arch.renderToString(source('referenceOccurrences perEdge',shared).replace('document first "Report"','document first "Report" {icon reference-gradient.document}'),{profile,idPrefix:'reference-gradient-test'}));
  const ids=[...colored.getElementsByTagName('*')].map(e=>e.getAttribute('id')).filter(Boolean);
  assert.equal(new Set(ids).size,ids.length,'reused icon instances must have distinct local SVG IDs');
});

test('perEdge occurrences repeat only reused cards and visibly identify every copy without changing model identity',()=>{
  const shared='relation reply b -> a "Returns" {type exchange payload [first]}';
  const model=arch.parse(source('referenceOccurrences perEdge',shared),{profile}),before=JSON.stringify(model),graph=arch.layout(model);
  const refs=graph.referenceNodes.filter(r=>r.nodeId==='first');
  assert.notEqual(refs[0].node,refs[1].node);
  assert.ok(!overlap(refs[0].node,refs[1].node));
  assert.deepEqual(refs.map(r=>r.node.referenceIdentityLines),[['ID: first'],['ID: first']]);
  const d=xml(arch.renderToString(model)),groups=[...d.getElementsByTagName('g')];
  assert.equal(groups.filter(g=>g.getAttribute('class')==='arch-edge-reference').length,4);
  const identities=groups.filter(g=>g.hasAttribute('data-reference-id'));
  assert.equal(identities.length,2);assert.ok(identities.every(g=>g.textContent==='ID: first'));
  assert.equal(graph.nodes.filter(n=>n.id==='first').length,1);
  assert.equal(JSON.stringify(model),before);
  const placed=xml(arch.renderToString(source('referenceOccurrences perEdge place first at (40,-300)',shared),{profile}));
  assert.equal([...placed.getElementsByTagName('g')].filter(g=>g.getAttribute('data-node')==='first').length,1);
  assert.equal(arch.validate(source('referenceOccurrences invalid'),{profile}).valid,false);
  assert.equal(arch.validate(source('referenceOccurrences perEdge diagram class {}'),{profile}).valid,false);
  assert.match(arch.renderToString('@help views'),/referenceOccurrences shared/);
  const longId='W'.repeat(90),longGraph=arch.layout(arch.parse(source('referenceOccurrences perEdge',shared).replaceAll('first',longId),{profile}));
  const longCopies=longGraph.referenceNodes.filter(r=>r.nodeId===longId);
  assert.ok(longCopies.every(r=>r.node.referenceIdentityLines.length>2));
  assert.equal(longCopies[0].node.referenceIdentityLines.join('').replace(/^ID:\s*/,''),longId);
  assert.ok(longCopies.every(r=>r.node.y+r.node.height<=longGraph.bounds.y+longGraph.bounds.height));
});

test('reference occurrence profile defaults inherit and views override them',()=>{
  const repeated={...profile,relationTypes:{...profile.relationTypes,exchange:{...profile.relationTypes.exchange,referenceOccurrences:'perEdge'},child:{extends:'exchange'}}};
  const shared='relation reply b -> a "Returns" {type child payload [first]}';
  const inherited=arch.layout(arch.parse(source('',shared),{profile:repeated})).referenceNodes.filter(r=>r.nodeId==='first');
  assert.notEqual(inherited[0].node,inherited[1].node);
  const overridden=arch.layout(arch.parse(source('referenceOccurrences shared',shared),{profile:repeated})).referenceNodes.filter(r=>r.nodeId==='first');
  assert.equal(overridden[0].node,overridden[1].node);
  assert.throws(()=>arch.registerProfile('bad-occurrences',{...profile,relationTypes:{exchange:{...profile.relationTypes.exchange,referenceOccurrences:'invalid'}}}),/referenceOccurrences/);
});

test('referenceDisplay overrides are per view, and excluded cards fall back to typed reference labels',()=>{
  const model=arch.parse(source('referenceDisplay labels'),{profile}),graph=arch.layout(model);
  assert.equal(graph.referenceNodes.length,0);
  assert.match(graph.edges[0].labelText,/Carries: Report \[first\]/);
  const both=arch.layout(arch.parse(source('referenceDisplay both'),{profile}));
  assert.equal(both.referenceNodes.length,3);assert.ok(both.edges[0].labelLines.join(' ').includes('Carries:'));
  const hidden=arch.layout(arch.parse(source('exclude first, second, third'),{profile}));
  assert.equal(hidden.referenceNodes.length,0);assert.ok(hidden.edges[0].labelLines.join(' ').includes('Report [first]'));
  assert.equal(arch.validate(source('referenceDisplay impossible'),{profile}).valid,false);
  assert.throws(()=>arch.registerProfile('bad-reference-display',{...profile,relationTypes:{exchange:{...profile.relationTypes.exchange,referenceDisplay:'invalid'}}}),/referenceDisplay/);
});

test('attachments use the rendered cubic path and preserve manual label coordinates',()=>{
  const path='M 220 48 C 300 -100 500 -100 580 48';
  const one=source(`route flow {path "${path}" label (700, 200)}`).replace('[first, second, third]','[first]');
  const graph=arch.layout(arch.parse(one,{profile})),anchor=graph.referenceNodes[0].anchor;
  assert.ok(Math.abs(anchor.x-400)<0.1);
  assert.ok(Math.abs(anchor.y+63)<0.1);
  assert.deepEqual(graph.edges[0].label,{x:700,y:200});
});

test('logo display is view-local, fits non-square colored icons and keeps accessible titles without visible labels',()=>{
  arch.registerIconPack('logo-test',{icons:{wide:{width:300,height:100,body:'<rect width="300" height="100" fill="#ff0000"/>'}}});
  const doc=source('place a at (0,0) size (180,96) style a {display logo icon logo-test.wide}').replace('view v "V"','view v "Logo"')+' ';
  const model=arch.parse(doc,{profile}),graph=arch.layout(model);
  assert.equal(graph.nodes.find(n=>n.id==='a').height,96);
  for(const theme of ['light','dark']) {
    const d=xml(arch.renderToString(model,{theme}));
    const logo=[...d.getElementsByTagName('g')].find(g=>g.getAttribute('data-display')==='logo');
    assert.ok(logo);assert.equal(logo.getElementsByTagName('text').length,0);
    assert.match(logo.getAttribute('aria-label'),/Source, actor/);
    assert.ok([...logo.getElementsByTagName('rect')].some(e=>e.getAttribute('fill')==='#ff0000'));
    const icon=[...logo.getElementsByTagName('g')].find(g=>g.getAttribute('data-icon')==='logo-test.wide');
    assert.match(icon.getAttribute('transform'),/translate\(16 23\.333\)/);
  }
  const standard=arch.layout(arch.parse(source(),{profile}));assert.equal(standard.nodes.find(n=>n.id==='a').display,undefined);
  const payload=xml(arch.renderToString(source('style first {display logo icon logo-test.wide}'),{profile}));
  const occurrence=[...payload.getElementsByTagName('g')].find(g=>g.getAttribute('class')==='arch-edge-reference'&&g.getAttribute('data-reference-node')==='first');
  assert.equal(occurrence.getElementsByTagName('text').length,0);
  assert.ok([...occurrence.getElementsByTagName('g')].some(g=>g.getAttribute('data-display')==='logo'));
  assert.equal(arch.validate(source('style a {display bad}'),{profile}).valid,false);
  assert.equal(arch.validate('architecture "C" {model {package p "P"} view v "V" {style p {display logo}}}').valid,false);
});
