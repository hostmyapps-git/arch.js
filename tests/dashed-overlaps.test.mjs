import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const source=`architecture "Dashes" {
  model {
    application a "A" application b "B" application c "C"
    relation first a -> c "First"
    relation second b -> c "Second"
  }
  view v "V" {
    place a at (-60,152) place b at (-55,212) place c at (390,24)
    routes { curve orthogonal dasharray [5,5] color black width 2 label none }
    route first { from right to bottom via (500,200) }
    route second { from right to bottom via (500,260) }
  }
}`;
const render=s=>new DOMParser().parseFromString(arch.renderToString(s,{idPrefix:'overlap'}),'image/svg+xml');
const edge=(doc,id)=>[...doc.getElementsByTagName('g')].find(g=>g.getAttribute('data-edge')===id);

test('coincident manual routes keep one dashed stroke and both endpoint markers',()=>{
  const doc=render(source), first=edge(doc,'first'), second=edge(doc,'second');
  const [stroke,marker]=second.getElementsByTagName('path');
  assert.equal(doc.getElementsByTagName('mask').length,1);
  const mask=doc.getElementsByTagName('mask')[0];
  assert.equal(mask.getElementsByTagName('path')[0].getAttribute('d'),'M 500 120 L 500 200');
  assert.equal(stroke.getAttribute('mask'),'url(#overlap-route-mask-1)');
  assert.equal(stroke.getAttribute('stroke-dasharray'),'5 5');
  assert.equal(marker.getAttribute('marker-end'),first.getElementsByTagName('path')[0].getAttribute('marker-end'));
  assert.equal(marker.getAttribute('stroke'),'none');
  assert.equal(marker.getAttribute('d'),arch.layout(source).edges.find(e=>e.id==='second').d);
  assert.equal(render(arch.translate(source)).toString(),doc.toString());
});

test('rounded and reversed spans retain dash gaps with compatible paint, while distinct styles keep their strokes',()=>{
  const rounded=source.replace('curve orthogonal ', '');
  assert.equal(render(rounded).getElementsByTagName('mask')[0].getElementsByTagName('path')[0].getAttribute('d'),
    'M 500 120 L 500 190');
  const diagonal=source.replace('from right to bottom via (500,200)','path "M100 150 L500 350"')
    .replace('from right to bottom via (500,260)','path "M450 325 L200 200"');
  assert.equal(render(diagonal).getElementsByTagName('mask')[0].getElementsByTagName('path')[0].getAttribute('d'),
    'M 200 200 L 450 325');
  for (const attr of ['color blue','width 3','dasharray [7,3]','dasharray none']) {
    const different=source.replace('via (500,260) }',`via (500,260) ${attr} }`);
    assert.equal(render(different).getElementsByTagName('mask').length,0,attr);
  }
});

test('an automatic shared trunk owns its stroke where a compatible manual route overlaps',()=>{
  const bundled=`architecture "Trunk" {
    model { application a "A" application b "B" application c "C" application d "D"
      relation first a -> c "First" relation second b -> c "Second" relation manual d -> c "Manual" }
    view v "V" {
      place a at (0,0) place b at (0,220) place c at (740,110) place d at (300,340)
      routes { sharePath all dasharray [6,5] label none }
      route manual { from (480,158) to (740,158) curve straight }
    }
  }`;
  const graph=arch.layout(bundled), doc=render(bundled);
  assert.equal(graph.sharedPaths.length,2);
  assert.equal(graph.sharedPaths[1].d,'M 604.4 158 L 740 158');
  assert.equal(doc.getElementsByTagName('mask')[0].getElementsByTagName('path')[0].getAttribute('d'),graph.sharedPaths[1].d);
  assert.ok(edge(doc,'manual').getElementsByTagName('path')[0].hasAttribute('mask'));
});
