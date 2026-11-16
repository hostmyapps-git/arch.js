import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { cases as naf41Cases, document as naf41Document } from './fixtures/naf41/cases.mjs';

await mkdir('test-results', { recursive: true });
const child = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  const address = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server startup timed out')), 10_000);
    child.on('error', reject); child.on('exit', code => { clearTimeout(timer); reject(new Error(`Test server exited: ${code}`)); });
    child.stderr.on('data', data => process.stderr.write(data));
    child.stdout.on('data', data => {
      const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1050 }, deviceScaleFactor: 1 });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(address); await page.waitForSelector('#diagram svg');
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#diagram [data-node]').count(), 8);
  const namedColors=JSON.parse(await readFile('src/css3-colors.js','utf8').then(s=>s.slice(s.indexOf('{'),s.lastIndexOf('}')+1)));
  const mismatches=await page.evaluate(colors=>{
    const ctx=document.createElement('canvas').getContext('2d');
    return Object.entries(colors).filter(([name,hex])=>{ctx.fillStyle='#123456';ctx.fillStyle=name.toUpperCase();return ctx.fillStyle!==hex;});
  },namedColors);
  assert.deepEqual(mismatches,[],'All CSS3 names agree with Chromium');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  console.log('✓ Desktop launch, local resources and initial SVG');

  await page.locator('[data-example="help"]').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#diagram [data-arch-help="overview"]').count(), 1);
  assert.equal(await page.locator('#view-select').inputValue(), 'help');
  await page.screenshot({ path: 'test-results/help.png', fullPage: true });
  const helpChecks = await page.evaluate(() => {
    const issues = [], host = document.createElement('div'); document.body.append(host);
    const queries = ['', 'syntax', 'model', 'profiles', 'types uaf Capability', 'types uaf OperationalAgent', 'relations uaf Implements', 'connections uaf OperationalPerformer', 'viewpoints naf4-uaf C1', 'profiles naf41-uaf', 'viewpoints naf41-uaf C7', 'types naf41-uaf Needline', 'connections naf41-uaf OperationalPerformer', 'iconpacks lucide cloud', 'iconpacks tabler "*" 2', 'diagrams', 'views', 'routing', 'styles', 'colors', 'templates', 'config', 'api'];
    arch.registerProfile('wide_help', { title: '界'.repeat(300), nodeTypes: { ['Long'.repeat(80)]: { attributes: { note: { enum: ['🙂界'.repeat(200)] } } } } });
    queries.push('profiles wide_help', 'types wide_help ' + 'Long'.repeat(80));
    for (const query of queries) for (const theme of ['light', 'dark']) {
      const svg = arch.render(host, '@help ' + query, { theme });
      if (new DOMParser().parseFromString(svg.outerHTML, 'image/svg+xml').querySelector('parsererror')) issues.push(`Invalid SVG: ${query}`);
      const bounds = svg.viewBox.baseVal;
      for (const text of svg.querySelectorAll('text')) {
        const b = text.getBBox();
        if (b.x < 0 || b.y < 0 || b.x + b.width > bounds.width || b.y + b.height > bounds.height) issues.push(`Help text clipped: ${query}: ${text.textContent}`);
      }
      if (query === 'types uaf Capability') {
        const indented = [...svg.querySelectorAll('text')].find(t => t.textContent.startsWith('  "template"'));
        if (!indented || indented.getStartPositionOfChar(2).x - indented.getStartPositionOfChar(0).x < 10) issues.push('Help JSON indentation collapsed');
      }
    }
    const architecture = 'architecture "Following block" { model { service a "A" } }';
    host.replaceChildren();
    for (const source of ['architecture "Test"{\n @help profiles\n model {}\n}', '@help unknown', architecture]) {
      const pre = document.createElement('pre'), code = document.createElement('code'); code.className = 'language-arch'; code.textContent = source; pre.append(code); host.append(pre);
    }
    if (arch.renderAll({ root: host }).length !== 2 || host.querySelectorAll('svg').length !== 2 || host.querySelectorAll('.arch-error').length !== 1) issues.push('Help block error isolation');
    if (arch.renderAll({ root: host }).length !== 0) issues.push('Help block idempotence');
    host.innerHTML = arch.renderMarkdown('```arch\n@help profiles\n```\n\n```arch\n' + architecture + '\n```');
    if (host.querySelectorAll('svg').length !== 2) issues.push('Help Markdown adapter');
    host.remove(); return issues;
  });
  assert.deepEqual(helpChecks, [], 'Help topics, both themes, wide text, adapters and block error isolation');
  await page.locator('#source').fill('@help types uaf Capability');
  await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  await page.locator('#toggle-theme').click();
  assert.equal(await page.locator('#diagram svg').getAttribute('data-arch-svg'), 'dark');
  await page.screenshot({ path: 'test-results/help-profile-dark.png', fullPage: true });
  const helpDownload = page.waitForEvent('download'); await page.locator('#export-svg').click();
  await (await helpDownload).saveAs('test-results/help.svg');
  assert.match(await readFile('test-results/help.svg', 'utf8'), /data-arch-help="types"/);
  await page.locator('#source').fill('@help unknown'); await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), true);
  await page.locator('#source').fill('@help iconpacks lucide cloud'); await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  const helpPreview = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await helpPreview.setContent(await page.locator('#diagram svg').evaluate(svg => svg.outerHTML));
  await helpPreview.locator('svg').screenshot({ path: 'test-results/help-icons.png' });
  await helpPreview.close();
  console.log('✓ Built-in help, registered types/icons, SVG export, themes, bounds and error recovery');
  await page.locator('#source').fill('architecture "Test"{\n    @help profiles\n    model {}\n}');
  await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#diagram [data-arch-help="profiles"]').count(), 1);
  const fighter = 'architecture "Fighter" { config { profile uaf } model { OperationalAgent r "fighter" } }';
  await page.locator('#source').fill(fighter); await page.locator('#render-button').click();
  assert.match(await page.locator('#error').innerText(), /Concrete subtypes: KnownResource, OperationalArchitecture, OperationalMitigation, OperationalPerformer/);
  await page.locator('#source').fill('architecture "Fighter" { config { profile uaf }\n @help types . OperationalAgent\n }');
  await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.ok((await page.locator('#diagram').innerText()).includes('OperationalPerformer ID "Title"'));
  await page.screenshot({path:'test-results/help-candidates.png',fullPage:true});
  await page.locator('#source').fill(fighter.replace('OperationalAgent r','OperationalPerformer r'));
  await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#diagram [data-node="r"]').count(), 1);
  await page.locator('#source').fill('architecture "Relations" { config { profile uaf }\n @help connections . OperationalPerformer\n }');
  await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  const relationHelp = await page.locator('#diagram').innerText();
  assert.ok(relationHelp.includes('Outgoing relationships'));
  assert.ok(relationHelp.includes('Incoming relationships'));
  assert.ok(relationHelp.includes('IsCapableToPerform: OperationalPerformer -> OperationalActivity'));
  await page.screenshot({path:'test-results/help-connections.png',fullPage:true});
  // Restore the help draft before later example-switching/mobile checks.
  await page.locator('#source').fill('@help'); await page.locator('#render-button').click();

  const overflow = [];
  for (const id of ['platform', 'manual', 'capabilities', 'iconpacks', 'profiles', 'external-profile', 'uaf', 'minimal']) {
    await page.locator(`[data-example="${id}"]`).click();
    const views = await page.locator('#view-select option').evaluateAll(options => options.map(o => o.value).filter(id=>id!=='@meta'));
    for (const view of views) {
      await page.selectOption('#view-select', view);
      assert.equal(await page.locator('#error').isVisible(), false, `${id}/${view}`);
      const result = await page.evaluate(() => {
        const model = arch.parse(document.querySelector('#source').value);
        const graph = arch.layout(model, { view: document.querySelector('#view-select').value });
        const issues = [];
        for (const node of graph.nodes) {
          const group = [...document.querySelectorAll('#diagram [data-node]')].find(g => g.dataset.node === node.id);
          for (const text of group.querySelectorAll(':scope > text')) {
            const b = text.getBBox();
            if (b.width && (b.x < -1 || b.y < -1 || b.x + b.width > node.width + 1 || b.y + b.height > node.height + 1))
              issues.push(`${node.id}: ${text.textContent} overflows ${JSON.stringify({ x:b.x, y:b.y, width:b.width, height:b.height, cardWidth:node.width, cardHeight:node.height })}`);
          }
        }
        const viewBox = document.querySelector('#diagram svg').viewBox.baseVal;
        for (const path of document.querySelectorAll('#diagram .arch-edge > path')) {
          const b = path.getBBox();
          if (b.x < viewBox.x || b.y < viewBox.y || b.x + b.width > viewBox.x + viewBox.width || b.y + b.height > viewBox.y + viewBox.height)
            issues.push('Edge clipped by viewBox');
          path.getTotalLength();
        }
        return issues;
      });
      overflow.push(...result.map(issue => `${id}/${view}: ${issue}`));
    }
  }
  assert.deepEqual(overflow, [], 'SVG labels and paths fit their bounds');
  console.log('✓ All examples and all views; SVG text and edge bounds');
  await page.locator('[data-example="minimal"]').click();
  await page.selectOption('#view-select', 'public');
  assert.equal(await page.locator('#diagram [data-node="data"]').count(), 0);
  assert.equal(await page.locator('#diagram [data-node]').count(), 2);
  assert.equal(await page.locator('#diagram [data-node="app"] > g[filter] > rect').getAttribute('fill-opacity'),'0.55');
  assert.equal(await page.locator('#diagram [data-node="app"] > g[filter] > rect').getAttribute('fill'),'#f0f8ff');
  assert.equal(await page.locator('#diagram [data-edge="reads"]').count(), 0);
  await page.selectOption('#view-select', 'default');
  assert.equal(await page.locator('#diagram [data-node="data"]').count(), 1);
  await page.locator('[data-example="diagrams"]').click();
  const diagramViews=await page.locator('#view-select option').evaluateAll(options=>options.map(o=>o.value).filter(id=>id!=='@meta'));
  assert.equal(diagramViews.length,7);
  for(const view of diagramViews) {
    await page.selectOption('#view-select',view);
    for(const dark of [false,true]) {
      if(dark) await page.locator('#toggle-theme').click();
      assert.equal(await page.locator('#error').isVisible(),false,view);
      assert.ok(await page.locator('#diagram svg').getAttribute('data-diagram'));
      const clipped=await page.evaluate(()=>{
        const svg=document.querySelector('#diagram svg'),b=svg.getBoundingClientRect();
        return [...svg.querySelectorAll('text,rect,path,circle')].filter(e=>!e.closest('defs')).flatMap(e=>{
          const r=e.getBoundingClientRect();return r.width&&(r.left<b.left-2||r.top<b.top-2||r.right>b.right+2||r.bottom>b.bottom+2)?[e.tagName+': '+e.textContent.slice(0,60)]:[];
        });
      });
      assert.deepEqual(clipped,[],view);
      await page.screenshot({path:`test-results/diagram-${view}-${dark?'dark':'light'}.png`,fullPage:true});
    }
    await page.locator('#toggle-theme').click();
  }
  const diagramsSource=await page.locator('#source').inputValue();
  await page.locator('#source').fill(diagramsSource.replace('messages [request, save, ack, audit, response]','messages [missing]'));
  await page.waitForSelector('#error:not([hidden])');
  await page.locator('#source').fill(diagramsSource);await page.locator('#render-button').click();
  await page.waitForSelector('#error[hidden]',{state:'attached'});
  const diagramDownload=page.waitForEvent('download');
  await page.locator('#export-svg').click();
  const artifact=await diagramDownload;await artifact.saveAs('test-results/diagram-export.svg');
  assert.match(await readFile('test-results/diagram-export.svg','utf8'),/data-diagram="class"/);
  console.log('✓ Seven specialist renderers, both themes, unclipped SVG and live validation');


  await page.locator('[data-example="profiles"]').click();
  assert.match(await page.locator('#profile-info').innerText(), /workshop/);
  const profileSource = await page.locator('#source').inputValue();
  assert.equal(await page.locator('#diagram [data-type="product"]').count(), 1);
  await page.screenshot({ path: 'test-results/profiles.png', fullPage: true });
  await page.locator('#source').fill(profileSource.replace('owner "Commerce team"', ''));
  await page.waitForSelector('#error:not([hidden])');
  assert.match(await page.locator('#error').innerText(), /Missing required attribute owner/);
  assert.equal(await page.locator('#export-svg').isDisabled(), true);
  await page.locator('#source').fill(profileSource);
  await page.locator('#render-button').click();
  await page.waitForSelector('#error[hidden]', { state: 'attached' });
  await page.selectOption('#profile-select', 'enterprise-demo');
  assert.match(await page.locator('#profile-info').innerText(), /enterprise-demo/);
  assert.equal(await page.locator('#error').isVisible(), false);
  await page.selectOption('#profile-select', 'default');
  assert.equal(await page.locator('#error').isVisible(), true);
  assert.match(await page.locator('#error').innerText(), /Unknown element type/);
  await page.selectOption('#profile-select', '');
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.match(await page.locator('#profile-info').innerText(), /workshop/);
  await page.locator('[data-example="external-profile"]').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.match(await page.locator('#profile-info').innerText(), /enterprise-demo/);
  const profileAdapters = await page.evaluate(() => {
    const source = `architecture "API profile" { model { actor a "A" { owner "Team" } } }`;
    const schema = { nodeTypes: { actor: { template: 'person', attributes: { owner: { required: true } } } } };
    const target = document.createElement('div'); document.body.append(target);
    arch.render(target, source, { profile: schema });
    const rendered = target.querySelector('[data-type="actor"]').getAttribute('data-template');
    const block = document.createElement('div'); block.dataset.arch = ''; block.textContent = source; target.replaceChildren(block);
    const all = arch.renderAll({ root: target, profile: schema }).length;
    const markdown = arch.renderMarkdown('```arch\n' + source + '\n```', { profile: schema }).includes('data-type="actor"');
    const report = arch.validate(source.replace('owner "Team"', ''), { profile: schema });
    target.remove(); return { rendered, all, markdown, valid: report.valid, attribute: report.diagnostics[0].attribute };
  });
  assert.deepEqual(profileAdapters, { rendered: 'person', all: 1, markdown: true, valid: false, attribute: 'owner' });
  console.log('✓ Inline and JSON profiles, runtime validation, API override, recovery and all rendering adapters');

  await page.locator('[data-example="uaf"]').click();
  assert.match(await page.locator('#profile-info').innerText(), /naf4-uaf/);
  assert.equal(await page.locator('#diagram [data-type="ServiceSpecification"]').count(), 1);
  await page.screenshot({ path: 'test-results/uaf.png', fullPage: true });
  await page.selectOption('#view-select', 'capabilities');
  assert.equal(await page.locator('#diagram [data-type="Capability"]').count(), 2);
  assert.equal(await page.locator('#diagram [data-style="generalization"]').count(), 1);
  await page.selectOption('#view-select', 'colors');
  for (const dark of [false, true]) {
    if (dark) await page.locator('#toggle-theme').click();
    const fills = await page.locator('#diagram [data-node]').evaluateAll(nodes => nodes.map(node => [node.dataset.type, node.querySelector('g[filter] > :first-child').getAttribute('fill')]));
    assert.deepEqual(Object.fromEntries(fills), {Capability:'#00ff00',ServiceSpecification:'#ee82ee',OperationalActivity:'#6a5acd',Software:'#ff8c00',Standard:'#ffd700',Requirement:dark?'#1e293b':'#ffffff'});
    assert.deepEqual(await page.locator('#diagram [data-node]').evaluateAll(nodes => nodes.map(node => node.querySelector('g[filter] > :first-child').getAttribute('fill-opacity'))), ['0.2','0.2','0.2','0.2','0.2',null]);
    await page.screenshot({path: `test-results/uaf-colors-${dark?'dark':'light'}.png`,fullPage:true});
  }
  await page.locator('#toggle-theme').click();
  await page.selectOption('#view-select', 'traceability');
  await page.screenshot({ path: 'test-results/uaf-traceability.png', fullPage: true });
  const uafSource = await page.locator('#source').inputValue();
  await page.locator('#source').fill(uafSource.replace('dispatchFunction -> dispatch', 'dispatchFunction -> maritime'));
  await page.waitForSelector('#error:not([hidden])');
  assert.match(await page.locator('#error').innerText(), /Type combination Function → Capability/);
  await page.locator('#source').fill(uafSource); await page.locator('#render-button').click();
  await page.waitForSelector('#error[hidden]', {state:'attached'});
  console.log('✓ UAF/NAF profile, taxonomy, cross-domain realization constraints and live error recovery');

  const naf41Documents = Object.keys(naf41Cases).map(id => [id, naf41Document(id)]);
  const naf41Issues = await page.evaluate(documents => {
    const issues = [], host = document.createElement('div'); document.body.append(host);
    for (const [id, source] of documents) for (const theme of ['light','dark']) {
      try {
        const svg = arch.render(host, source, { theme });
        if (new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelector('parsererror')) issues.push(`${id}/${theme}: malformed SVG`);
      } catch (err) { issues.push(`${id}/${theme}: ${err.message}`); }
    }
    host.remove(); return issues;
  }, naf41Documents);
  assert.deepEqual(naf41Issues, []);
  const referenceIssues=await page.evaluate(()=>{
    arch.registerProfile('reference-visual',{nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{items:{type:'reference',targets:['item'],many:true}},referenceLabels:{items:'Carries'},referenceDisplay:'nodes'}}});
    const issues=[],host=document.createElement('div');document.body.append(host);
    const paths=['M 220 48 L 500 48','M 220 48 C 300 -100 420 -100 500 48','M 220 48 A 180 100 30 0 1 500 48','M 220 48 Q 320 -120 500 48'];
    for(const [index,path] of paths.entries())for(const count of [1,3]) {
      const source=`architecture "Attachments" {config {profile reference-visual} model {actor a "Source" actor b "Target" item i "Report" item j "Report" item k "Third report" relation exchange a -> b "Sends" {type flow items ${count===1?'[i]':'[i,j,k]'}}} view v "V" {place b at (500,0) route exchange {path "${path}"}}}`;
      const model=arch.parse(source),graph=arch.layout(model),svg=arch.render(host,model);
      const flow=svg.querySelector('[data-edge="exchange"] > path'),length=flow.getTotalLength(),bounds=svg.viewBox.baseVal;
      graph.referenceNodes.forEach((reference,i)=>{
        const actual=flow.getPointAtLength(length*(i+1)/(graph.referenceNodes.length+1));
        if(Math.hypot(actual.x-reference.anchor.x,actual.y-reference.anchor.y)>1.2)issues.push(`Attachment misses actual path: ${index}/${count}/${i}`);
      });
      for(const element of svg.querySelectorAll('.arch-edge-reference,.arch-reference-connector')) {
        const b=element.getBBox();
        if(b.x<bounds.x||b.y<bounds.y||b.x+b.width>bounds.x+bounds.width||b.y+b.height>bounds.y+bounds.height)issues.push(`Clipped reference: ${index}/${count}`);
      }
    }
    host.remove();return issues;
  });
  assert.deepEqual(referenceIssues,[]);
  await page.locator('[data-example="naf41"]').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.match(await page.locator('#profile-info').innerText(), /naf41-uaf/);
  assert.equal(await page.locator('#view-select option:not([value="@meta"])').count(), 9);
  for (const view of ['criteria','taxonomy','structure','interactions','activities','functions','physical','trace','roadmap']) {
    await page.selectOption('#view-select', view);
    assert.equal(await page.locator('#error').isVisible(), false, `naf41/${view}`);
    if (view === 'structure') {
      const detail = await page.locator('#diagram [data-node="coordinationNeed"]').textContent();
      assert.ok(detail.includes('source: commandNode'));
      assert.ok(detail.includes('target: rescueNode'));
      assert.ok(detail.includes('conveyed: [distress]'));
    }
    if (['criteria','structure','physical'].includes(view)) await page.screenshot({ path: `test-results/naf41-${view}.png`, fullPage: true });
  }
  await page.selectOption('#view-select','criteria');
  const naf41Source = await page.locator('#source').inputValue();
  await page.locator('#source').fill(naf41Source.replace('response -> maritime','maritime -> response'));
  await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), true);
  assert.match(await page.locator('#error').innerText(), /CharacterizesCapability/);
  await page.locator('#source').fill(naf41Source); await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  const userL3 = await readFile('tests/fixtures/naf41/user-l3.arch','utf8');
  await page.locator('#source').fill(userL3); await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  const payloadLabel = await page.locator('#diagram [data-label-for="control"]').textContent();
  assert.ok(payloadLabel.includes('controlls'));
  assert.equal(await page.locator('#diagram .arch-edge-reference[data-reference-for="control"][data-reference-node="i"]').count(),1);
  assert.ok((await page.locator('#diagram .arch-edge-reference[data-reference-for="control"]').textContent()).includes('Controll'));
  assert.equal(await page.locator('#diagram .arch-reference-connector[data-reference-for="control"]').count(),1);
  await page.screenshot({ path: 'test-results/naf41-user-l3.png', fullPage: true });
  await page.locator('#toggle-theme').click();
  assert.ok((await page.locator('#diagram .arch-edge-reference[data-reference-for="control"]').textContent()).includes('Controll'));
  await page.locator('#toggle-theme').click();
  const logoL3=await readFile('examples/naf41-logos.arch','utf8');
  await page.locator('#source').fill(logoL3);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram [data-display="logo"]').count(),2);
  assert.equal(await page.locator('#diagram [data-display="logo"] text').count(),0);
  const logoIssues=await page.locator('#diagram [data-display="logo"]').evaluateAll(nodes=>nodes.flatMap(node=>{
    const rect=node.querySelector('rect'),icon=node.querySelector('[data-icon]'),a=rect.getBoundingClientRect(),b=icon.getBoundingClientRect();
    return b.left<a.left||b.top<a.top||b.right>a.right||b.bottom>a.bottom?['Logo outside rectangle']:[];
  }));
  assert.deepEqual(logoIssues,[]);
  await page.screenshot({path:'test-results/naf41-user-logos.png',fullPage:true});
  await page.locator('#source').fill(await readFile('examples/naf41-clusters.arch','utf8'));await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram .arch-package').count(),2);
  const styledBadge=page.locator('#diagram [data-node="f1"] [data-node-badge]');
  assert.equal(await styledBadge.locator('tspan').count(),1);
  assert.ok((await styledBadge.locator('tspan').textContent()).endsWith('…'));
  assert.equal(await styledBadge.locator('title').textContent(),'OperationalPerformerWithAnExceptionallyLongStereotype');
  await page.screenshot({path:'test-results/naf41-node-styles.png',fullPage:true});
  await page.locator('#source').fill(await readFile('examples/naf41-walker-transfer.arch','utf8'));await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram .arch-package').count(),2);
  assert.equal(await page.locator('#diagram .arch-edge').count(),2);
  assert.equal(await page.locator('#diagram .arch-edge-reference[data-reference-node="data"]').count(),1);
  assert.equal(await page.locator('#diagram .arch-reference-connector[data-reference-node="data"]').count(),2);
  assert.equal(await page.locator('#diagram [data-node="walker"]').count(),1);
  await page.screenshot({path:'test-results/naf41-walker-transfer.png',fullPage:true});
  const repeatedWalker=(await readFile('examples/naf41-walker-transfer.arch','utf8')).replace('referenceDisplay nodes','referenceDisplay nodes\n    referenceOccurrences perEdge');
  await page.locator('#source').fill(repeatedWalker);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram .arch-edge-reference[data-reference-node="data"]').count(),2);
  assert.deepEqual(await page.locator('#diagram [data-reference-id="data"]').allTextContents(),['ID: data','ID: data']);
  const identityIssues=await page.locator('#diagram [data-reference-id="data"]').evaluateAll(groups=>groups.flatMap(group=>{
    const box=group.querySelector('rect').getBoundingClientRect(),text=group.querySelector('text').getBoundingClientRect();
    return text.left<box.left||text.top<box.top||text.right>box.right||text.bottom>box.bottom?['Identity outside footer']:[];
  }));
  assert.deepEqual(identityIssues,[]);
  await page.screenshot({path:'test-results/naf41-walker-transfer-repeated.png',fullPage:true});
  const darkRepeated=await page.evaluate(source=>arch.renderToString(source,{theme:'dark'}),repeatedWalker);
  assert.equal((darkRepeated.match(/data-reference-id="data"/g)||[]).length,2);
  const routedWalker=await readFile('examples/naf41-walker-routing.arch','utf8');
  await page.locator('#source').fill(routedWalker);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram .arch-reference-connector').count(),2);
  const defaultRoutes=await page.evaluate(source=>{
    const graph=arch.layout(arch.parse(source));
    return {
      straightEdges:graph.edges.every(edge=>edge.points.length===2),
      roundedPickup:graph.referenceNodes.find(r=>r.edgeId==='pickup').d.includes(' Q '),
      straightDelivery:!graph.referenceNodes.find(r=>r.edgeId==='delivery').d.includes(' Q ')
    };
  },routedWalker);
  assert.deepEqual(defaultRoutes,{straightEdges:true,roundedPickup:true,straightDelivery:true});
  const routingIssues=await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    const paths=['M 320 132 L 470 132','M 320 132 C 350 -150 430 -150 470 132','M 320 132 Q 400 -150 470 132','M 320 132 A 130 100 30 0 1 470 132'];
    for(const [index,path] of paths.entries())for(const fraction of [0,0.3,0.75,1])for(const theme of ['light','dark']) {
      const text=source.replace('viewpoint L3',`viewpoint L3 route pickup {path "${path}"}`).replace('to 0.5',`to ${fraction}`);
      const svg=arch.render(host,text,{theme}),graph=arch.layout(arch.parse(text));
      const flow=svg.querySelector('[data-edge="pickup"] > path'),attachment=svg.querySelector('.arch-reference-connector[data-reference-for="pickup"]');
      const expected=flow.getPointAtLength(flow.getTotalLength()*fraction),actual=attachment.getPointAtLength(attachment.getTotalLength());
      if(Math.hypot(expected.x-actual.x,expected.y-actual.y)>1.2)issues.push(`Manual anchor misses path: ${index}/${fraction}/${theme}`);
      if(attachment.getAttribute('d')!==graph.referenceNodes.find(r=>r.edgeId==='pickup').d)issues.push('Manual connector path changed during SVG export');
      const bounds=svg.viewBox.baseVal;
      for(const connector of svg.querySelectorAll('.arch-reference-connector')) {
        const b=connector.getBBox();
        if(b.x<bounds.x||b.y<bounds.y||b.x+b.width>bounds.x+bounds.width||b.y+b.height>bounds.y+bounds.height)issues.push('Clipped manually routed connector');
      }
    }
    host.remove();return issues;
  },routedWalker);
  assert.deepEqual(routingIssues,[]);
  await page.screenshot({path:'test-results/naf41-walker-routing.png',fullPage:true});
  await page.locator('#source').fill(naf41Source); await page.locator('#render-button').click();
  console.log('✓ NAFv4.1: 47 scenarios in both themes, nine editable views, help and live error recovery');

  assert.deepEqual(await page.evaluate(() => arch.getIconPacks()), ['core', 'bootstrap', 'lucide', 'tabler']);
  assert.equal(await page.locator('.iconpack-card svg').count(), 18);
  await page.locator('#show-icon-example').click();
  assert.equal(await page.locator('#view-select').inputValue(), 'compare');
  assert.equal(await page.locator('#diagram [data-icon^="bootstrap."]').count(), 5);
  assert.equal(await page.locator('#diagram [data-icon^="lucide."]').count(), 5);
  assert.equal(await page.locator('#diagram [data-icon^="tabler."]').count(), 5);
  await page.screenshot({ path: 'test-results/iconpacks.png', fullPage: true });
  await page.locator('.icon-gallery').screenshot({ path: 'test-results/icon-gallery.png' });
  const fidelity = await page.evaluate(async () => {
    const samples = {
      bootstrap: ['person','cloud','cc-square','apple','align-top','123'],
      lucide: ['user','database','circle','app-window','accessibility'],
      tabler: ['user','cloud','brand-mailgun','file-isr','brand-livewire','circle-filled'],
    };
    const compare = async (original, converted) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const rasterize = async source => {
        const image = new Image(); image.src = 'data:image/svg+xml,' + encodeURIComponent(source); await image.decode();
        context.clearRect(0, 0, 64, 64); context.drawImage(image, 0, 0, 64, 64); return context.getImageData(0,0,64,64).data;
      };
      const a = await rasterize(original), b = await rasterize(converted);
      return a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
    };
    const errors = [];
    for (const [pack, names] of Object.entries(samples)) {
      const original = await (await fetch(`icons/upstream/${pack}.json`)).json();
      for (const name of names) {
        const icon = original.icons[name];
        const w = icon.width ?? original.width ?? 16, h = icon.height ?? original.height ?? 16;
        const reference = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="64" height="64">${icon.body}</svg>`;
        const error = await compare(reference, arch.renderIconToString(`${pack}.${name}`, { size: 64 }));
        if (error > 1) errors.push({ pack, name, error });
      }
    }
    return errors;
  });
  assert.deepEqual(fidelity, [], 'Imported icons visually match the original SVGs');
  const packDownload = page.waitForEvent('download');
  await page.locator('a[download][href="icons/bootstrap.json"]').click();
  const downloadedPack = await packDownload; await downloadedPack.saveAs('test-results/bootstrap.json');
  assert.equal(Object.keys(JSON.parse(await readFile('test-results/bootstrap.json', 'utf8')).icons).length, 2090);
  console.log('✓ All three packs, visible gallery, example, JSON download and raster comparison with original SVGs');
  const affinityReference=await readFile('ReferenceDocs/iconpacks/affinity.json','utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  const rawFidelity=await page.evaluate(async(affinity)=>{
    const samples={'fa6-solid':['0','house','cloud'],logos:['google','google-calendar','google-gemini-icon','firefox','vite','million','waffle-icon','react','github-icon']};
    const issues=[],gallery=document.createElement('div');gallery.id='raw-iconify-gallery';gallery.style.cssText='display:flex;flex-wrap:wrap;gap:24px;background:white;padding:32px;margin-left:240px';
    document.body.append(gallery);
    for(const [name,ids]of Object.entries(samples)) {
      const pack=await(await fetch(`icons/upstream/${name}.json`)).json();arch.registerIconPack(`direct-${name}`,pack);
      for(const id of ids) {
        const icon=pack.icons[id],w=icon.width??pack.width??16,h=icon.height??pack.height??16,max=Math.max(w,h);
        const reference=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${64*w/max}" height="${64*h/max}" viewBox="${icon.left??0} ${icon.top??0} ${w} ${h}">${icon.body}</svg>`;
        const generated=arch.renderIconToString(`direct-${name}.${id}`,{size:64});
        const rasterize=async svg=>{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(svg);await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,64,64);return ctx.getImageData(0,0,64,64).data;};
        const a=await rasterize(reference),b=await rasterize(generated),error=a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;
        if(error>1)issues.push({name,id,error});
        const tile=document.createElement('div');tile.style.cssText='width:110px;text-align:center;font:12px sans-serif;color:black';tile.innerHTML=generated;const label=document.createElement('div');label.textContent=id;tile.append(label);gallery.append(tile);
      }
    }
    if(affinity) {
      arch.registerIconPack('direct-affinity',affinity);
      const raster=async source=>{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(source);await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,64,64);return ctx.getImageData(0,0,64,64).data;};
      for(const id of ['bug','camera','client','router','shield']) {
        const body=affinity.icons[id].body,doc=new DOMParser().parseFromString(body.slice(body.indexOf('<svg')),'image/svg+xml'),root=doc.documentElement;
        const box=root.getAttribute('viewBox').split(/[\s,]+/).map(Number),w=box[2],h=box[3],longest=Math.max(w,h);
        root.setAttribute('width',64*w/longest);root.setAttribute('height',64*h/longest);
        const generated=arch.renderIconToString(`direct-affinity.${id}`,{size:64}),a=await raster(new XMLSerializer().serializeToString(root)),b=await raster(generated);
        const error=a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;if(error>1)issues.push({name:'affinity',id,error});
        const tile=document.createElement('div');tile.style.cssText='width:110px;text-align:center;font:12px sans-serif;color:black';tile.innerHTML=generated;const label=document.createElement('div');label.textContent=`affinity.${id}`;tile.append(label);gallery.append(tile);
      }
    }
    const alias={width:20,height:10,icons:{a:{body:'<path fill="red" d="M0 0h5v10H0Z"/>'}},aliases:{turned:{parent:'a',rotate:1},flipped:{parent:'a',hFlip:true}}};
    arch.registerIconPack('alias-render',alias);
    const raw=arch.renderIconToString('alias-render.turned',{size:64});
    if(!raw.includes('matrix(0 1 -1 0 10 0)'))issues.push('alias rotation');
    for(const [id,w,h,inside,outside]of [['turned',10,20,[5,2],[5,12]],['flipped',20,10,[17,5],[2,5]]]) {
      const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(arch.renderIconToString(`alias-render.${id}`,{size:64}));await img.decode();
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
      if(ctx.getImageData(...inside,1,1).data[0]!==255||ctx.getImageData(...outside,1,1).data[3]!==0)issues.push(`alias pixels ${id}`);
    }

    // Repeated gradient/mask logos in the same document cannot share IDs.
    gallery.insertAdjacentHTML('beforeend',arch.renderIconToString('direct-logos.vite')+arch.renderIconToString('direct-logos.vite'));
    const all=[...gallery.querySelectorAll('[id]')].map(n=>n.id);if(new Set(all).size!==all.length)issues.push('duplicate local SVG IDs');
    return issues;
  },affinityReference);
  assert.deepEqual(rawFidelity,[],'Original Iconify packs retain their colors, gradients, clips and filters');
  await page.locator('#raw-iconify-gallery').screenshot({path:'test-results/iconify-originals.png'});
  await page.locator('#raw-iconify-gallery').evaluate(e=>e.remove());
  console.log('✓ Direct original Iconify packs, colored logos, local IDs and raster fidelity');


  const edgeIconSource=await readFile('examples/edge-label-icons.arch','utf8');
  await page.locator('#source').fill(edgeIconSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram .arch-edge-label-icon').count(),4);
  const edgeIconIssues=await page.evaluate(source=>{
    arch.registerIconPack('label-logo-test',{icons:{wide:{width:300,height:100,body:'<defs><linearGradient id="paint"><stop stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="300" height="100" fill="url(#paint)"/>'}}});
    const host=document.createElement('div'),issues=[];document.body.append(host);
    for(const theme of ['light','dark'])for(const variant of ['standard','colored','iconOnly']) {
      let text=variant==='colored'?source.replaceAll('core.cloud','label-logo-test.wide'):source;
      if(variant==='iconOnly')text=text.replace('Transfers a signed manufacturing dataset','');
      const svg=arch.render(host,text,{theme}),bounds=svg.viewBox.baseVal;
      const ids=[...svg.querySelectorAll('[id]')].map(e=>e.id);if(new Set(ids).size!==ids.length)issues.push('Duplicate SVG ID in edge icons');
      for(const label of svg.querySelectorAll('.arch-edge-label')) {
        const rect=label.querySelector('rect').getBoundingClientRect(),icon=label.querySelector('.arch-edge-label-icon').getBoundingClientRect(),caption=label.querySelector('text')?.getBoundingClientRect();
        const box=label.getBBox();
        if(box.x<bounds.x||box.y<bounds.y||box.x+box.width>bounds.x+bounds.width||box.y+box.height>bounds.y+bounds.height)issues.push('Clipped edge label');
        for(const part of [icon,caption].filter(Boolean))if(part.left<rect.left-0.75||part.top<rect.top-0.75||part.right>rect.right+0.75||part.bottom>rect.bottom+0.75)issues.push(`Overflowing edge icon/text: ${theme}/${variant}`);
        if(caption) {
          const position=label.dataset.iconPosition;
          if(position==='left'&&icon.right>=caption.left||position==='right'&&icon.left<=caption.right||position==='top'&&icon.bottom>=caption.top||position==='bottom'&&icon.top<=caption.bottom)issues.push(`Overlapping icon and text: ${position}`);
        }
      }
    }
    host.remove();return issues;
  },edgeIconSource);
  assert.deepEqual(edgeIconIssues,[]);
  await page.screenshot({path:'test-results/edge-label-icons.png',fullPage:true});
  await page.locator('#toggle-theme').click();
  await page.screenshot({path:'test-results/edge-label-icons-dark.png',fullPage:true});
  await page.locator('#toggle-theme').click();
  console.log('✓ Edge label icons: four positions, defaults, multiline text, colored logos and both themes');
  const hiddenLabelsSource=await readFile('examples/edge-label-visibility.arch','utf8');
  await page.locator('#source').fill(hiddenLabelsSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  // The explicit label position on "before" overrides the global label none.
  assert.equal(await page.locator('#diagram .arch-edge').count(),4);
  assert.equal(await page.locator('#diagram .arch-edge-label').count(),1);
  assert.equal(await page.locator('#diagram .arch-edge-label-icon').count(),1);
  assert.equal(await page.locator('#diagram .arch-edge-label').getAttribute('data-label-for'),'before');
  assert.match(await page.locator('#diagram [data-edge="above"] > title').textContent(),/Transfers a signed/);
  await page.screenshot({path:'test-results/edge-label-none.png',fullPage:true});
  const hiddenAll=hiddenLabelsSource.replace('route before { label (450, 218) }','route before { label none }');
  const hiddenMarkup=await page.evaluate(source=>['light','dark'].map(theme=>arch.renderToString(source,{theme})),hiddenAll);
  assert.ok(hiddenMarkup.every(svg=>!svg.includes('class="arch-edge-label"')));


  const nodePresentationSource=await readFile('examples/node-presentation.arch','utf8');
  await page.locator('#source').fill(nodePresentationSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  await page.screenshot({path:'test-results/node-icon-positions.png',fullPage:true});
  await page.selectOption('#view-select','fields');
  assert.equal(await page.locator('#diagram [data-node="topNode"] > text').count(),0);
  assert.equal(await page.locator('#diagram [data-node="leftNode"] [data-icon]').count(),0);
  assert.equal(await page.locator('#diagram [data-node="bottomNode"] > text').count(),0);
  assert.equal(await page.locator('#diagram [data-node="bottomNode"] [data-icon]').count(),0);
  assert.equal(await page.locator('#diagram [data-label-for="flow"] text').count(),0);
  assert.equal(await page.locator('#diagram [data-label-for="flow"] [data-icon]').count(),1);
  await page.screenshot({path:'test-results/node-visible-fields.png',fullPage:true});
  const nodePresentationIssues=await page.evaluate(()=>{
    const host=document.createElement('div'),issues=[],types=['person','system','application','service','component','database','queue','interface','capability','process','artifact','node'];document.body.append(host);
    for(const position of ['top','left','bottom','right'])for(const fontSize of [8,32,64])for(const theme of ['light','dark']) {
      const entries=types.map((type,i)=>`${type} n${i} "VISIBLE_LABEL" {stereotype "LONG_STEREOTYPE" description "Visible description" technology "Visible technology"}`).join(' ');
      const styles=types.map((type,i)=>`place n${i} at (${i*300},0) style n${i} {iconPosition ${position} width 160 height 96 fontSize ${fontSize}}`).join(' ');
      const model=arch.parse(`architecture "Node presentation" {model {${entries}} view v "V" {${styles}}}`),graph=arch.layout(model),svg=arch.render(host,model,{theme});
      for(const node of graph.nodes) {
        const group=svg.querySelector(`[data-node="${node.id}"]`),icon=group.querySelector('[data-icon]').getBoundingClientRect();
        for(const text of group.querySelectorAll(':scope > text')) {
          const b=text.getBBox(),c=text.getBoundingClientRect();
          if(b.width&&(b.x<0||b.y<0||b.x+b.width>node.width+1||b.y+b.height>node.height+1))issues.push(`Text overflow: ${node.type}/${position}/${fontSize}`);
          if(c.width&&icon.left<c.right&&icon.right>c.left&&icon.top<c.bottom&&icon.bottom>c.top)issues.push(`Icon/text overlap: ${node.type}/${position}/${fontSize}`);
        }
      }
    }
    for(const position of ['top','left','bottom','right'])for(const flags of ['', 'showIcon false showStereotype false', 'showLabel false showDescription false showTechnology false', 'showStereotype false showLabel false showDescription false showTechnology false', 'showIcon false showStereotype false showLabel false showDescription false showTechnology false']) {
      const text=`architecture "Fields" {model {system n "Title" {description "Details" technology "Tech"}} view v "V" {style n {iconPosition ${position} ${flags}}}}`;
      const graph=arch.layout(arch.parse(text)),svg=arch.render(host,text),node=graph.nodes[0],group=svg.querySelector('[data-node="n"]');
      for(const label of group.querySelectorAll(':scope > text')) {const b=label.getBBox();if(b.width&&(b.x<0||b.y<0||b.x+b.width>node.width+1||b.y+b.height>node.height+1))issues.push(`Visibility overflow: ${position}/${flags}`);}
    }
    for(const position of ['top','left','bottom','right']) {
      const text=`architecture "Headers" {model {package p "A long package header" {system child "Child"}} view v "V" {style p {iconPosition ${position} fontSize 32}}}`;
      const svg=arch.render(host,text),group=svg.querySelector('[data-node="p"]'),icon=group.querySelector('[data-icon]').getBoundingClientRect(),graph=arch.layout(arch.parse(text)),box=graph.nodes.find(n=>n.id==='p');
      for(const label of group.querySelectorAll(':scope > text')) {
        const b=label.getBBox(),c=label.getBoundingClientRect();
        if(b.width&&(b.x<0||b.y<0||b.x+b.width>box.width+1||b.y+b.height>box.headerHeight+1))issues.push(`Header overflow: ${position}`);
        if(c.width&&icon.left<c.right&&icon.right>c.left&&icon.top<c.bottom&&icon.bottom>c.top)issues.push(`Header icon/text overlap: ${position}`);
      }
    }
    host.remove();return issues;
  });
  assert.deepEqual(nodePresentationIssues,[]);
  console.log('✓ Node icon positions and visibility: all templates, headers, minimum widths and both themes');

  const stress = await page.evaluate(() => {
    const types = ['person','system','application','service','component','database','queue','interface','capability','process','artifact','node'];
    const entries = types.map((type, i) => `${type} n${i} "UPPERCASEAAAAAAAAAAAA and 日本語" { description "A longer description wraps cleanly across several lines." technology "A-very-long-unbroken-technology-identifier" stereotype "LONG_CUSTOM_STEREOTYPE" }`).join('\n');
    const overflow = [];
    for(const [fontSize,width,height] of [[15,160,96],[14,280,120],[32,180,96],[64,240,96],[8,160,96]]) {
      const view = types.map((_, i) => `place n${i} at (${i * 350}, 0) style n${i} {fontSize ${fontSize} width ${width} height ${height}}`).join('\n');
      const source = `architecture "Stress" { model { ${entries} } view v "V" { ${view} } }`;
      const model = arch.parse(source), graph = arch.layout(model), container = document.createElement('div');
      document.body.append(container); arch.render(container, model);
      for (const node of graph.nodes) {
        const group=container.querySelector(`[data-node="${node.id}"]`),badge=group.querySelector('[data-node-badge]');
        if(badge.querySelectorAll('tspan').length!==1)overflow.push(`Wrapped badge: ${node.type}/${fontSize}`);
        if(badge.querySelector('title').textContent!=='LONG_CUSTOM_STEREOTYPE')overflow.push(`Incomplete badge tooltip: ${node.type}`);
        for (const text of group.querySelectorAll(':scope > text')) {
          const b = text.getBBox();
          if (b.width && (b.x < -1 || b.y < -1 || b.x + b.width > node.width + 1 || b.y + b.height > node.height + 1)) overflow.push(node.type + '/' + fontSize + ': ' + text.textContent);
        }
      }
      container.remove();
    }
    return overflow;
  });
  assert.deepEqual(stress, []); console.log('✓ Long text, Unicode and custom stereotypes at minimum card sizes');

  const multipleViewsSource=await readFile('examples/multiple-views.arch','utf8');
  await page.locator('#source').fill(multipleViewsSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#view-select').inputValue(),'@configured');
  assert.equal(await page.locator('#diagram > svg').getAttribute('data-arch-views'),'3');
  assert.equal(await page.locator('#diagram > svg svg[data-view-id]').count(),3);
  const nativeViewIssues=await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');host.id='multi-view-proof';host.style.cssText='width:1000px;margin:24px 0 24px 240px;';document.body.append(host);
    const model=arch.parse(source),graph=arch.layout(model),svg=arch.render(host,model),outer=svg.getBoundingClientRect();
    let previousBottom=outer.top;
    for(const child of svg.querySelectorAll('svg[data-view-id]')) {
      const rect=child.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0||rect.left<outer.left-1||rect.right>outer.right+1||rect.bottom>outer.bottom+1)issues.push(`Invalid nested viewport: ${child.dataset.viewId}`);
      if(rect.top<previousBottom)issues.push('Overlapping viewports');previousBottom=rect.bottom;
    }
    if(graph.bounds.height<=graph.layouts[0].bounds.height)issues.push('Stack height did not include all views');
    const ids=[...svg.querySelectorAll('[id]')].map(e=>e.id);ids.push(svg.id);
    if(new Set(ids).size!==ids.length)issues.push('Duplicate IDs in composed SVG');
    for(const element of svg.querySelectorAll('*'))for(const attr of element.attributes)for(const match of attr.value.matchAll(/url\(#([^)]*)\)/g))if(!ids.includes(match[1]))issues.push('Unresolved SVG definition');
    return issues;
  },multipleViewsSource);
  assert.deepEqual(nativeViewIssues,[]);
  await page.locator('#multi-view-proof').screenshot({path:'test-results/multiple-views-export.png'});
  await page.locator('#multi-view-proof').evaluate(element=>element.remove());
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/multiple-views.png',fullPage:true});
  const multiDownload=await Promise.all([page.waitForEvent('download'),page.locator('#export-svg').click()]);
  const multiExport=await readFile(await multiDownload[0].path(),'utf8');
  assert.match(multiExport,/data-arch-views="3"/);
  assert.ok(await page.evaluate(async svg=>{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(svg);await img.decode();return img.naturalWidth>0&&img.naturalHeight>0;},multiExport));
  await page.selectOption('#view-select','detail');
  assert.equal(await page.locator('#diagram > svg').getAttribute('data-arch-views'),null);
  await page.selectOption('#view-select','@configured');
  assert.equal(await page.locator('#diagram > svg').getAttribute('data-arch-views'),'3');
  await page.locator('#toggle-theme').click();
  assert.ok((await page.locator('#diagram svg').evaluateAll(elements=>elements.map(e=>e.dataset.archSvg))).every(theme=>theme==='dark'));
  await page.locator('#toggle-theme').click();
  const subsetSource=multipleViewsSource.replace('views all','views [detail, overview]');
  await page.locator('#source').fill(subsetSource);await page.locator('#render-button').click();
  assert.deepEqual(await page.locator('#diagram [data-arch-view]').evaluateAll(elements=>elements.map(e=>e.dataset.archView)),['detail','overview']);
  await page.locator('#source').fill(subsetSource.replace('[detail, overview]','[missing]'));await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),true);
  assert.equal(await page.locator('#diagram > svg').getAttribute('data-arch-views'),'2');
  await page.locator('#source').fill(multipleViewsSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  const multiAdapters=await page.evaluate(source=>{
    const host=document.createElement('div');document.body.append(host);
    for(let i=0;i<2;i++){const block=document.createElement('div');block.dataset.arch='';block.textContent=source;host.append(block);}
    const count=arch.renderAll({root:host}).length,rerun=arch.renderAll({root:host}).length;
    const ids=[...host.querySelectorAll('[id]')].map(e=>e.id),roots=host.querySelectorAll('svg[data-arch-views]').length;
    const markdown=arch.renderMarkdown('```arch\n'+source+'\n```');
    host.remove();return {count,rerun,roots,unique:new Set(ids).size===ids.length,markdown:markdown.includes('data-arch-views="3"')};
  },multipleViewsSource);
  assert.deepEqual(multiAdapters,{count:2,rerun:0,roots:2,unique:true,markdown:true});
  console.log('✓ Configured views: stacked export, native viewport bounds, selection, adapters and live recovery');

  await page.locator('[data-example="minimal"]').click();
  const original = await page.locator('#source').inputValue();
  await page.locator('#source').fill(original.replace('Your application', 'Edited application'));
  await page.waitForFunction(() => document.querySelector('#diagram svg').textContent.includes('Edited application'));
  await page.locator('[data-example="manual"]').click();
  await page.locator('[data-example="minimal"]').click();
  assert.match(await page.locator('#source').inputValue(), /Edited application/);
  await page.locator('#source').fill('architecture "Broken" { model { service');
  await page.waitForSelector('#error:not([hidden])');
  assert.match(await page.locator('#error').innerText(), /line 1, column/);
  assert.match(await page.locator('#diagram').innerText(), /Edited application/);
  assert.equal(await page.locator('#export-svg').isDisabled(), true);
  await page.locator('#source').fill(original);
  await page.locator('#source').press('Control+Enter');
  await page.waitForSelector('#error[hidden]', { state: 'attached' });
  assert.equal(await page.locator('#export-svg').isDisabled(), false);
  await page.locator('#toggle-theme').click();
  assert.equal(await page.locator('#diagram svg').getAttribute('data-arch-svg'), 'dark');
  await page.screenshot({ path: 'test-results/dark.png', fullPage: true });
  const beforeZoom = await page.locator('#fit').innerText();
  await page.locator('#zoom-in').click(); assert.notEqual(await page.locator('#fit').innerText(), beforeZoom);
  await page.locator('#fit').click();
  await page.locator('#open-guide').click(); assert.equal(await page.locator('#guide').isVisible(), true);
  await page.locator('#close-guide').click(); assert.equal(await page.locator('#guide').isVisible(), false);
  console.log('✓ Live edits, preserved drafts, error recovery, theme, zoom and guide');

  for (const [button, extension] of [['#export-svg', 'svg'], ['#download-source', 'arch']]) {
    const promise = page.waitForEvent('download'); await page.locator(button).click(); const download = await promise;
    assert.ok(download.suggestedFilename().endsWith(`.${extension}`));
    const file = `test-results/export.${extension}`; await download.saveAs(file);
    const contents = await readFile(file, 'utf8');
    if (extension === 'svg') assert.match(contents, /<svg[^>]+xmlns=/); else assert.equal(contents, original);
  }
  console.log('✓ SVG and source downloads contain valid artifacts');

  const markdown = await readFile('test.md', 'utf8');
  const adapters = await page.evaluate(markdown => {
    const container = document.createElement('section'); document.body.append(container);
    container.innerHTML = arch.renderMarkdown(markdown);
    const markdownSvgs = container.querySelectorAll('svg').length;
    const source = 'architecture "Embedded" { model { service a "A" } }';
    const first = document.createElement('pre'), code = document.createElement('code'); first.dataset.arch = '';
    code.className = 'language-arch'; code.textContent = source; first.append(code);
    const second = document.createElement('div'); second.dataset.arch = ''; second.textContent = source;
    const broken = document.createElement('div'); broken.dataset.arch = ''; broken.textContent = 'invalid';
    container.replaceChildren(first, broken, second);
    const count = arch.renderAll({ root: container }).length;
    const rerun = arch.renderAll({ root: container }).length;
    const isolated = container.querySelectorAll('[role="alert"]').length;
    const ids = [...container.querySelectorAll('svg [id]')].map(node => node.id);
    const unique = new Set(ids).size === ids.length;
    container.remove(); return { markdownSvgs, count, rerun, isolated, unique };
  }, markdown);
  assert.deepEqual(adapters, { markdownSvgs: 2, count: 2, rerun: 0, isolated: 1, unique: true });
  console.log('✓ Markdown and renderAll adapters, isolated errors and unique SVG IDs');

  const jsonSource=await readFile('examples/json-architecture.json','utf8');
  await page.locator('[data-example="json-architecture"]').click();
  await page.waitForSelector('#diagram svg[data-arch-views="2"]');
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#source').inputValue(),jsonSource);
  assert.equal(await page.locator('#source-extension').innerText(),'.json');
  assert.equal(await page.locator('#source-format').innerText(),'json');
  assert.equal(await page.locator('#view-select').inputValue(),'@configured');
  assert.equal(await page.locator('#diagram [data-arch-view]').count(),2);
  await page.screenshot({path:'test-results/json-architecture.png',fullPage:true});
  await page.locator('#view-select').selectOption('matrix');
  assert.equal(await page.locator('#diagram svg[data-diagram="matrix"]').count(),1);
  await page.locator('#view-select').selectOption('@configured');
  await page.locator('#toggle-theme').click();
  assert.equal(await page.locator('#diagram svg[data-arch-views]').getAttribute('data-arch-svg'),'dark');
  const jsonDownloadPromise=page.waitForEvent('download');await page.locator('#download-source').click();
  const jsonDownload=await jsonDownloadPromise;assert.ok(jsonDownload.suggestedFilename().endsWith('.json'));
  await jsonDownload.saveAs('test-results/json-source.json');
  assert.equal(await readFile('test-results/json-source.json','utf8'),jsonSource);
  await page.locator('#source').fill('{"architecture":');await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),true);
  assert.equal(await page.locator('#diagram svg[data-arch-views]').count(),1,'Last valid JSON preview retained');
  await page.locator('#source').fill(jsonSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  const jsonAdapters=await page.evaluate(source=>{
    const host=document.createElement('section');document.body.append(host);
    const jsonDocument=JSON.parse(source),svg=arch.render(host,jsonDocument,{idPrefix:'json-object'});
    const objectResult=svg.getAttribute('data-arch-views');
    host.replaceChildren();
    for(const text of [source,'{"architecture":{"name":"A","name":"B"}}','architecture "After JSON" {model {service a "A"}}']) {
      const pre=window.document.createElement('pre');pre.dataset.arch='';pre.textContent=text;host.append(pre);
    }
    const rendered=arch.renderAll({root:host}).length,alerts=host.querySelectorAll('[role="alert"]').length;
    const markdown=arch.renderMarkdown('```arch\n'+source+'\n```\n```json\n'+source+'\n```');
    host.innerHTML=markdown;const markdownSvgs=host.querySelectorAll('svg[data-arch-views]').length;
    const code=host.querySelectorAll('code.language-json').length;
    const help=arch.renderToString({'@help':'json'}).includes('Equivalent JSON input');
    host.remove();return {objectResult,rendered,alerts,markdownSvgs,code,help};
  },jsonSource);
  assert.deepEqual(jsonAdapters,{objectResult:'2',rendered:2,alerts:1,markdownSvgs:1,code:1,help:true});
  await page.locator('[data-example="json-architecture"]').click();
  await page.locator('#source').fill(await readFile('examples/json-naf41.json','utf8'));await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram .arch-edge-reference').count(),1);
  assert.equal(await page.locator('#diagram .arch-reference-connector').count(),1);
  await page.screenshot({path:'test-results/json-naf41.png',fullPage:true});
  console.log('✓ JSON editor, views, themes, source download, recovery, DOM/Markdown adapters, help and NAF reference routing');

  await page.locator('#view-select').selectOption('@meta');
  assert.equal(await page.locator('#source-meta').isVisible(),true);
  assert.equal(await page.locator('#canvas').isVisible(),false);
  assert.equal(await page.locator('#meta-title').innerText(),'JSON → DSL');
  assert.match(await page.locator('#meta-output').innerText(),/OperationalPerformer fighter/);
  assert.equal(await page.locator('.meta-diagnostic').count(),0);
  const translatedDownloadPromise=page.waitForEvent('download');await page.locator('#meta-download').click();
  const translatedDownload=await translatedDownloadPromise;assert.ok(translatedDownload.suggestedFilename().endsWith('.arch'));
  await translatedDownload.saveAs('test-results/meta-translated.arch');
  const translatedSource=await readFile('test-results/meta-translated.arch','utf8');assert.match(translatedSource,/architecture "Logical control"/);
  const metaDSL='architecture "Meta source" {model {service api "API"} view overview "Overview" {}}';
  await page.locator('#source').fill(metaDSL);await page.locator('#render-button').click();
  assert.equal(await page.locator('#meta-title').innerText(),'DSL → JSON');
  const translatedJSON=JSON.parse(await page.locator('#meta-output').innerText());
  assert.equal(translatedJSON.architecture.model.elements.api.type,'service');
  assert.match(await page.locator('#profile-info').innerText(),/default/);
  assert.equal(await page.locator('#preview-kind').innerText(),'SOURCE');
  assert.equal(await page.locator('#export-svg').isDisabled(),true);
  await page.screenshot({path:'test-results/meta-json.png',fullPage:true});
  const brokenDSL='architecture "Broken" {\n  modle {}\n}';
  await page.locator('#source').fill(brokenDSL);await page.locator('#render-button').click();
  assert.equal(await page.locator('#meta-download').isDisabled(),true);
  assert.equal(await page.locator('.meta-candidates code').first().innerText(),'model');
  assert.match(await page.locator('.meta-error-line').innerText(),/2  modle|2    modle/);
  await page.locator('.meta-diagnostic > button').first().click();
  assert.equal(await page.locator('#source').evaluate(el=>el.value.slice(el.selectionStart,el.selectionStart+5)),'modle');
  await page.screenshot({path:'test-results/meta-dsl-error.png',fullPage:true});
  const brokenJSON=JSON.stringify({architecture:{name:'Bad JSON field',model:{},views:{v:{name:'V',dierection:'right'}}}},null,2);
  await page.locator('#source').fill(brokenJSON);await page.locator('#render-button').click();
  assert.match(await page.locator('.meta-path').innerText(),/\/architecture\/views\/v\/dierection/);
  assert.equal(await page.locator('.meta-candidates code').first().innerText(),'direction');
  await page.screenshot({path:'test-results/meta-json-error.png',fullPage:true});
  const abstractSource='architecture "Profile correction" {config {profile naf41-uaf} model {OperationalAgent fighter "Fighter"}}';
  await page.locator('#source').fill(abstractSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#meta-download').isDisabled(),false,'Semantic errors retain readable translation');
  assert.ok((await page.locator('.meta-candidates').first().innerText()).includes('OperationalPerformer'));
  await page.locator('#source').fill(metaDSL);await page.locator('#render-button').click();
  assert.equal(await page.locator('.meta-diagnostic').count(),0);
  await page.locator('#view-select').selectOption('overview');
  assert.equal(await page.locator('#source-meta').isVisible(),false);
  assert.equal(await page.locator('#canvas').isVisible(),true);
  assert.equal(await page.locator('#export-svg').isDisabled(),false);
  assert.equal(await page.locator('#diagram [data-node="api"]').count(),1);
  console.log('✓ Meta view: bidirectional translation, downloads, source locations, typo/type candidates and recovery to diagram');

  await page.locator('[data-example="meta"]').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram svg[data-arch-views="3"]').count(),1);
  assert.equal(await page.locator('#diagram svg[data-arch-meta]').count(),2);
  assert.equal(await page.locator('#diagram [data-arch-view]').count(),3);
  const sourceViewIssues=await page.evaluate(()=>{
    const issues=[];
    for(const svg of document.querySelectorAll('#diagram svg[data-arch-meta]')) {
      const b=svg.getBoundingClientRect();
      for(const text of svg.querySelectorAll('text')) {const r=text.getBoundingClientRect();if(r.width&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1))issues.push(text.textContent);}
    }
    return issues;
  });assert.deepEqual(sourceViewIssues,[]);
  const sourceSVGDownload=page.waitForEvent('download');await page.locator('#export-svg').click();const sourceSVG=await sourceSVGDownload;
  await sourceSVG.saveAs('test-results/architecture-meta.svg');
  const exportedMeta=await readFile('test-results/architecture-meta.svg','utf8');assert.match(exportedMeta,/data-arch-meta="json"/);assert.match(exportedMeta,/data-arch-meta="dsl"/);
  await page.screenshot({path:'test-results/architecture-meta.png',fullPage:true});
  await page.locator('#view-select').selectOption('jsonSource');
  assert.equal(await page.locator('#diagram svg[data-arch-meta="json"]').count(),1);
  assert.equal(await page.locator('#export-svg').isDisabled(),false,'Declared source view supports SVG export');
  assert.equal(await page.locator('#toggle-theme').isDisabled(),false);
  await page.locator('#toggle-theme').click();assert.equal(await page.locator('#diagram svg[data-arch-meta]').getAttribute('data-arch-svg'),'dark');
  await page.screenshot({path:'test-results/architecture-meta-dark.png',fullPage:true});
  await page.locator('#view-select').selectOption('dslSource');
  assert.ok((await page.locator('#diagram .arch-meta-code').allTextContents()).join('\n').includes('@meta json'));
  const sourceJSON=await page.evaluate(source=>arch.translate(source),await readFile('examples/meta.arch','utf8'));
  await page.locator('#source').fill(sourceJSON);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.locator('#diagram svg[data-arch-meta="dsl"]').count(),1);
  await page.locator('#view-select').selectOption('@configured');assert.equal(await page.locator('#diagram svg[data-arch-meta]').count(),2);
  const metaExportPage=await browser.newPage({viewport:{width:1100,height:900}});
  await metaExportPage.goto(pathToFileURL(path.resolve('test-results/architecture-meta.svg')).href);
  assert.equal(await metaExportPage.locator('svg[data-arch-meta]').count(),2);
  // Chromium's native SVG document viewer can stall full-page screenshots.
  // Verify the file directly above, then rasterize the same SVG in a plain host.
  await metaExportPage.goto('about:blank');
  await metaExportPage.setContent('<style>html,body{margin:0}svg{display:block}</style>'+exportedMeta);
  await metaExportPage.screenshot({path:'test-results/architecture-meta-export.png',fullPage:true});await metaExportPage.close();
  console.log('✓ Architecture @meta views: combined/single SVG, JSON/DSL input, source text bounds, themes and standalone export');

  await page.locator('[data-example="manual"]').click();
  await page.screenshot({ path: 'test-results/manual.png', fullPage: true });
  await page.locator('[data-example="capabilities"]').click();
  await page.evaluate(() => { document.querySelector('#toast').hidden = true; });
  await page.screenshot({ path: 'test-results/templates.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.selectOption('#example-select', 'minimal');
  assert.match(await page.locator('#source').inputValue(), /Hello, architecture/);
  await page.selectOption('#example-select', 'capabilities');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  const mobile = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, width: window.innerWidth,
    preview: document.querySelector('#canvas').getBoundingClientRect().width, source: document.querySelector('#source').getBoundingClientRect().width }));
  assert.ok(mobile.body <= mobile.width, JSON.stringify(mobile)); assert.ok(mobile.preview > 250 && mobile.source > 250);
  console.log('✓ Mobile layout without horizontal page overflow');
  await page.selectOption('#example-select', 'help');
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#diagram [data-arch-help]').count(), 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'test-results/help-mobile.png', fullPage: true });
  await page.selectOption('#view-select','@meta');
  await page.locator('#source').fill('architecture "Mobile error" {\n modle {}\n}');await page.locator('#render-button').click();
  assert.equal(await page.locator('#source-meta').isVisible(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Meta diagnostics do not widen the mobile page');
  await page.screenshot({path:'test-results/meta-mobile.png',fullPage:true});

  const direct = await browser.newPage();
  await direct.goto(pathToFileURL(path.resolve('index.html')).href);
  await direct.waitForSelector('#diagram svg');
  assert.equal(await direct.locator('#error').isVisible(), false);
  assert.equal(await direct.evaluate(()=>{
    arch.registerIconPack('offline-raw',{icons:{sample:{body:'<circle cx="8" cy="8" r="6" fill="#ff0000"/>'}}});
    return arch.renderIconToString('offline-raw.sample').includes('fill="#ff0000"');
  }),true);
  await direct.locator('[data-example="iconpacks"]').click();
  assert.equal(await direct.locator('#diagram [data-icon^="tabler."]').count(), 5);
  await direct.locator('[data-example="uaf"]').click();
  assert.equal(await direct.locator('#error').isVisible(), false);
  assert.match(await direct.locator('#profile-info').innerText(), /naf4-uaf/);
  await direct.locator('[data-example="naf41"]').click();
  assert.equal(await direct.locator('#error').isVisible(), false);
  assert.match(await direct.locator('#profile-info').innerText(), /naf41-uaf/);
  await direct.locator('[data-example="diagrams"]').click();
  for(const view of ['interaction','states','workflow','mapping','assessment','delivery','details']) {
    await direct.selectOption('#view-select',view);
    assert.equal(await direct.locator('#error').isVisible(),false);
    assert.ok(await direct.locator('#diagram svg').getAttribute('data-diagram'));
  }
  await direct.locator('[data-example="help"]').click();
  assert.equal(await direct.locator('#diagram [data-arch-help]').count(), 1);
  await direct.locator('#source').fill('@help iconpacks offline-raw');
  await direct.locator('#render-button').click();
  assert.equal(await direct.locator('#error').isVisible(), false);
  assert.ok((await direct.locator('#diagram').innerText()).includes('offline-raw.sample'));
  await direct.locator('#view-select').selectOption('@meta');
  assert.equal(await direct.locator('#source-meta').isVisible(),true);
  assert.match(await direct.locator('#meta-output').innerText(),/offline-raw/);
  await direct.close();
  assert.ok(requests.every(url => url.startsWith(address) || url.startsWith('data:')), requests.filter(url => !url.startsWith(address)));
  assert.deepEqual(errors, []);
  console.log('✓ file:// launch, zero external requests, zero JavaScript errors');
  console.log('Browser checks passed. Screenshots: test-results/');
} finally {
  await browser?.close(); child.kill('SIGTERM');
}
