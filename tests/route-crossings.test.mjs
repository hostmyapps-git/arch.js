import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import * as arch from '../src/arch.js';

const source=`architecture "Crossings" {
  model {
    application west "West" application east "East"
    application north "North" application south "South"
    relation horizontal west -> east "Across"
    relation vertical north -> south "Down"
  }
  view v "V" {
    place west at (0, 252) place east at (740, 252)
    place north at (360, 0) place south at (360, 590)
    routes { label none }
    route horizontal { from (220, 300) to (740, 300) curve straight }
    route vertical { from (470, 100) to (470, 590) curve straight }
  }
}`;
const paths=svg=>{
  const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
  return Object.fromEntries([...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-edge'))
    .map(g=>[g.getAttribute('data-edge'),g.getElementsByTagName('path')[0]]));
};
const render=input=>arch.renderToString(input,{idPrefix:'crossings'});
const d=(input,id)=>paths(render(input))[id].getAttribute('d');
const arc=/\bA \d/;
const coincident=source.replace('relation vertical north -> south "Down"',`
    relation p5.12 north -> south "Has"
    relation p5.13 north -> south "Has"
    relation p5.14 north -> south "Has"
    relation p5.15 south -> north "Has"`).replace(
  'route vertical { from (470, 100) to (470, 590) curve straight }',`
    route p5.12 { from (470, 100) to (470, 590) curve straight }
    route p5.13 { from (470, 150) to (620, 440) via (470, 440) curve rounded }
    route p5.14 { from (470, 210) to (630, 470) via (470, 470) curve rounded }
    route p5.15 { from (470, 590) to (470, 100) curve straight }`);

test('a connected crossing gets one bridge by default without changing logical geometry or markers',()=>{
  const graph=arch.layout(source);
  const {horizontal,vertical}=paths(render(source));
  assert.equal(horizontal.getAttribute('d'),'M 220 300 L 740 300');
  assert.equal(vertical.getAttribute('d'),'M 470 100 L 470 294 A 6 6 0 0 1 470 306 L 470 590');
  assert.equal(graph.edges[1].d,'M 470 100 L 470 590');
  assert.equal(vertical.getAttribute('marker-end'),'url(#crossings-arrow)');
  assert.match(d(source.replaceAll('curve straight','curve rounded'),'vertical'),arc);
  assert.match(d(source.replace('from (470, 100) to (470, 590)','from (340, 100) to (600, 590)'),'vertical'),arc);
});

test('view and per-route crossing controls govern bridge placement and survive translation',()=>{
  const plain=source.replace('label none','label none crossings none crossingRadius 8');
  assert.doesNotMatch(render(plain),arc);
  const local=plain.replace('curve straight }\n  }','curve straight crossings bridge }\n  }');
  assert.match(d(local,'vertical'),/\bA 8 8 0 0 1 /);
  const style=local.replace('crossings bridge }','crossings bridge crossingRadius 10 }');
  assert.match(d(style,'vertical'),/\bA 10 10 0 0 1 /);
  assert.equal(render(style),render(arch.translate(style)));
  const keep=source.replace('curve straight }\n  }','curve straight crossings none }\n  }');
  assert.match(d(keep,'horizontal'),arc);
  assert.doesNotMatch(d(keep,'vertical'),arc);
  for (const [option,error] of [
    ['crossings prominent',/crossings must be bridge or none/],
    ['crossingRadius 25',/crossingRadius must be a number between 2 and 24/],
  ]) assert.match(arch.validate(source.replace('label none',`label none ${option}`)).diagnostics[0].message,error);
});

test('all coincident routes use the same bridge even with different extents and a reversed path',()=>{
  const diagram=paths(render(coincident));
  assert.doesNotMatch(diagram.horizontal.getAttribute('d'),arc);
  for (const id of ['p5.12','p5.13','p5.14'])
    assert.match(diagram[id].getAttribute('d'),/L 470 294 A 6 6 0 0 1 470 306/);
  assert.match(diagram['p5.15'].getAttribute('d'),/L 470 306 A 6 6 0 0 0 470 294/);
  assert.ok(arch.layout(coincident).edges.every(edge=>!arc.test(edge.d)));
  const larger=paths(render(coincident.replace('to (470, 100) curve straight','to (470, 100) curve straight crossingRadius 9')));
  for (const id of ['p5.12','p5.13','p5.14','p5.15'])
    assert.match(larger[id].getAttribute('d'),/A 9 9/);
});

test('a local bridge opt-out prevents a partially bent coincident bundle',()=>{
  const diagram=paths(render(coincident.replace('to (470, 100) curve straight','to (470, 100) curve straight crossings none')));
  assert.match(diagram.horizontal.getAttribute('d'),arc);
  for (const id of ['p5.12','p5.13','p5.14','p5.15'])
    assert.doesNotMatch(diagram[id].getAttribute('d'),arc);
});

test('a coincident branch ending within the arc clearance keeps the entire bundle straight',()=>{
  const diagram=paths(render(coincident.replace('to (470, 100) curve straight','to (470, 303) curve straight')));
  assert.match(diagram.horizontal.getAttribute('d'),arc);
  for (const id of ['p5.12','p5.13','p5.14','p5.15'])
    assert.doesNotMatch(diagram[id].getAttribute('d'),arc);
});

test('matching dashed routes mask duplicate bridge arcs and retain their edge markers',()=>{
  const text=coincident.replace('routes { label none }','routes { label none dasharray [8, 4] }');
  const doc=new DOMParser().parseFromString(render(text),'image/svg+xml');
  const masks=new Map([...doc.getElementsByTagName('mask')].map(mask=>[mask.getAttribute('id'),mask.getElementsByTagName('path')[0].getAttribute('d')]));
  const groups=new Map([...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-edge')).map(g=>[g.getAttribute('data-edge'),g]));
  assert.match(groups.get('p5.12').getElementsByTagName('path')[0].getAttribute('d'),arc);
  for (const id of ['p5.13','p5.14','p5.15']) {
    const [stroke,markers]=groups.get(id).getElementsByTagName('path');
    const maskId=stroke.getAttribute('mask').match(/^url\(#([^\)]+)\)$/)[1];
    assert.match(masks.get(maskId),arc);
    assert.ok(markers.hasAttribute('marker-end'));
    assert.equal(markers.getAttribute('mask'),null);
  }
});

test('endpoints, turns, and labels protect their immediate surroundings',()=>{
  assert.doesNotMatch(render(source.replace('to (470, 590)','to (470, 300)')),arc);
  assert.doesNotMatch(render(source.replace('to (470, 590) curve straight','to (550, 300) via (470, 300) curve straight')),arc);
  assert.doesNotMatch(render(source.replace('from (470, 100)','from (470, 296)')),arc);
  assert.doesNotMatch(render(source.replace('to (470, 590) curve straight','to (470, 590) curve straight label (470, 300)')),arc);
  const explicit=source.replace('from (470, 100) to (470, 590) curve straight','path "M470 100 V590"');
  assert.equal(d(explicit,'vertical'),'M470 100 V590');
  assert.match(d(explicit,'horizontal'),arc);
});

test('the L8 bridge leaves the shared Asset Control branches and the logical routes intact',()=>{
  for (const id of ['uaf','naf41-uaf']) arch.registerProfile(id,JSON.parse(readFileSync(`profiles/${id}.json`,'utf8')));
  const input=readFileSync('examples/naf41-logical-constraints.arch','utf8');
  assert.match(d(input,'permanentSearch'),arc);
  assert.doesNotMatch(d(input,'independentC2'),arc);
  const doc=new DOMParser().parseFromString(render(input),'image/svg+xml');
  const shared=[...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-shared-path'));
  assert.equal(shared.length,2);
  for (const part of shared) assert.doesNotMatch(part.getElementsByTagName('path')[0].getAttribute('d'),arc);
});
