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
  for(const backgroundColor of ['red','url(x)','#abcd','"/><script>']) assert.throws(()=>arch.registerProfile('bad-color',{...schema,id:'bad-color',styleGroups:{group:{backgroundColor}}}),/backgroundColor/);
  assert.throws(()=>arch.registerProfile('bad-group',{nodeTypes:{a:{styleGroup:'missing'}}}),/Stilgruppe/);
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
