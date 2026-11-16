import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
import { getIcon } from '../src/icons.js';
const fixture={width:20,height:10,icons:{'0':{body:'<path fill="#f00" d="M0 0h5v10H0Z"/>'}},aliases:{turned:{parent:'0',rotate:1},flipped:{parent:'turned',hFlip:true},restored:{parent:'flipped',hFlip:true,rotate:3}}};
const gradient={width:24,height:24,icons:{sample:{body:'<defs><linearGradient id="paint"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><clipPath id="clip"><circle cx="12" cy="12" r="10"/></clipPath></defs><g clip-path="url(#clip)"><rect width="24" height="24" fill="url(#paint)"/></g>'}}};

test('all original Font Awesome, Logos, Bootstrap, Lucide and Tabler packs register and render every icon and alias directly',async()=>{
  const extra=JSON.parse(await readFile('icons/iconify-sources.lock.json','utf8'));
  const existing=JSON.parse(await readFile('icons/sources.lock.json','utf8'));
  for(const source of [...extra.sources,...existing.packs]) {
    const bytes=await readFile(source.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
    const pack=JSON.parse(bytes),snapshot=JSON.stringify(pack),name=`raw-${source.name}`;arch.registerIconPack(name,pack);
    for(const id of [...Object.keys(pack.icons),...Object.keys(pack.aliases??{})])assert.match(arch.renderIconToString(`${name}.${id}`),/^<svg/);
    assert.equal(JSON.stringify(pack),snapshot);
  }
});

test('Iconify numeric names, collection dimensions, alias chains, rotations/flips and nonzero viewBox origins are resolved',()=>{
  arch.registerIconPack('aliases',fixture);
  assert.equal(getIcon('aliases.0').width,20);assert.equal(getIcon('aliases.turned').width,10);assert.equal(getIcon('aliases.turned').height,20);
  assert.equal(getIcon('aliases.restored').width,20);
  arch.registerIconPack('defaults',{...fixture,rotate:1,hFlip:true,icons:{a:{...fixture.icons['0'],rotate:0,hFlip:false},b:fixture.icons['0']},aliases:{}});
  assert.equal(getIcon('defaults.a').width,20);assert.equal(getIcon('defaults.b').width,10);
  assert.match(arch.renderIconToString('aliases.turned'),/matrix\(0 1 -1 0 10 0\)/);
  arch.registerIconPack('offset',{left:-3,top:4,icons:{a:{width:30,height:15,body:'<rect x="-3" y="4" width="30" height="15"/>'}}});
  assert.match(arch.renderIconToString('offset.a'),/translate\(3 -4\)/);
  for(const bad of [{aliases:{a:{parent:'a'}}},{aliases:{a:{parent:'missing'}}},{aliases:{a:{parent:'0',rotate:0.5}}},{aliases:{a:{parent:'0',hFlip:'true'}}}])assert.throws(()=>arch.registerIconPack('bad',{...fixture,...bad}),arch.ArchError);
});

test('gradient/mask references receive unique per-instance IDs and deterministic explicitly prefixed SVG',()=>{
  arch.registerIconPack('gradient',gradient);
  const source='architecture "G" {model {service a "A" {icon gradient.sample} service b "B" {icon gradient.sample}}}';
  const svg=arch.renderToString(source,{idPrefix:'graph'});
  assert.match(svg, /<svg width="24" height="24" viewBox="0 0 24 24"/);
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const ref of svg.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(ref[1]),ref[1]);
  assert.equal(arch.renderIconToString('gradient.sample',{idPrefix:'stable'}),arch.renderIconToString('gradient.sample',{idPrefix:'stable'}));
  assert.notEqual(arch.renderIconToString('gradient.sample'),arch.renderIconToString('gradient.sample'));
});

test('Iconify paint and shapes support colors, gradients, lines, polygons and inline presentation styles',()=>{
  arch.registerIconPack('shapes',{icons:{a:{body:'<g fill="black" style="fill:Gold;stroke:rgb(20, 30, 40)"><polygon points="0,0 16,0 8,16"/><polyline points="0,0 16,16"/><line x1="0" x2="16"/><circle r="2"/><ellipse rx="3" ry="2"/><rect width="2" height="4" transform="translate(2 3) scale(2) rotate(20)"/></g>'}}});
  const svg=arch.renderIconToString('shapes.a');assert.match(svg,/fill="#ffd700"/);assert.match(svg,/stroke="rgb\(20, 30, 40\)"/);assert.match(svg,/<polygon/);
  arch.registerIconPack('fixed',{icons:{a:{paths:[{d:'M0 0h10v10Z',fill:'DarkOrange',stroke:'none'}]}}});assert.match(arch.renderIconToString('fixed.a'),/fill="#ff8c00"/);
});

