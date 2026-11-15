import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

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
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  console.log('✓ Desktop launch, local resources and initial SVG');

  const overflow = [];
  for (const id of ['platform', 'manual', 'capabilities', 'iconpacks', 'profiles', 'external-profile', 'uaf', 'minimal']) {
    await page.locator(`[data-example="${id}"]`).click();
    const views = await page.locator('#view-select option').evaluateAll(options => options.map(o => o.value));
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
  await page.locator('[data-example="diagrams"]').click();
  const diagramViews=await page.locator('#view-select option').evaluateAll(options=>options.map(o=>o.value));
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
  assert.match(await page.locator('#error').innerText(), /Pflichtattribut owner/);
  assert.equal(await page.locator('#export-svg').isDisabled(), true);
  await page.locator('#source').fill(profileSource);
  await page.locator('#render-button').click();
  await page.waitForSelector('#error[hidden]', { state: 'attached' });
  await page.selectOption('#profile-select', 'enterprise-demo');
  assert.match(await page.locator('#profile-info').innerText(), /enterprise-demo/);
  assert.equal(await page.locator('#error').isVisible(), false);
  await page.selectOption('#profile-select', 'default');
  assert.equal(await page.locator('#error').isVisible(), true);
  assert.match(await page.locator('#error').innerText(), /Unbekannter Elementtyp/);
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
    assert.deepEqual(Object.fromEntries(fills), {Capability:'#00FF00',ServiceSpecification:'#EE82EE',OperationalActivity:'#6A5ACD',Software:'#FF8C00',Standard:'#FFD700',Requirement:dark?'#1e293b':'#ffffff'});
    assert.deepEqual(await page.locator('#diagram [data-node]').evaluateAll(nodes => nodes.map(node => node.querySelector('g[filter] > :first-child').getAttribute('fill-opacity'))), ['0.2','0.2','0.2','0.2','0.2',null]);
    await page.screenshot({path: `test-results/uaf-colors-${dark?'dark':'light'}.png`,fullPage:true});
  }
  await page.locator('#toggle-theme').click();
  await page.selectOption('#view-select', 'traceability');
  await page.screenshot({ path: 'test-results/uaf-traceability.png', fullPage: true });
  const uafSource = await page.locator('#source').inputValue();
  await page.locator('#source').fill(uafSource.replace('dispatchFunction -> dispatch', 'dispatchFunction -> maritime'));
  await page.waitForSelector('#error:not([hidden])');
  assert.match(await page.locator('#error').innerText(), /Typkombination Function → Capability/);
  await page.locator('#source').fill(uafSource); await page.locator('#render-button').click();
  await page.waitForSelector('#error[hidden]', {state:'attached'});
  console.log('✓ UAF/NAF profile, taxonomy, cross-domain realization constraints and live error recovery');

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

  const stress = await page.evaluate(() => {
    const types = ['person','system','application','service','component','database','queue','interface','capability','process','artifact','node'];
    const entries = types.map((type, i) => `${type} n${i} "UPPERCASEAAAAAAAAAAAA and 日本語" { description "A longer description wraps cleanly across several lines." technology "A-very-long-unbroken-technology-identifier" stereotype "LONG_CUSTOM_STEREOTYPE" }`).join('\n');
    const view = types.map((_, i) => `place n${i} at (${i * 250}, 0) size (160,96)`).join('\n');
    const source = `architecture "Stress" { model { ${entries} } view v "V" { ${view} } }`;
    const model = arch.parse(source), graph = arch.layout(model), container = document.createElement('div');
    document.body.append(container); arch.render(container, model);
    const overflow = [];
    for (const node of graph.nodes) for (const text of container.querySelector(`[data-node="${node.id}"]`).querySelectorAll(':scope > text')) {
      const b = text.getBBox();
      if (b.width && (b.x < -1 || b.x + b.width > node.width + 1 || b.y + b.height > node.height + 1)) overflow.push(node.type + ': ' + text.textContent);
    }
    container.remove(); return overflow;
  });
  assert.deepEqual(stress, []); console.log('✓ Long text, Unicode and custom stereotypes at minimum card sizes');

  await page.locator('[data-example="minimal"]').click();
  const original = await page.locator('#source').inputValue();
  await page.locator('#source').fill(original.replace('Your application', 'Edited application'));
  await page.waitForFunction(() => document.querySelector('#diagram svg').textContent.includes('Edited application'));
  await page.locator('[data-example="manual"]').click();
  await page.locator('[data-example="minimal"]').click();
  assert.match(await page.locator('#source').inputValue(), /Edited application/);
  await page.locator('#source').fill('architecture "Broken" { model { service');
  await page.waitForSelector('#error:not([hidden])');
  assert.match(await page.locator('#error').innerText(), /Zeile 1, Spalte/);
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

  const direct = await browser.newPage();
  await direct.goto(pathToFileURL(path.resolve('index.html')).href);
  await direct.waitForSelector('#diagram svg');
  assert.equal(await direct.locator('#error').isVisible(), false);
  await direct.locator('[data-example="iconpacks"]').click();
  assert.equal(await direct.locator('#diagram [data-icon^="tabler."]').count(), 5);
  await direct.locator('[data-example="uaf"]').click();
  assert.equal(await direct.locator('#error').isVisible(), false);
  assert.match(await direct.locator('#profile-info').innerText(), /naf4-uaf/);
  await direct.locator('[data-example="diagrams"]').click();
  for(const view of ['interaction','states','workflow','mapping','assessment','delivery','details']) {
    await direct.selectOption('#view-select',view);
    assert.equal(await direct.locator('#error').isVisible(),false);
    assert.ok(await direct.locator('#diagram svg').getAttribute('data-diagram'));
  }
  await direct.close();
  assert.ok(requests.every(url => url.startsWith(address) || url.startsWith('data:')), requests.filter(url => !url.startsWith(address)));
  assert.deepEqual(errors, []);
  console.log('✓ file:// launch, zero external requests, zero JavaScript errors');
  console.log('Browser checks passed. Screenshots: test-results/');
} finally {
  await browser?.close(); child.kill('SIGTERM');
}
