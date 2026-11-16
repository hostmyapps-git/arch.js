import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import * as arch from '../src/arch.js';
import { contrast, foreground, composite } from '../src/colors.js';
const load = async path => JSON.parse(await readFile(path, 'utf8'));
const uaf = await load('profiles/uaf.json');
arch.registerProfile('uaf', uaf);
arch.registerProfile('naf4-uaf', await load('profiles/naf4-uaf.json'));

test('all native UAF types use their source package, including cross-domain inheritance and neutral adapters', async () => {
  const config = await load('profiles/uaf/presentation.json');
  const xml = new DOMParser().parseFromString(await readFile('ReferenceDocs/uaf/UAFP-1.0.xmi','utf8'), 'application/xml');
  const ns = 'http://www.omg.org/spec/XMI/20131001'; let count = 0;
  for (const e of xml.getElementsByTagName('*')) if(e.getAttributeNS(ns,'type') === 'uml:Stereotype') {
    const names=[]; for(let p=e.parentNode;p?.getAttribute;p=p.parentNode) if(p.getAttributeNS(ns,'type')==='uml:Package') names.unshift(p.getAttribute('name'));
    assert.equal(uaf.nodeTypes[e.getAttribute('name')].styleGroup, config.types[e.getAttribute('name')] ?? config.packages[names[0]]); count++;
  }
  assert.equal(count,211);
  const profile=arch.getProfile('uaf');
  assert.equal(profile.nodeTypes.SecurityProcess.styleGroup,'neutral');
  for(const type of ['Package','Requirement']) assert.equal(profile.nodeTypes[type].styleGroup,'neutral');
});

test('style groups support profile inheritance, snapshots, direct colors, view overrides and inline configuration', () => {
  const source='architecture "Colors" {model {child c "C"} view v "V" {style c {backgroundColor "#123456"}}}';
  const schema={id:'colors',styleGroups:{group:{backgroundColor:'#00ff00'}},nodeTypes:{base:{styleGroup:'group'},child:{extends:'base',backgroundColor:'#ee82ee'}}};
  arch.registerProfile('colors',schema);
  arch.registerProfile('derived-colors',{extends:'colors',styleGroups:{group:{backgroundColor:'#ffd700'}}});
  assert.equal(arch.getProfile('derived-colors').styleGroups.group.backgroundColor,'#ffd700');
  const plain='architecture "Colors" {model {child c "C"}}';
  const model=arch.parse(plain,{profile:'colors'});
  assert.equal(arch.layout(model).nodes[0].backgroundColor,'#ee82ee');
  assert.equal(arch.layout(arch.parse(source,{profile:schema})).nodes[0].backgroundColor,'#123456');
  schema.nodeTypes.child.backgroundColor='#ffffff';
  assert.equal(arch.layout(JSON.parse(JSON.stringify(model))).nodes[0].backgroundColor,'#ee82ee');
  const inline='architecture "Inline" {config {styleGroup group {backgroundColor "#00FF00"} type item {styleGroup group}} model {item c "C"}}';
  assert.equal(arch.layout(arch.parse(inline)).nodes[0].backgroundColor,'#00FF00');
  for(const backgroundColor of ['notacolor','url(x)','#abcd','"/><script>']) assert.throws(()=>arch.registerProfile('bad-color',{...schema,id:'bad-color',styleGroups:{group:{backgroundColor}}}),/backgroundColor/);
  assert.throws(()=>arch.registerProfile('bad-group',{nodeTypes:{a:{styleGroup:'missing'}}}),/style group/);
  assert.equal(arch.validate(source.replace('#123456','url(x)'),{profile:schema}).valid,false);
});

test('all templates export exact backgrounds and readable foregrounds in either theme; neutral preserves the theme', () => {
  for(const color of ['#00FF00','#EE82EE','#6A5ACD','#FF8C00','#FFD700']) {
    assert.ok(contrast(color,foreground(color))>=4.5);
    for(const template of ['person','system','application','service','component','database','queue','interface','capability','process','artifact','node','package']) {
      const profile={nodeTypes:{item:{template,backgroundColor:color}}};
      for(const theme of ['light','dark']) {
        const svg=arch.renderToString('architecture "A" {model {item x "X" {description "Text"}}}',{profile,theme});
        const visible=composite(color,theme === 'dark' ? '#111827' : '#fafbfe',0.2);
        assert.ok(svg.includes(`fill="${color}" fill-opacity="0.2"`));
        assert.ok(svg.includes(`fill="${foreground(visible)}"`));
        assert.ok(contrast(visible,foreground(visible))>=4.5);
      }
    }
  }
  // Nested translucent containers must contribute to the child's actual backdrop.
  const nestedProfile={nodeTypes:{box:{template:'package',backgroundColor:'#ffffff'},item:{backgroundColor:'#000000'}}};
  for(const theme of ['light','dark']) {
    const svg=arch.renderToString('architecture "Nested" {model {box outer "Outer" {box inner "Inner" {item child "Child"}}}}',{profile:nestedProfile,theme});
    const base=theme==='dark'?'#111827':'#fafbfe';
    const visible=composite('#000000',composite('#ffffff',composite('#ffffff',base,0.2),0.2),0.2);
    const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
    const child=[...doc.getElementsByTagName('g')].find(e=>e.getAttribute('data-node')==='child');
    for(const text of child.getElementsByTagName('text')) assert.ok(contrast(text.getAttribute('fill'),visible)>=4.5);
  }
  const profile={styleGroups:{neutral:{}},nodeTypes:{item:{styleGroup:'neutral'}}};
  for(const [theme,color] of [['light','#ffffff'],['dark','#1e293b']]) assert.ok(arch.renderToString('architecture "A" {model {item x "X"}}',{profile,theme}).includes(`fill="${color}"`));
});