test('enable-background exports register as SVG attributes and inline styles without losing valid values',async()=>{
  for(const [index,value] of ['new','accumulate','inherit','new 0 0 24 24',' new -2 -3 0 12 ','new 0,0,24,24','new 0 0 2.4e1 24','new 0\t0\n24 24'].entries()) {
    const pack={icons:{sample:{body:`<svg viewBox="0 0 24 24" enable-background="${value}"><g style="enable-background: ${value};fill:Gold"><path d="M0 0h24v24H0Z"/></g></svg>`}}};
    const before=JSON.stringify(pack),name=`background-${index}`;arch.registerIconPack(name,pack);
    const svg=arch.renderIconToString(`${name}.sample`,{idPrefix:'background'});
    assert.equal((svg.match(/enable-background=/g)??[]).length,2);
    assert.match(svg,/fill="#ffd700"/);assert.equal(JSON.stringify(pack),before);
  }
  arch.registerIconPack('background-override',{icons:{sample:{body:'<svg enable-background="new 0 0 24 24" style="enable-background:accumulate"><path d="M0 0h24v24H0Z"/></svg>'}}});
  const svg=arch.renderIconToString('background-override.sample');
  assert.match(svg,/enable-background="accumulate"/);assert.doesNotMatch(svg,/enable-background="new/);
  const pack={icons:{sample:{body:'<svg viewBox="0 0 24 24" enable-background="new 0 0 24 24"><g style="enable-background:accumulate;fill:Gold"><path d="M0 0h24v24H0Z"/></g></svg>'}}};
  arch.registerIconPack('background-bundle',pack);const expected=arch.renderIconToString('background-bundle.sample',{idPrefix:'same'});
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);context.arch.registerIconPack('background-bundle',pack);
    assert.equal(context.arch.renderIconToString('background-bundle.sample',{idPrefix:'same'}),expected);
  }
});

test('invalid enable-background values fail atomically and do not permit unrelated SVG attributes/styles',()=>{
  arch.registerIconPack('background-safe',gradient);const before=arch.renderIconToString('background-safe.sample',{idPrefix:'same'});
  for(const value of ['url(https://example.com/x)','new 0 0 -1 24','new 0 0 24 -1','new 0 0 24','new 0 0 NaN 24','new 0 0 1e309 24','new 0 0 24px 24','new 0 0 24% 24','accumulate new','new 0 0 24 24 extra']) {
    for(const body of [`<svg enable-background="${value}"/>`,`<g style="enable-background:${value}"/>`]) {
      assert.throws(()=>arch.registerIconPack('background-safe',{icons:{sample:{body}}}),arch.ArchError,value);
      assert.equal(arch.renderIconToString('background-safe.sample',{idPrefix:'same'}),before);
    }
  }
  for(const body of ['<g enable-background="new" onload="alert(1)"/>','<g style="enable-background:new;background:url(https://example.com/x)"/>'])
    assert.throws(()=>arch.registerIconPack('background-safe',{icons:{sample:{body}}}),arch.ArchError);
});

test('unsafe/external SVG, reference cycles, malformed XML, excessive expansion and invalid dimensions fail atomically',()=>{
  arch.registerIconPack('safe',gradient);const before=arch.renderIconToString('safe.sample',{idPrefix:'test'});
  const bad=['<script>alert(1)</script>','<path d="M0 0" onload="x"/>','<image href="data:x"/>','<foreignObject/>','<animate/>',
    '<use href="https://example.com/a.svg#x"/>','<rect fill="url(https://evil)"/>','<g style="background:url(x)"/>',
    '<g id="a"><use href="#a"/></g>','<defs><linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/></defs>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><path/>','<g><path></g>',
    '<g id="same"/><g id="same"/>','<path d="M0 0" transform="translate(NaN)"/>','<style>path{fill:red}</style>',
    '<defs><filter id="f"><feImage href="https://evil"/></filter></defs>'];
  for(const body of bad){assert.throws(()=>arch.registerIconPack('safe',{icons:{good:{body:'<path d="M0 0"/>'},bad:{body}}}),arch.ArchError,body);assert.equal(arch.renderIconToString('safe.sample',{idPrefix:'test'}),before);}
  for(const width of [0,-1,'24',Infinity])assert.throws(()=>arch.registerIconPack('bad',{width,icons:{a:{body:'<path d="M0 0"/>'}}}));
  const expand='<defs><g id="a"><path d="M0 0"/></g>'+Array.from({length:20},(_,i)=>`<g id="g${i}"><use href="#${i?'g'+(i-1):'a'}"/><use href="#${i?'g'+(i-1):'a'}"/></g>`).join('')+'</defs><use href="#g19"/>';
  assert.throws(()=>arch.registerIconPack('bomb',{icons:{a:{body:expand}}}),/limit/);
});

