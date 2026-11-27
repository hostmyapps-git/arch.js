import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { DOMParser } from '@xmldom/xmldom';
import * as studio from '../src/arch.studio.js';
import * as core from '../src/arch.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const source = `architecture "Architecture & examples" {
  config { views all }
  model {
    process source "Entry & processing"
    system target "<Marker>"
    relation connection source -> target "Data transfer"
  }
  view flow "First & main" {
    place source at (-60,-10)
    place target at (400,85)
    route connection { from right to left via (270,35) color red dasharray 6,4 }
    backgroundImage "/private/example.png"
  }
  view table "Table" { diagram table { fields [title] } }
}`;
const loadImage = async url => {
  assert.equal(url,'/private/example.png');
  return png;
};
const options = {loadImage};
const xml = text => new DOMParser({onError(level,message) { throw new Error(level+': '+message); }}).parseFromString(text,'application/xml');
const tags = (document,tag) => [...document.getElementsByTagName(tag)];
function members(bytes) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const decoder = new TextDecoder(), entries = new Map();
  let offset = 0;
  while (view.getUint32(offset,true)===0x04034b50) {
    const size = view.getUint32(offset+18,true), length=view.getUint16(offset+26,true);
    const name = decoder.decode(bytes.subarray(offset+30,offset+30+length));
    offset += 30+length+view.getUint16(offset+28,true);
    assert.ok(!entries.has(name));
    entries.set(name,bytes.subarray(offset,offset+size));
    offset += size;
  }
  assert.equal(view.getUint32(offset,true),0x02014b50);
  return entries;
}

test('Studio exports standalone SVG and draw.io pages with connected geometry and embedded images', async () => {
  assert.equal(core.exportDiagram,undefined);
  const [svg,drawio] = await Promise.all(['svg','drawio'].map(format=>studio.exportDiagram(source,format,options)));
  assert.equal(svg.name,'architecture-examples.svg');
  const svgXML = xml(svg.data);
  assert.equal(tags(svgXML,'image')[0].getAttribute('href'),png);
  assert.equal(svgXML.documentElement.getAttribute('data-arch-views'),'2');
  const draw = xml(drawio.data);
  assert.deepEqual(tags(draw,'diagram').map(page=>page.getAttribute('name')),['First & main','Table']);
  const cells = tags(draw,'mxCell');
  assert.ok(cells.some(cell=>cell.getAttribute('value')==='<Marker>'));
  const connector = cells.find(cell=>cell.hasAttribute('source') && cell.hasAttribute('target'));
  assert.ok(connector);
  assert.match(connector.getAttribute('style'),/strokeColor=#ff0000/);
  assert.ok(tags(connector,'mxPoint').length>0);
  const stencil = cells.map(cell=>cell.getAttribute('style')?.match(/shape=stencil\(([^)]+)\)/)?.[1]).find(Boolean);
  assert.match(decodeURIComponent(inflateRawSync(Buffer.from(stencil,'base64')).toString()),/<fillstroke\/>/);
  assert.ok(cells.some(cell=>cell.getAttribute('style')?.includes(png.replace(';base64',''))));
});

test('Visio packages drawing pages, native shapes, glue and binary images', async () => {
  const file = await studio.exportDiagram(source,'vsdx',options);
  assert.equal(file.name,'architecture-examples.vsdx');
  const archive = members(file.data), decode = name => xml(new TextDecoder().decode(archive.get(name)));
  const page = decode('visio/pages/page1.xml');
  assert.deepEqual(tags(decode('visio/pages/pages.xml'),'Page').map(page=>page.getAttribute('Name')),['First & main','Table']);
  assert.ok(tags(page,'Text').some(text=>text.textContent==='Entry & processing'));
  const shapes = tags(page,'Shape');
  const ids = new Set(shapes.map(shape=>shape.getAttribute('ID')));
  for (const connection of tags(page,'Connect')) {
    assert.ok(ids.has(connection.getAttribute('FromSheet')));
    assert.ok(ids.has(connection.getAttribute('ToSheet')));
  }
  assert.equal(tags(page,'Connect').length,2);
  assert.equal(tags(page,'ForeignData')[0].getAttribute('ForeignType'),'Bitmap');
  assert.match(tags(decode('visio/pages/_rels/page1.xml.rels'),'Relationship')[0].getAttribute('Type'),/\/image$/);
  assert.deepEqual(archive.get('visio/media/image1.png'),Uint8Array.from(Buffer.from(png.split(',')[1],'base64')));
});

test('draw.io preserves C4 right-angle waypoints, port alignment and the requested corner style', async () => {
  for (const id of ['uaf','naf41-uaf']) {
    const definition = JSON.parse(await readFile(new URL(`../profiles/${id}.json`,import.meta.url),'utf8'));
    studio.registerProfile(id,definition);
  }
  const c4 = `architecture "NAF C4" {
    config { profile naf41-uaf }
    model {
      Capability c2 "SAR C2"
      Capability assistance "Assistance"
      StandardOperationalActivity monitor "Monitor Health"
      StandardOperationalActivity locate "Locate Patient"
      relation c4.1 monitor -> c2 "supports" { type MapsToCapability }
      relation c4.2 monitor -> assistance "supports" { type MapsToCapability }
      relation c4.3 locate -> assistance "supports" { type MapsToCapability }
    }
    view c4 "C4" {
      viewpoint C4
      style c2 { height 100 }
      place c2 at (0,0)
      place monitor at (c2.x,c2.y+2*c2.height)
      place locate at (c2.x+2*c2.width,c2.y+2*c2.height)
      place assistance at (c2.x+2*c2.width,c2.y)
      route c4.2 { color red }
    }
  }`;
  async function connector(input) {
    const file = await studio.exportDiagram(input,'drawio');
    const cells = tags(xml(file.data),'mxCell');
    const edge = cells.find(cell=>cell.getAttribute('style')?.includes('strokeColor=#ff0000'));
    const style = Object.fromEntries(edge.getAttribute('style').split(';').filter(Boolean).map(pair=>pair.split('=')));
    const port = (attribute,key) => {
      const node = cells.find(cell=>cell.getAttribute('id')===edge.getAttribute(attribute));
      const [box] = tags(node,'mxGeometry');
      return ['X','Y'].map((axis,i)=>+box.getAttribute(axis.toLowerCase()) +
        +box.getAttribute(i?'height':'width') * +style[key+axis]);
    };
    const points = tags(edge,'mxPoint').map(point=>[+point.getAttribute('x'),+point.getAttribute('y')]);
    return {style,points,source:port('source','exit'),target:port('target','entry')};
  }
  const rounded = await connector(c4);
  assert.equal(rounded.style.noEdgeStyle,'1');
  assert.equal(rounded.style.rounded,'1');
  assert.equal(rounded.style.arcSize,'20');
  assert.equal(rounded.points.length,2);
  assert.equal(rounded.source[1],rounded.points[0][1]);
  assert.equal(rounded.points[0][0],rounded.points[1][0]);
  assert.equal(rounded.target[1],rounded.points[1][1]);
  const square = await connector(c4.replace('color red','color red curve orthogonal'));
  assert.equal(square.style.rounded,'0');
  assert.deepEqual(square.points,rounded.points);
  const bezier = await connector(c4.replace('color red','color red curve bezier'));
  assert.equal(bezier.style.rounded,'0');
  assert.ok(bezier.points.length>2);
});

test('Excalidraw exports an editable scene and reports an unavailable image', async () => {
  const file = await studio.exportDiagram(source,'excalidraw',{...options,view:'flow'});
  assert.equal(file.name,'architecture-examples-flow.excalidraw');
  const scene = JSON.parse(file.data);
  assert.equal(scene.type,'excalidraw');
  assert.ok(scene.elements.some(item=>item.type==='text' && item.text==='<Marker>'));
  const [image] = scene.elements.filter(item=>item.type==='image');
  assert.equal(scene.files[image.fileId].dataURL,png);
  const route = scene.elements.find(item=>item.type==='arrow' && item.strokeColor==='#ff0000');
  assert.ok(route.points.length>2);
  assert.equal(route.endArrowhead,'arrow');
  assert.ok(route.endBinding);
  assert.ok(scene.elements.some(item=>item.id===route.endBinding.elementId && item.boundElements.some(other=>other.id===route.id)));
  await assert.rejects(studio.exportDiagram(source,'svg',{loadImage:()=>{throw new Error('Offline');}}),
    /Could not embed background image \/private\/example\.png.*Offline/);
});