test('all 147 CSS3 names and mixed-case aliases work without a DOM in profiles, inline rules and views', async () => {
  const { CSS3_COLORS }=await import('../src/css3-colors.js');
  const { normalizeColor }=await import('../src/colors.js');
  assert.equal(Object.keys(CSS3_COLORS).length,147);
  for(const [name,hex] of Object.entries(CSS3_COLORS)) {
    assert.equal(normalizeColor(name.toUpperCase()),hex);
    const profile={styleGroups:{g:{backgroundColor:name}},nodeTypes:{item:{template:'package',styleGroup:'g',accent:name.toUpperCase()}}};
    const model=arch.parse('architecture "Named" {model {item x "X"}}',{profile});
    assert.equal(model.profile.styleGroups.g.backgroundColor,hex);
    assert.equal(arch.layout(model).nodes[0].accent,hex);
    for(const theme of ['light','dark']) assert.ok(arch.renderToString(model,{theme}).includes(`fill="${hex}" fill-opacity="0.2"`));
  }
  assert.equal(normalizeColor('darkgrey'),normalizeColor('DarkGray'));
  assert.equal(normalizeColor('magenta'),normalizeColor('fuchsia'));
  const inline='architecture "Colors" {config {styleGroup g {backgroundColor lime} type item {styleGroup g accent slateblue}} model {item x "X"} view v "V" {style x {backgroundColor "DarkOrange" accent "Gold"}}}';
  const graph=arch.layout(arch.parse(inline));
  assert.equal(graph.nodes[0].backgroundColor,'#ff8c00');assert.equal(graph.nodes[0].accent,'#ffd700');
  for(const bad of ['transparent','currentColor','rebeccapurple','rgb(1,2,3)','url(x)','__proto__','constructor','red;stroke:black',null,{},'#ffff']) assert.equal(normalizeColor(bad),undefined);
});

test('heatmap named scale colors produce exactly the same SVG as their hexadecimal equivalents', async()=>{
  const source=await readFile('examples/diagrams.arch','utf8');
  const named=source.replace('parentAttribute parentCapability min 0 max 5','parentAttribute parentCapability min 0 max 5 colorLow Gold colorHigh Lime');
  const hex=named.replace('colorLow Gold colorHigh Lime','colorLow "#ffd700" colorHigh "#00ff00"');
  assert.equal(arch.renderToString(named,{view:'assessment',idPrefix:'colors'}),arch.renderToString(hex,{view:'assessment',idPrefix:'colors'}));
});

test('style opacity accepts 0–1, changes only fills, and preserves readable text over nested translucent packages',async()=>{
  const source='architecture "Opacity" {model {package p "P" {service s "S"}} view v "V" {style p {backgroundColor Gold opacity 0.7} style s {backgroundColor SlateBlue opacity 0}}}';
  for(const theme of ['light','dark']) {
    const svg=arch.renderToString(source,{theme});
    assert.ok(svg.includes('fill="#ffd700" fill-opacity="0.7"'));
    assert.ok(svg.includes('fill="#6a5acd" fill-opacity="0"'));
    const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
    const child=[...doc.getElementsByTagName('g')].find(e=>e.getAttribute('data-node')==='s');
    const backdrop=composite('#ffd700',theme==='dark'?'#111827':'#fafbfe',0.7);
    for(const t of child.getElementsByTagName('text')) {assert.ok(contrast(t.getAttribute('fill'),backdrop)>=4.5);assert.equal(t.hasAttribute('opacity'),false);}
  }
  for(const opacity of ['-0.1','1.1','"0.5"','true']) assert.equal(arch.validate(source.replace('opacity 0.7',`opacity ${opacity}`)).valid,false);
  assert.ok(arch.renderToString(source.replace('opacity 0.7','opacity 1')).includes('fill-opacity="1"'));
  const neutral=source.replace('backgroundColor Gold opacity 0.7','opacity 0.4');assert.ok(arch.renderToString(neutral).includes('fill-opacity="0.4"'));
  const examples=await readFile('examples/diagrams.arch','utf8');
  for(const [view,node] of [['details','mission'],['assessment','rescue'],['delivery','phase1'],['interaction','client']]) {
    const modified=examples.replace(`view ${view} `,`view ${view} `).replace(new RegExp(`(view ${view} [^{]+\\{)`),`$1 style ${node} {opacity 0.7}`);
    assert.ok(arch.renderToString(modified,{view}).includes('fill-opacity="0.7"'),view);
  }
});