test('original SVG input is copied/frozen and prototype-like icon IDs remain ordinary data',()=>{
  const pack={icons:Object.fromEntries([['__proto__',{body:'<path d="M0 0h10"/>'}],['constructor',{body:'<path d="M0 0v10"/>'}]])};
  arch.registerIconPack('proto',pack);pack.icons.__proto__.body='<script/>';assert.match(arch.renderIconToString('proto.__proto__'),/<path/);assert.match(arch.renderIconToString('proto.constructor'),/<path/);
  const icon=getIcon('proto.__proto__');assert.equal(Object.isFrozen(icon.tree),true);assert.throws(()=>{icon.tree.children[0].attrs.d='bad';},TypeError);
});

test('both self-contained browser bundles register original Iconify JSON without browser DOM globals',async()=>{
  arch.registerIconPack('fixture',gradient);const expected=arch.renderIconToString('fixture.sample',{idPrefix:'fixed'});
  for(const file of ['arch.js','arch.min.js']){const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);context.arch.registerIconPack('fixture',gradient);assert.equal(context.arch.renderIconToString('fixture.sample',{idPrefix:'fixed'}),expected);}
});

test('full editor SVG exports infer dimensions, remove only inert standard headers and preserve px/style presentation',()=>{
  const body='<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg width="100%" height="100%" viewBox="0 0 204 100" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:serif="http://www.serif.com/" xml:space="preserve" style="fill-rule:evenodd;stroke-linejoin:round"><path d="M0 0h100v80Z" style="fill:currentcolor;stroke:rgb(77,77,77);stroke-width:12px"/></svg>';
  arch.registerIconPack('full-svg',{icons:{sample:{body}}});
  assert.equal(getIcon('full-svg.sample').width,204);assert.equal(getIcon('full-svg.sample').height,100);
  arch.registerIconPack('absolute-svg',{icons:{sample:{body:'<svg width="200px" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'}}});
  assert.equal(getIcon('absolute-svg.sample').width,200);assert.equal(getIcon('absolute-svg.sample').height,100);
  const svg=arch.renderIconToString('full-svg.sample');assert.match(svg,/viewBox="0 0 204 100"/);assert.match(svg,/stroke-width="12px"/);assert.ok(!svg.includes('DOCTYPE'));assert.ok(!svg.includes('<?xml'));assert.ok(!svg.includes('serif.com'));
  for(const evil of ['<!DOCTYPE svg SYSTEM "https://evil/svg.dtd"><svg/>','<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>','<?xml-stylesheet href="https://evil"?><svg/>'])assert.throws(()=>arch.registerIconPack('bad-full',{icons:{x:{body:evil}}}));
  arch.registerIconPack('quoted',{icons:{x:{body:'<defs><linearGradient id="g"><stop stop-color="Gold"/></linearGradient></defs><rect width="10" height="10" fill="url(&quot;#g&quot;)"/>'}}});assert.match(arch.renderIconToString('quoted.x'),/fill="url\(#arch-icon-/);
});

test('every supplied reference iconpack registers and renders all original icons and aliases unchanged',async(t)=>{
  const lock=JSON.parse(await readFile('icons/reference-iconpacks.lock.json','utf8'));
  for(const source of lock.sources) {
    let bytes;try{bytes=await readFile(source.file);}catch(error){if(error.code==='ENOENT'){t.diagnostic(`Reference file not present: ${source.file}`);continue;}throw error;}
    assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
    const pack=JSON.parse(bytes),snapshot=JSON.stringify(pack),name=`reference-${source.name}`;arch.registerIconPack(name,pack);
    for(const id of [...Object.keys(pack.icons),...Object.keys(pack.aliases??{})])assert.match(arch.renderIconToString(`${name}.${id}`),/^<svg/);
    assert.equal(JSON.stringify(pack),snapshot);
  }
});
