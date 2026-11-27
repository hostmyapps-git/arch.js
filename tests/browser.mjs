import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
  async function openModelFile(page, name, source) {
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Open file',exact:true}).click();
    await (await picker).setFiles({name,mimeType:name.endsWith('.json') ? 'application/json' : 'text/plain',buffer:Buffer.from(source)});
  }
  const landing = await browser.newPage({ viewport: { width: 1440, height: 970 } });
  const landingErrors = [], landingRequests = [];
  landing.on('pageerror', error => landingErrors.push(error.message));
  landing.on('request', request => landingRequests.push(request.url()));
  await landing.goto(address);
  await landing.getByRole('heading',{name:'Architecture you can read.'}).waitFor();
  await landing.locator('#hero-diagram svg[data-arch-svg="dark"]').waitFor();
  await landing.locator('#play-preview svg').waitFor();
  assert.deepEqual(landingRequests.map(url=>new URL(url).pathname),['/','/arch.core.min.js']);
  const corePresentation = await landing.evaluate(() => {
    const source = 'architecture "Test" { config { presentation dashboard } model { service app "App" } }';
    const host = document.createElement('div');
    let error;
    try { arch.render(host, source); }
    catch (issue) { error = issue.code; }
    return {
      error,
      diagram: arch.render(host, source, { presentation:'diagram' }).localName,
      validates: arch.validate(source).valid,
      svgExport: arch.renderToString(source).startsWith('<svg')
    };
  });
  assert.deepEqual(corePresentation, {error:'ARCH_STUDIO_REQUIRED',diagram:'svg',validates:true,svgExport:true});
  await landing.screenshot({path:'test-results/landing.png',fullPage:true});
  const playView=landing.getByLabel('View',{exact:true});
  const playExample=landing.getByLabel('Example',{exact:true});
  const playSource=landing.getByRole('textbox',{name:'Architecture source',exact:true});
  await landing.getByRole('link',{name:'Try the playground'}).click();
  assert.equal(new URL(landing.url()).hash,'#playground');
  await playView.selectOption('data');
  assert.equal(await landing.locator('#play-preview [data-node]').count(),3);
  const originalLandingSource=await playSource.inputValue();
  await playSource.fill(originalLandingSource.replace('Tracking API','Parcel API'));
  await landing.locator('#play-preview').getByText('Parcel API',{exact:true}).waitFor();
  await playSource.fill('architecture "Unfinished" {');
  await landing.getByRole('alert').waitFor();
  assert.equal(await landing.getByRole('button',{name:'Download SVG'}).isDisabled(),true);
  assert.match(await landing.locator('#play-preview').textContent(),/Parcel API/);
  await playSource.fill(originalLandingSource.replace('Tracking API','Parcel API'));
  await playSource.press('Control+Enter');
  assert.equal(await landing.getByRole('alert').isVisible(),false);
  await playExample.selectOption('handoff');
  await landing.locator('#play-preview svg[data-diagram="sequence"]').waitFor();
  await playExample.selectOption('lifecycle');
  await landing.locator('#play-preview svg[data-diagram="state"]').waitFor();
  await playExample.selectOption('tracking');
  assert.equal(await playView.inputValue(),'data');
  assert.match(await playSource.inputValue(),/Parcel API/);
  await landing.getByRole('button',{name:'Reset',exact:true}).click();
  assert.equal(await playSource.inputValue(),originalLandingSource);
  const [landingDownload]=await Promise.all([
    landing.waitForEvent('download'),
    landing.getByRole('button',{name:'Download SVG'}).click()
  ]);
  assert.equal(landingDownload.suggestedFilename(),'overview.svg');
  assert.match(await readFile(await landingDownload.path(),'utf8'),/^<svg/);
  await landing.setViewportSize({width:360,height:820});
  await landing.reload();
  await landing.locator('#play-preview svg').waitFor();
  assert.ok(await landing.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await landing.screenshot({path:'test-results/landing-mobile.png',fullPage:true});
  await landing.goto(pathToFileURL(path.resolve('index.html')).href);
  await landing.locator('#play-preview svg').waitFor();
  assert.deepEqual(landingErrors,[]);
  await landing.close();
  console.log('✓ Landing page, live editor, view presets, SVG export, mobile layout, and offline launch');

  const page = await browser.newPage({ viewport: { width: 1536, height: 1050 }, deviceScaleFactor: 1 });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(new URL('studio.html',address).href); await page.waitForSelector('#diagram svg');
  assert.ok(requests.some(url => new URL(url).pathname === '/arch.min.js'));
  assert.ok(requests.every(url => new URL(url).pathname !== '/arch.core.min.js'));
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#diagram [data-node]').count(), 8);
  assert.equal(await page.locator('#examples').getAttribute('aria-label'),'Models');
  assert.match(await page.locator('.examples-label').last().textContent(),/^MODELS /);
  const paneControls = page.getByRole('group',{name:'Pane layout'});
  const divider = page.getByRole('separator',{name:'Resize editor and preview'});
  const editor = page.locator('#source-panel'), preview = page.locator('#preview-panel');
  const initialSourceWidth = (await editor.boundingBox()).width;
  const editorContents = await page.locator('#source').inputValue();
  const handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2,handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 140,handle.y + handle.height / 2,{steps:4});
  await page.mouse.up();
  assert.ok((await editor.boundingBox()).width > initialSourceWidth + 130);
  assert.equal(await divider.getAttribute('aria-orientation'),'vertical');
  await divider.press('ArrowLeft');
  const resizedWidth = (await editor.boundingBox()).width;
  assert.ok(Math.abs(resizedWidth - (initialSourceWidth + 124)) < 2);
  await paneControls.getByRole('button',{name:'Editor',exact:true}).click();
  assert.equal(await preview.isVisible(),false);
  assert.equal(await divider.isVisible(),false);
  assert.equal((await editor.boundingBox()).width,(await page.locator('#studio-body').boundingBox()).width);
  await paneControls.getByRole('button',{name:'Preview',exact:true}).click();
  assert.equal(await editor.isVisible(),false);
  assert.equal(await preview.isVisible(),true);
  await paneControls.getByRole('button',{name:'Both',exact:true}).click();
  assert.equal(await editor.isVisible(),true);
  assert.equal(await divider.isVisible(),true);
  assert.ok(Math.abs((await editor.boundingBox()).width - resizedWidth) < 1);
  assert.equal(await page.locator('#source').inputValue(),editorContents);
  await divider.press('End');
  assert.equal(await divider.getAttribute('aria-valuenow'),await divider.getAttribute('aria-valuemax'));
  assert.ok(await preview.locator('.preview-toolbar').evaluate(toolbar=>toolbar.scrollWidth<=toolbar.clientWidth));
  await divider.dblclick();
  assert.equal((await editor.boundingBox()).width,initialSourceWidth);
  console.log('✓ Studio desktop panes resize with pointer and keyboard and keep the split when toggled');
  const namedColors=JSON.parse(await readFile('src/css3-colors.js','utf8').then(s=>s.slice(s.indexOf('{'),s.lastIndexOf('}')+1)));
  const mismatches=await page.evaluate(colors=>{
    const ctx=document.createElement('canvas').getContext('2d');
    return Object.entries(colors).filter(([name,hex])=>{ctx.fillStyle='#123456';ctx.fillStyle=name.toUpperCase();return ctx.fillStyle!==hex;});
  },namedColors);
  assert.deepEqual(mismatches,[],'All CSS3 names agree with Chromium');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  console.log('✓ Desktop launch, local resources and initial SVG');

  const backgrounds = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const solid = (color, width, height) => {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png');
    };
    const blue = solid('#0000ff', 20, 10);
    const red = solid('#ff0000', 10, 20);
    const source = show => `architecture "Images" {
      model { process card "Card" { backgroundImage "${red}" } }
      view example "Example" {
        backgroundImage "${blue}"
        showBackgroundImage ${show}
      }
    }`;
    const host = document.createElement('div');
    document.body.append(host);
    const root = arch.render(host, source(true));
    const { bounds, nodes:[card] } = arch.layout(source(true));
    const render = async svg => {
      const image = new Image();
      image.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
      await image.decode();
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixel = (x, y) => Array.from(context.getImageData(x-bounds.x, y-bounds.y, 1, 1).data);
      return {
        canvas:pixel(bounds.x+5, bounds.y+5),
        card:pixel(card.x+20, card.y+80),
        notch:pixel(card.x+3, card.y+48)
      };
    };
    const visible = await render(new XMLSerializer().serializeToString(root));
    const hidden = await render(arch.renderToString(source(false)));
    const icons = root.querySelectorAll('[data-icon]').length;
    host.remove();
    return { visible, hidden, icons };
  });
  assert.deepEqual(backgrounds.visible.canvas, backgrounds.hidden.canvas);
  assert.ok(backgrounds.visible.canvas[2] > backgrounds.visible.canvas[0] + 60, 'the view background paints across the SVG canvas');
  assert.ok(backgrounds.visible.card[0] > backgrounds.visible.card[1] + 50, 'the exported card contains its embedded background image');
  assert.deepEqual(backgrounds.hidden.card, [255,255,255,255]);
  assert.deepEqual(backgrounds.visible.notch, backgrounds.hidden.notch, 'the image is clipped to the process shape');
  assert.equal(backgrounds.icons, 1);
  console.log('✓ View and card backgrounds rasterize in standalone SVG; card image is clipped and icon remains visible');

  const canvasColors = await page.evaluate(async () => {
    const source = `architecture "View backgrounds" {
      config { views all backgroundColor "#e8eef7" }
      model { system card "Card" }
      view solid "Solid" { backgroundColor gold }
      view clear "Clear" { backgroundColor transparent }
    }`;
    const {graph, svg} = arch.renderDiagram(source);
    const image = new Image();
    image.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixel = (x, y) => Array.from(context.getImageData(x, y, 1, 1).data);
    const [solid,clear] = graph.sections;
    return [pixel(5,5), pixel(solid.x+5,solid.y+solid.headingHeight+5), pixel(clear.x+5,clear.y+clear.headingHeight+5)];
  });
  assert.deepEqual(canvasColors, [[232,238,247,255], [255,215,0,255], [0,0,0,0]]);
  console.log('✓ Stacked SVGs rasterize the global and view colors and retain transparent canvases');

  await page.locator('[data-example="help"]').click();
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.equal(await page.locator('#diagram [data-arch-help="overview"]').count(), 1);
  assert.equal(await page.locator('#view-select').inputValue(), 'help');
  await page.screenshot({ path: 'test-results/help.png', fullPage: true });
  const helpChecks = await page.evaluate(() => {
    const issues = [], host = document.createElement('div'); document.body.append(host);
    const queries = ['', 'syntax', 'model', 'profiles', 'types uaf Capability', 'types uaf OperationalAgent', 'relations uaf Implements', 'connections uaf OperationalPerformer', 'viewpoints naf4-uaf C1', 'profiles naf41-uaf', 'viewpoints naf41-uaf C7', 'types naf41-uaf Needline', 'connections naf41-uaf OperationalPerformer', 'iconpacks lucide cloud', 'iconpacks tabler "*" 2', 'diagrams', 'views', 'routing', 'styles', 'colors', 'templates', 'config', 'api'];
    arch.registerProfile('wide_help', { title: '界'.repeat(300), nodeTypes: { ['Long'.repeat(80)]: { attributes: { note: { enum: ['🙂界'.repeat(200)] } } } } });
    queries.push('profiles wide_help', 'types wide_help ' + 'Long'.repeat(80), 'aliases naf41-uaf', 'mappings naf41-uaf', 'types naf41-uaf@4.1.0-arch.33 Service', 'types naf41-uaf Node', 'types naf41-uaf PhysicalActiveResource', 'relations naf41-uaf ServiceAggregation', 'types naf41-uaf ServiceOperation', 'types naf41-uaf DataProductType', 'viewpoints naf41-uaf S3');
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
  const aliasChecks=await page.evaluate(()=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    const source='architecture "Mixed service names" {config {profile "naf41-uaf@4.1.0-arch.33"} model {ServiceSpecification general "General service" Service specialized "Specialized service" relation kind specialized -> general "is a kind of" {type ServiceGeneralization}} view s1 "S1" {viewpoint S1 diagram tree}}';
    for(const theme of ['light','dark']) {
      const svg=arch.render(host,source,{theme});
      if(svg.querySelector('[data-node="specialized"]')?.getAttribute('data-type')!=='Service')issues.push('Written node type lost');
      if(!svg.textContent.includes('ServiceSpecification')||!svg.textContent.includes('Service'))issues.push('Written stereotypes lost');
      if(arch.renderToString(source,{theme,idPrefix:'alias-roundtrip'})!==arch.renderToString(arch.translate(source),{theme,idPrefix:'alias-roundtrip'}))issues.push('Alias JSON roundtrip changed SVG');
      for(const text of svg.querySelectorAll('text')) {
        const box=text.getBBox(),bounds=svg.viewBox.baseVal;
        if(box.x<bounds.x||box.y<bounds.y||box.x+box.width>bounds.x+bounds.width||box.y+box.height>bounds.y+bounds.height)issues.push('Alias label clipped');
      }
    }
    host.remove();return issues;
  });
  assert.deepEqual(aliasChecks,[],'Version-pinned mixed Service vocabulary, source preservation, JSON and themes');
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

  const helpLink = query => page.locator('#diagram svg a[data-arch-help-query='+JSON.stringify(query)+']').first();
  const helpBack=page.locator('#diagram svg a[data-arch-help-action=back]');
  const helpForward=page.locator('#diagram svg a[data-arch-help-action=forward]');
  await helpLink('profiles').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('#diagram svg[data-arch-help=profiles]');
  await helpLink('profiles naf41-uaf').click();
  await helpLink('viewpoints naf41-uaf').click();
  await helpLink('viewpoints naf41-uaf P6').click();
  assert.match(await page.locator('#diagram svg').textContent(), /Representation/);
  await helpLink('relations naf41-uaf ResourceSequenceInteraction').click();
  await page.waitForSelector('#diagram svg[data-arch-help=relations]');
  await page.goBack();
  await page.waitForSelector('#diagram svg[data-arch-help=viewpoints]');
  await page.goForward();
  await page.waitForSelector('#diagram svg[data-arch-help=relations]');
  await helpBack.click();
  await page.waitForSelector('#diagram svg[data-arch-help=viewpoints]');
  await helpForward.click();
  await page.waitForSelector('#diagram svg[data-arch-help=relations]');
  assert.equal(await page.locator('#source').inputValue(),'@help');
  const priorHelpTheme=await page.locator('#diagram svg').getAttribute('data-arch-svg');
  await page.locator('#toggle-theme').click();
  assert.equal(await page.locator('#diagram svg').getAttribute('data-arch-svg'),priorHelpTheme==='dark'?'light':'dark');
  assert.equal(await page.locator('#diagram svg').getAttribute('data-arch-help'),'relations');
  await helpLink('types naf41-uaf ResourceLifeline').click();
  await page.waitForSelector('#diagram svg[data-arch-help=types]');
  await helpLink('').click();
  await page.waitForSelector('#diagram svg[data-arch-help=overview]');
  assert.equal(await helpForward.count(),0);
  await page.screenshot({path:'test-results/help-navigation.png',fullPage:true});
  const separateHelp=await browser.newPage();
  await separateHelp.goto(new URL('?help=viewpoints+naf41-uaf+P6',address).href);
  await separateHelp.waitForSelector('#diagram svg[data-arch-help=viewpoints]');
  await separateHelp.close();
  const inlineHelpLinks = await page.evaluate(()=>{
    const host=document.createElement('div');
    document.body.append(host);
    const first=document.createElement('div'),second=document.createElement('div');
    host.append(first,second);
    const render=(target,type)=>arch.render(target,`architecture "Help" {
      config { type ${type} {} }
      @help types .
    }`);
    render(first,'Alpha');
    render(second,'Beta');
    first.querySelector('a[data-arch-help-query="types . Alpha"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const independent=first.querySelector('a[data-arch-help-action=back]')!==null&&
      second.querySelector('a[data-arch-help-action=back]')===null;
    first.querySelector('a[data-arch-help-action=back]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const forward=first.querySelector('a[data-arch-help-action=forward]')!==null;
    host.remove();
    return independent&&forward;
  });
  assert.equal(inlineHelpLinks,true,'Inline-profile help blocks preserve their own histories');
  console.log('✓ Clickable help landing page, cross-references, keyboard, Back/Forward, inline profiles and deep links');
  await page.locator('#toggle-theme').click();

  const overflow = [];
  for (const id of ['platform', 'manual', 'capabilities', 'iconpacks', 'profiles', 'external-profile', 'uaf', 'taxonomy', 'minimal']) {
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

  const swimlaneIssues = await page.evaluate(() => {
    const host = document.createElement('div');
    document.body.append(host);
    const issues = [];
    const routes = [
      ['', [175,175,175,207.5,505,207.5,505,240]],
      ['via (vessel.right + 24, report.bottom + 46), (log.centerX, report.bottom + 46)', [175,175,175,221,379,221,505,221,505,240]],
      ['from bottom 1/4 to top 3/4 via (report.x + report.width / 4, report.bottom + 46), (log.x + log.width * 3/4, report.bottom + 46)', [120,175,120,221,560,221,560,240]],
      ['from right to top', [285,135,505,135,505,240]],
      ['from top to bottom', [175,95,175,79,340,79,340,336,505,336,505,320]],
      ['from right to top', [285,135,505,135,505,240], true],
    ];
    for (const theme of ['light', 'dark']) for (const [route,expected,flow] of routes) {
      const report = 'item report "Reports Problem" { owner vessel }';
      const log = 'item log "Log Distress" { owner centre }';
      const svg = arch.render(host, `architecture "Handover" {
        config { type item { attribute owner { type reference targets item } } relation link { style flow activityFlow ${!!flow} } defaultRelation link }
        model {
          item vessel "Vessel in Distress"
          item centre "Regional Coordination Center"
          ${(flow ? [log,report] : [report,log]).join('\n')}
          relation handover report -> log "Operational Control Flow"
        }
        view v "L4" {
          diagram activity { lanes [vessel, centre] laneAttribute owner }
          ${route ? `route handover { ${route} }` : ''}
        }
      }`, {theme});
      const divider = svg.querySelector('[data-swimlane-dividers] path:nth-child(2)');
      const lane = svg.querySelector('[data-node="centre"] rect').getBBox();
      const numbers = path => path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
      const sections = numbers(divider);
      const edge = svg.querySelector('[data-edge="handover"]');
      const coordinates = numbers(edge.querySelector('path'));
      if (coordinates.join() !== expected.join()) issues.push('The flow misses an automatic anchor or a manual waypoint');
      const label = edge.querySelector('rect').getBBox();
      const text = edge.querySelector('text').getBBox();
      const x = label.x+label.width/2, y = label.y+label.height/2;
      const between = (v,a,b) => v >= Math.min(a,b)-0.01 && v <= Math.max(a,b)+0.01;
      let onEdge = false;
      const crossings = [];
      for (let i=2;i<coordinates.length;i+=2) {
        const [ax,ay,bx,by]=coordinates.slice(i-2,i+2);
        if (between(x,ax,bx) && between(y,ay,by)) onEdge=true;
        if (ay === by && between(lane.x,ax,bx)) crossings.push(ay);
      }
      if (!onEdge) issues.push('The center of the label is off the flow');
      if (label.x < lane.x && label.x + label.width > lane.x) issues.push('Label overlaps the lane boundary');
      if (text.x < label.x || text.x + text.width > label.x + label.width || text.y < label.y || text.y + text.height > label.y + label.height)
        issues.push('Text overflows the label box');
      for (let i = 0; i < sections.length; i += 3) {
        if (sections[i] !== lane.x || crossings.some(y=>between(y,sections[i+1],sections[i+2])))
          issues.push('Divider crosses the flow');
      }
    }
    host.remove();
    return issues;
  });
  assert.deepEqual(swimlaneIssues, []);
  console.log('✓ Profile-driven swimlane order, elbow routing and on-path labels in both themes');

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
  assert.match(await page.locator('#error').innerText(), /Unknown viewpoint: landscape/);
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
  const pairNotice=page.locator('#diagram .arch-syntax-notices[aria-label="Type errors"]');
  await pairNotice.waitFor();
  assert.match(await pairNotice.textContent(), /Type combination Function → Capability/);
  assert.equal(await page.locator('#diagram [data-edge="implementsActivity"]').count(),0);
  await page.locator('#source').fill(uafSource); await page.locator('#render-button').click();
  await pairNotice.waitFor({state:'detached'});
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
  const rendererExamples = ['naf41-resource-viewpoints','naf41-foundation-viewpoints','naf41-interactions-cutout'];
  const rendererGallery=await browser.newPage({viewport:{width:1800,height:1200}});
  for(const name of rendererExamples) {
    const views = await page.evaluate(name=>{
      const source=ARCH_EXAMPLES.find(example=>example.id===name).source;
      return arch.parse(source).views.flatMap(view=>['light','dark'].map(theme=>({
        id:view.id, theme, svg:arch.renderToString(source,{view:view.id,theme})
      })));
    },name);
    for(const {id,theme,svg} of views) {
      await rendererGallery.setContent(svg);
      const root=rendererGallery.locator('svg');
      const clipped=await root.evaluate(svg=>{
        const b=svg.viewBox.baseVal;
        return [...svg.querySelectorAll('text')].filter(text=>!text.closest('defs')).flatMap(text=>{
          const r=text.getBBox();
          return r.x<b.x-1||r.y<b.y-1||r.x+r.width>b.x+b.width+1||r.y+r.height>b.y+b.height+1?[text.textContent]:[];
        });
      });
      assert.deepEqual(clipped,[],`${name}/${id}/${theme}`);
      await root.screenshot({path:`test-results/coverage-${id}-${theme}.png`});
    }
  }
  await rendererGallery.close();
  console.log('✓ Physical, foundation and interaction examples checked and captured in both themes');
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
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.match(await page.locator('#diagram .arch-syntax-notices').textContent(), /CharacterizesCapability/);
  assert.equal(await page.locator('#diagram [data-edge="criterion"]').count(),0);
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
  const dockingIssues=await page.evaluate(()=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    const profile={nodeTypes:{actor:{template:'person'},item:{template:'artifact'}},relationTypes:{flow:{from:['actor'],to:['actor'],attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
    const port=(box,side,p)=>({top:{x:box.x+box.width*p,y:box.y},bottom:{x:box.x+box.width*p,y:box.y+box.height},left:{x:box.x,y:box.y+box.height*p},right:{x:box.x+box.width,y:box.y+box.height*p}})[side];
    const check=(actual,expected,name)=>{if(Math.hypot(actual.x-expected.x,actual.y-expected.y)>.02)issues.push(name);};
    for(const from of ['top','right','bottom','left'])for(const to of ['top','right','bottom','left'])for(const theme of ['light','dark']) {
      const source=`architecture "Ports" {model {actor a "A" actor b "B" item data "Data" relation e a -> b "Carries" {type flow payload [data]}}
        view v "Ports" {place a at (0,0) place b at (600,300) place data at (350,-240)
        route e {from ${from} 1/4 to ${to} 3/4 curve rounded}
        route data -> e {from ${from} 1/4 to (data.centerX-a.x)/(b.right-a.x) curve rounded}}}`;
      const model=arch.parse(source,{profile}),graph=arch.layout(model),svg=arch.render(host,model,{theme});
      const edge=svg.querySelector('[data-edge="e"] > path'),reference=svg.querySelector('.arch-reference-connector');
      const expectedStart=port(graph.nodes.find(n=>n.id==='a'),from,.25),expectedEnd=port(graph.nodes.find(n=>n.id==='b'),to,.75);
      check(edge.getPointAtLength(0),expectedStart,`source ${from}/${to}/${theme}`);
      check(edge.getPointAtLength(edge.getTotalLength()),expectedEnd,`target ${from}/${to}/${theme}`);
      check(reference.getPointAtLength(0),port(graph.referenceNodes[0].node,from,.25),`reference source ${from}/${theme}`);
      check(reference.getPointAtLength(reference.getTotalLength()),graph.referenceNodes[0].anchor,`reference target ${to}/${theme}`);
      const [a,b,data]=['a','b','data'].map(id=>graph.nodes.find(n=>n.id===id));
      if(graph.referenceNodes[0].route.to!==(data.x+data.width/2-a.x)/(b.x+b.width-a.x))issues.push('Calculated reference fraction changed');
      const json=arch.translate(source,{format:'json'});
      const restored=arch.layout(arch.parse(json,{profile}));
      if(restored.edges[0].d!==graph.edges[0].d||restored.referenceNodes[0].d!==graph.referenceNodes[0].d)issues.push('JSON endpoint changed');
    }
    host.remove();return issues;
  });
  assert.deepEqual(dockingIssues,[],'All positioned side ports and fractional reference targets render at their requested SVG coordinates');
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

  const goalTaxonomy=await readFile('tests/fixtures/naf41/goal-taxonomy.arch','utf8');
  const goalC2=naf41Document('C2',naf41Cases.C2.replace('EnterpriseGoal goal "Save lives"','Goal goal "Increase Coverage"')+
    ' Goal response "Improve Response Times" Goal manpower "Reduce Manpower"'+
    ' relation responseGoal vision -> response "Specifies" {type SpecifiesGoal} relation manpowerGoal vision -> manpower "Specifies" {type SpecifiesGoal}');
  const goalIssues=await page.evaluate(sources=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const [index,source]of sources.entries())for(const theme of ['light','dark']) {
      if(!arch.validate(source,{validation:'strict'}).valid)issues.push(`Invalid Goal source: ${index}`);
      const svg=arch.render(host,source,{theme});
      if(index===0&&svg.querySelectorAll('[data-node]').length!==6)issues.push('C1 projected the wrong elements');
      if(index===1&&svg.querySelectorAll('[data-type="Goal"]').length!==3)issues.push('C2 Goal nodes missing');
    }
    if(!arch.help('types naf41-uaf Goal').includes('EnterpriseGoal')||!arch.help('connections naf41-uaf Goal').includes('SpecifiesGoal'))issues.push('Goal help is missing the inherited mapping');
    host.remove();return issues;
  },[goalTaxonomy,goalC2]);
  assert.deepEqual(goalIssues,[]);
  await page.locator('#source').fill(goalTaxonomy);await page.locator('#render-button').click();assert.equal(await page.locator('#error').isVisible(),false);
  await page.screenshot({path:'test-results/naf41-goal-taxonomy.png',fullPage:true});
  console.log('✓ NAF Goal vocabulary adapter: three C2 goals, inherited rules/help and original C1 tree in both themes');

  const c2VisionSource=await readFile('examples/naf41-enterprise-vision.arch','utf8');
  const c2VisionIssues=await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const view of ['grouped','positioned','relative','tree','source']) {
      const report=arch.validate(source,{validation:'strict'});if(!report.valid)issues.push(...report.diagnostics.map(d=>d.message));
      const graph=arch.layout(source,{view,theme}),svg=arch.render(host,source,{view,theme});
      if(svg.querySelectorAll('.arch-node').length!==6||svg.querySelectorAll('.arch-edge').length!==5)issues.push('Incomplete C2 view');
      if(view==='tree') {
        if(graph.tree.roots.join(',')!=='horizon')issues.push('C2 tree root is not the enterprise phase');
        if(graph.nodes.find(n=>n.id==='vision').treeParent!=='horizon')issues.push('Vision was not assigned to its phase');
        for(const id of ['maritime','manpower','coverage','response'])if(graph.nodes.find(n=>n.id===id).treeParent!=='vision')issues.push(`Incorrect vision child: ${id}`);
      }
      if(view==='grouped'||view==='positioned'||view==='relative') {
        const group=graph.treeGroups[0],byId=new Map(graph.nodes.map(n=>[n.id,n])),vision=byId.get('vision'),maritime=byId.get('maritime');
        if(group.orientation!=='up'||group.nodes.includes('maritime'))issues.push('Wrong C2 tree membership/direction');
        if(!(byId.get('horizon').y>vision.y&&vision.y>byId.get('coverage').y))issues.push('C2 group does not grow upward');
        if(view==='grouped'&&!(maritime.x+maritime.width<group.bounds.x&&maritime.y+maritime.height/2===vision.y+vision.height/2))issues.push('Automatic C2 context placement failed');
        if(view==='positioned'&&(group.bounds.x!==300||maritime.x!==0||maritime.y!==250))issues.push('Explicit C2 group/context placement failed');
        if(view==='relative'&&(maritime.x!==group.bounds.x-maritime.width-80||maritime.y+maritime.height/2!==vision.y+vision.height/2))issues.push('Relative C2 group/member placement failed');
        const json=arch.translate(source);if(arch.renderToString(json,{view,theme,idPrefix:'same'})!==arch.renderToString(source,{view,theme,idPrefix:'same'}))issues.push('Tree group JSON differs');
        for(const n of graph.nodes) {
          const card=svg.querySelector(`[data-node="${n.id}"]`);
          for(const text of card.querySelectorAll('text')){const b=text.getBBox();if(b.x<0||b.y<0||b.x+b.width>n.width+1||b.y+b.height>n.height+1)issues.push(`C2 card text overflow: ${n.id}`);}
        }
      }
      const bounds=svg.viewBox.baseVal;
      for(const group of svg.querySelectorAll('.arch-node,.arch-edge-label')) {const box=group.getBBox();if(group.classList.contains('arch-edge-label')&&(box.x<bounds.x||box.y<bounds.y||box.x+box.width>bounds.x+bounds.width+1||box.y+box.height>bounds.y+bounds.height+1))issues.push('C2 label clipped');}
    }
    const symbolic='architecture "Offsets" {model{service a "A" service b "B" relation flow a -> b "Flow"}view v "V"{place a at (b.right + 20 * 2,b.centerY - a.height / 2 - 20) place b at (100,200)}}';
    for(const theme of ['light','dark']) {
      const graph=arch.layout(symbolic),a=graph.nodes.find(n=>n.id==='a'),b=graph.nodes.find(n=>n.id==='b'),svg=arch.render(host,symbolic,{theme});
      if(a.x!==b.x+b.width+40||a.y!==b.y-20)issues.push('Coordinate arithmetic failed');
      if(svg.querySelector('[data-node="a"]').getAttribute('transform')!==`translate(${a.x} ${a.y})`)issues.push('Resolved SVG translation differs');
    }
    const cycle=arch.validate(symbolic.replace('place b at (100,200)','place b at (a.x,200)'));
    if(cycle.valid||!cycle.diagnostics[0].message.includes('Circular placement dependency'))issues.push('Missing coordinate cycle diagnostic');
    try {arch.layout(symbolic.replace('a.height / 2','a.height / 0'));issues.push('Division by zero was accepted');}catch(error){if(!error.message.includes('Division by zero'))issues.push(error.message);}
    const compact='architecture "Compact coordinates" {model{service service_situationInformationConsolidation "Situation" service doc "Document" relation edge service_situationInformationConsolidation -> doc "Link"}view v "V"{place service_situationInformationConsolidation at (400,300) place doc at(service_situationInformationConsolidation.x+service_situationInformationConsolidation.width,service_situationInformationConsolidation.y-service_situationInformationConsolidation.height) route edge {curve straight via(service_situationInformationConsolidation.x-service_situationInformationConsolidation.width,service_situationInformationConsolidation.y-service_situationInformationConsolidation.height)}}}';
    for(const theme of ['light','dark']) {
      const graph=arch.layout(compact),node=graph.nodes.find(n=>n.id==='doc'),svg=arch.render(host,compact,{theme});
      if(node.x!==620||node.y!==204)issues.push('Compact placement subtraction failed');
      if(graph.edges[0].points[1].x!==180||graph.edges[0].points[1].y!==204)issues.push('Compact via subtraction failed');
      if(svg.querySelector('[data-node="doc"]').getAttribute('transform')!=='translate(620 204)')issues.push('Compact SVG placement differs');
      if(arch.renderToString(arch.translate(compact),{theme,idPrefix:'compact'})!==arch.renderToString(compact,{theme,idPrefix:'compact'}))issues.push('Compact coordinate JSON differs');
    }
    host.remove();return issues;
  },c2VisionSource);
  assert.deepEqual(c2VisionIssues,[]);
  await page.locator('#source').fill(c2VisionSource);await page.locator('#render-button').click();assert.equal(await page.locator('#error').isVisible(),false);
  await page.selectOption('#view-select','grouped');await page.screenshot({path:'test-results/naf41-c2-grouped.png',fullPage:true});
  const groupExport=await page.evaluate(source=>arch.renderToString(source,{view:'grouped',idPrefix:'group-export'}),c2VisionSource);
  const groupPage=await browser.newPage({viewport:{width:1300,height:950}});await groupPage.setContent(groupExport);await groupPage.locator('svg').screenshot({path:'test-results/naf41-c2-grouped-export.png'});await groupPage.close();
  await page.selectOption('#view-select','positioned');await page.screenshot({path:'test-results/naf41-c2-positioned.png',fullPage:true});
  await page.selectOption('#view-select','relative');await page.screenshot({path:'test-results/naf41-c2-relative.png',fullPage:true});
  await page.selectOption('#view-select','tree');await page.screenshot({path:'test-results/naf41-c2-tree.png',fullPage:true});
  await page.selectOption('#view-select','source');await page.screenshot({path:'test-results/naf41-c2-source.png',fullPage:true});
  console.log('✓ C2 desires: upward tree groups, automatic/manual/relative context, coordinate arithmetic/cycles, JSON, both themes and SVG export');

  const c3Context=await readFile('tests/fixtures/naf41/c3-specialization.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const report=arch.validate(source);if(!report.valid||report.diagnostics.length)issues.push('C3 specialization context rejected');
      const svg=arch.render(host,source,{theme});if(svg.querySelectorAll('.arch-node').length!==5||svg.querySelectorAll('.arch-edge').length!==4||svg.querySelector('.arch-validation-notices'))issues.push('C3 rendering is incomplete or has spurious notices');
    }
    host.remove();return issues;
  },c3Context),[]);
  console.log('✓ C3 specialization context: SAR has no dependency requirement; strict validation and both themes render without notices');

  const c7Effectiveness=await readFile('tests/fixtures/naf41/c7-effectiveness.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const renderer of ['connected','class']) {
      const input=source.replace('viewpoint C7',`viewpoint C7 diagram ${renderer}`),report=arch.validate(input);
      if(!report.valid||report.diagnostics.length)issues.push('Optional C7 effectiveness rejected');
      const graph=arch.layout(input),svg=arch.render(host,input,{theme});
      if(graph.nodes.length!==8||graph.edges.length!==7||svg.querySelector('.arch-validation-notices'))issues.push('C7 rendering is incomplete or has false notices');
      if(!svg.querySelector('[data-node="timeToFind"]')?.textContent.includes('Time to find'))issues.push('C7 effectiveness missing');
    }
    const orphan=source.replace(/relation seaCharacterizes [^}]*}/,'');
    if(arch.validate(orphan).valid)issues.push('Ordinary C7 criterion lost its required characterization');
    host.remove();return issues;
  },c7Effectiveness),[]);
  console.log('✓ C7 optional effectiveness: p.99 fixture validates and renders in both card styles/themes; ordinary criteria stay required');

  const s1Source=await readFile('examples/naf41-service-taxonomy.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const report=arch.validate(source),graph=arch.layout(source),svg=arch.render(host,source,{theme});
      if(!report.valid||report.diagnostics.length)issues.push('S1 Service vocabulary rejected');
      if(svg.querySelectorAll('.arch-node').length!==5||svg.querySelectorAll('.arch-edge').length!==4)issues.push('S1 sample content missing');
      const policy=graph.edges.find(e=>e.id==='s1.4');
      if(policy?.source!=='service_inshoreRescue'||policy?.target!=='policy_inMissionOperation'||policy?.type!=='SatisfiesServicePolicy')issues.push('S1 policy direction differs');
      if(graph.treeGroups[0].roots.join(',')!=='service_maritimeRescue'||graph.sharedPaths?.[0].edgeIds.join(',')!=='s1.1,s1.2,s1.3')issues.push('S1 specialization tree/sharing differs');
      const cards=[...svg.querySelectorAll('.arch-node')].map(e=>e.getBoundingClientRect()),labels=[...svg.querySelectorAll('.arch-edge-label > rect')].map(e=>e.getBoundingClientRect());
      const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      if(labels.some(a=>cards.some(b=>overlaps(a,b))))issues.push('S1 label/card overlap');
      const bounds=svg.viewBox.baseVal;
      for(const text of svg.querySelectorAll('text')) {
        const box=text.getBBox(),matrix=svg.getCTM().inverse().multiply(text.getCTM());
        for(const [x,y]of [[box.x,box.y],[box.x+box.width,box.y+box.height]]) {
          const p=new DOMPoint(x,y).matrixTransform(matrix);if(p.x<bounds.x||p.y<bounds.y||p.x>bounds.x+bounds.width||p.y>bounds.y+bounds.height)issues.push('S1 text exceeds bounds');
        }
      }
      if(arch.renderToString(arch.translate(source),{theme,idPrefix:'s1'})!==arch.renderToString(source,{theme,idPrefix:'s1'}))issues.push('S1 JSON differs');
    }
    host.remove();return issues;
  },s1Source),[]);
  const s1Page=await browser.newPage({viewport:{width:1400,height:1050}});
  for(const theme of ['light','dark']) {
    await s1Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'s1-preview'}),{source:s1Source,theme}));
    await s1Page.locator('svg').screenshot({path:`test-results/naf41-s1-${theme}.png`});
  }
  await s1Page.close();
  await page.locator('[data-example="naf41-service-taxonomy"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ S1 p.105: Service vocabulary, shared specialization, service-to-policy satisfaction, JSON, bounds and both themes');

  const s2Source=await readFile('examples/naf41-service-structure.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const report=arch.validate(source),graph=arch.layout(source),svg=arch.render(host,source,{theme});
      if(!report.valid||report.diagnostics.length)issues.push('S2 source rejected');
      if(svg.querySelectorAll('.arch-node').length!==9||svg.querySelectorAll('.arch-edge').length!==8)issues.push('S2 topology missing');
      if(graph.edges.filter(e=>e.type==='ServiceAggregation'&&e.style==='flow').length!==2)issues.push('S2 aggregation type/notation missing');
      if(svg.querySelector('[data-node="controller"]')?.getAttribute('data-type')!=='Node')issues.push('S2 Node spelling lost');
      const physical=svg.querySelector('[data-node="airTraffic"]');
      if(physical?.getAttribute('data-type')!=='System'||!physical.textContent.includes('PHYSICAL ACTIVE RESOURCE'))issues.push('S2 concrete physical type or category caption missing');
      for(const [id,from,to]of [['consumes','controller','situation'],['enables','getAreaOfInterest','position'],['realizes','airTraffic','situation']]) {
        const edge=graph.edges.find(e=>e.id===id);if(edge.source!==from||edge.target!==to)issues.push(`S2 ${id} direction differs`);
      }
      const cards=[...svg.querySelectorAll('.arch-node')].map(e=>e.getBoundingClientRect()),labels=[...svg.querySelectorAll('.arch-edge-label > rect')].map(e=>e.getBoundingClientRect());
      const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      if(labels.some(a=>cards.some(b=>overlaps(a,b))))issues.push('S2 label/card overlap');
      const bounds=svg.viewBox.baseVal;
      for(const text of svg.querySelectorAll('text')) {
        const box=text.getBBox(),matrix=svg.getCTM().inverse().multiply(text.getCTM());
        for(const [x,y]of [[box.x,box.y],[box.x+box.width,box.y+box.height]]) {
          const p=new DOMPoint(x,y).matrixTransform(matrix);if(p.x<bounds.x||p.y<bounds.y||p.x>bounds.x+bounds.width||p.y>bounds.y+bounds.height)issues.push('S2 text exceeds bounds');
        }
      }
      if(arch.renderToString(arch.translate(source),{theme,idPrefix:'s2'})!==arch.renderToString(source,{theme,idPrefix:'s2'}))issues.push('S2 JSON differs');
    }
    host.remove();return issues;
  },s2Source),[]);
  const s2Page=await browser.newPage({viewport:{width:1600,height:1200}});
  for(const theme of ['light','dark']) {
    await s2Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'s2-preview'}),{source:s2Source,theme}));
    await s2Page.locator('svg').screenshot({path:`test-results/naf41-s2-${theme}.png`});
  }
  await s2Page.close();
  await page.locator('[data-example="naf41-service-structure"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ S2 p.108: Node vocabulary, all nine elements/eight directed links, JSON, bounds and both themes');

  const s3Source=await readFile('examples/naf41-service-interfaces.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const report=arch.validate(source),graph=arch.layout(source),svg=arch.render(host,source,{theme});
      if(!report.valid||report.diagnostics.length)issues.push('S3 source rejected');
      if(svg.querySelectorAll('.arch-node').length!==9||svg.querySelectorAll('.arch-edge').length!==9)issues.push('S3 topology missing');
      if(svg.querySelectorAll('[data-node="geographicLocation"]').length!==1||graph.edges.filter(e=>e.target==='geographicLocation').length!==2)issues.push('S3 shared parameter lost');
      if(svg.querySelector('[data-node="submitLocation"]').getAttribute('data-type')!=='ServiceOperation'||svg.querySelector('[data-node="positionReport"]').getAttribute('data-type')!=='DataProductType')issues.push('S3 source vocabulary lost');
      if(graph.edges.filter(e=>e.type==='HasServiceOperationParameter').length!==4||graph.edges.filter(e=>e.type==='InvolvesPhysicalResource').length!==2)issues.push('S3 parameter links differ');
      const cards=[...svg.querySelectorAll('.arch-node')].map(e=>e.getBoundingClientRect()),labels=[...svg.querySelectorAll('.arch-edge-label > rect')].map(e=>e.getBoundingClientRect());
      const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      if(labels.some(a=>cards.some(b=>overlaps(a,b))))issues.push('S3 label/card overlap');
      const bounds=svg.viewBox.baseVal;
      for(const text of svg.querySelectorAll('text')) {
        const box=text.getBBox(),matrix=svg.getCTM().inverse().multiply(text.getCTM());
        for(const [x,y]of [[box.x,box.y],[box.x+box.width,box.y+box.height]]) {
          const p=new DOMPoint(x,y).matrixTransform(matrix);if(p.x<bounds.x||p.y<bounds.y||p.x>bounds.x+bounds.width||p.y>bounds.y+bounds.height)issues.push('S3 text exceeds bounds');
        }
      }
      if(arch.renderToString(arch.translate(source),{theme,idPrefix:'s3'})!==arch.renderToString(source,{theme,idPrefix:'s3'}))issues.push('S3 JSON differs');
    }
    host.remove();return issues;
  },s3Source),[]);
  const s3Page=await browser.newPage({viewport:{width:1700,height:1600}});
  for(const theme of ['light','dark']) {
    await s3Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'s3-preview'}),{source:s3Source,theme}));
    await s3Page.locator('svg').screenshot({path:`test-results/naf41-s3-${theme}.png`});
  }
  await s3Page.close();
  await page.locator('[data-example="naf41-service-interfaces"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ S3 p.110: operations/data products, shared parameter, optional resource traces, JSON, bounds and both themes');
  const s4Page=await browser.newPage({viewport:{width:1700,height:1300}});
  for(const [name,nodeCount,edgeCount]of [['naf41-service-functions',5,4],['naf41-service-functions-cutout',6,10]]) {
    const source=await readFile(`examples/${name}.arch`,'utf8');
    assert.deepEqual(await page.evaluate(({source,nodeCount,edgeCount})=>{
      const issues=[],host=document.createElement('div');document.body.append(host);
      for(const theme of ['light','dark']) {
        const report=arch.validate(source),svg=arch.render(host,source,{theme}),graph=arch.layout(source);
        if(!report.valid||report.diagnostics.length)issues.push('S4 validation notices');
        if(graph.nodes.length!==nodeCount||graph.edges.length!==edgeCount)issues.push('S4 topology changed');
        if(svg.querySelectorAll('.arch-node').length!==nodeCount||svg.querySelectorAll('.arch-edge').length!==edgeCount)issues.push('S4 SVG topology changed');
        const bounds=svg.viewBox.baseVal;
        for(const text of svg.querySelectorAll('text')) {
          const box=text.getBBox(),matrix=svg.getCTM().inverse().multiply(text.getCTM());
          for(const [x,y]of [[box.x,box.y],[box.x+box.width,box.y+box.height]]) {
            const p=new DOMPoint(x,y).matrixTransform(matrix);if(p.x<bounds.x||p.y<bounds.y||p.x>bounds.x+bounds.width||p.y>bounds.y+bounds.height)issues.push('S4 clipped text');
          }
        }
        if(arch.renderToString(arch.translate(source),{theme,idPrefix:'s4'})!==arch.renderToString(source,{theme,idPrefix:'s4'}))issues.push('S4 JSON differs');
      }
      host.remove();return issues;
    },{source,nodeCount,edgeCount}),[]);
    for(const theme of ['light','dark']) {
      await s4Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'s4-preview'}),{source,theme}));
      await s4Page.locator('svg').screenshot({path:`test-results/${name}-${theme}.png`});
    }
    await page.locator(`[data-example="${name}"]`).click();assert.equal(await page.locator('#error').isVisible(),false);
  }
  await s4Page.close();
  console.log('✓ S4 pp.111–112: complete example/cut-out, recursive coverage, roles, JSON and both themes');
  const s5Page=await browser.newPage({viewport:{width:1800,height:1500}});
  for(const [name,nodeCount,edgeCount]of [['naf41-service-states',5,4],['naf41-service-states-cutout',9,10]]) {
    const source=await readFile(`examples/${name}.arch`,'utf8');
    assert.deepEqual(await page.evaluate(({source,nodeCount,edgeCount})=>{
      const issues=[],host=document.createElement('div');document.body.append(host);
      for(const theme of ['light','dark']) {
        const report=arch.validate(source),svg=arch.render(host,source,{theme}),graph=arch.layout(source);
        if(!report.valid||report.diagnostics.length)issues.push('S5 validation notices');
        if(graph.nodes.length!==nodeCount||graph.edges.length!==edgeCount)issues.push('S5 topology changed');
        if(svg.querySelectorAll('.arch-node').length!==nodeCount||svg.querySelectorAll('.arch-edge').length!==edgeCount)issues.push('S5 SVG topology changed');
        if(svg.querySelectorAll('.arch-reference-connector').length!==1||svg.querySelector('.arch-reference-label')?.textContent!=='is equal to')issues.push('S5 objectification lost');
        const reference=graph.referenceNodes[0],path=svg.querySelector('.arch-reference-connector');
        const end=path.getPointAtLength(path.getTotalLength());
        if(Math.hypot(end.x-reference.anchor.x,end.y-reference.anchor.y)>.1)issues.push('S5 attachment misses transition');
        const bounds=svg.viewBox.baseVal;
        for(const text of svg.querySelectorAll('text')) {
          const box=text.getBBox(),matrix=svg.getCTM().inverse().multiply(text.getCTM());
          for(const [x,y]of [[box.x,box.y],[box.x+box.width,box.y+box.height]]) {
            const p=new DOMPoint(x,y).matrixTransform(matrix);if(p.x<bounds.x||p.y<bounds.y||p.x>bounds.x+bounds.width||p.y>bounds.y+bounds.height)issues.push('S5 clipped text');
          }
        }
        if(arch.renderToString(arch.translate(source),{theme,idPrefix:'s5'})!==arch.renderToString(source,{theme,idPrefix:'s5'}))issues.push('S5 JSON differs');
      }
      host.remove();return issues;
    },{source,nodeCount,edgeCount}),[]);
    for(const theme of ['light','dark']) {
      await s5Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'s5-preview'}),{source,theme}));
      await s5Page.locator('svg').screenshot({path:`test-results/${name}-${theme}.png`});
    }
    await page.locator(`[data-example="${name}"]`).click();assert.equal(await page.locator('#error').isVisible(),false);
  }
  await s5Page.close();
  console.log('✓ S5 pp.114–115: objectified transitions, triggers, captioned/routed references, groups, modes and both themes');

  for (const [file,nodes,edges,labels] of [
    ['naf41-logical-states',8,9,['triggers','triggers','triggers']],
    ['naf41-logical-states-cutout',11,11,['is equal to']],
  ]) {
    const original=await readFile(`examples/${file}.arch`,'utf8');
    const source=original.replace('route searchExit -> secure { from top to 2/5 }',
      'route searchExit -> secure { from top 0.5 to 0.2 label 0.2 sideOffset 24 curve straight }');
    assert.deepEqual(await page.evaluate(({source,nodes,edges,labels})=>{
      const issues=[], host=document.createElement('div');
      document.body.append(host);
      for (const theme of ['light','dark']) {
        const report=arch.validate(source,{validation:'strict'});
        const svg=arch.render(host,source,{theme}), graph=arch.layout(source);
        if (!report.valid || report.diagnostics.length) issues.push('L5 strict validation failed');
        if (svg.querySelectorAll('.arch-node').length!==nodes || svg.querySelectorAll('.arch-edge').length!==edges)
          issues.push('L5 SVG topology differs');
        const connectors=[...svg.querySelectorAll('.arch-reference-connector')];
        const captions=[...svg.querySelectorAll('.arch-reference-label')].map(label=>label.textContent);
        if (connectors.length!==labels.length || captions.join('|')!==labels.join('|')) issues.push('L5 attachments differ');
        for (const connector of connectors) {
          const ref=graph.referenceNodes.find(item=>item.edgeId===connector.dataset.referenceFor && item.nodeId===connector.dataset.referenceNode);
          const point=connector.getPointAtLength(connector.getTotalLength());
          if (!ref || Math.hypot(point.x-ref.anchor.x,point.y-ref.anchor.y)>.1 || !connector.hasAttribute('marker-end'))
            issues.push('L5 arrow misses its transition');
          if (connector.dataset.referenceFor==='secure') {
            const box=svg.querySelector('.arch-reference-label[data-reference-for="secure"]').getBBox();
            const length=connector.getTotalLength(), start=connector.getPointAtLength(0);
            const anchor=connector.getPointAtLength(length*0.2);
            const x=anchor.x+24*(point.y-start.y)/length, y=anchor.y-24*(point.x-start.x)/length;
            if (Math.hypot(box.x+box.width/2-x,box.y+box.height/2-y)>.1)
              issues.push('L5 label misses its side offset from the trigger arrow');
          }
        }
        const secure=graph.edges.find(edge=>edge.id==='secure');
        if (secure) {
          const shiftedSource=source.replace('route secure { from left to right curve straight }',
            'route secure { from left to right curve straight sideOffset -12 }');
          const shiftedSvg=arch.render(host,shiftedSource,{theme});
          const box=shiftedSvg.querySelector('[data-label-for="secure"]').getBBox();
          const [start,end]=secure.points;
          const dx=end.x-start.x, dy=end.y-start.y, length=Math.hypot(dx,dy);
          const x=secure.label.x-12*dy/length, y=secure.label.y+12*dx/length;
          if (Math.hypot(box.x+box.width/2-x,box.y+box.height/2-y)>.1)
            issues.push('L5 standalone sideOffset failed to preserve automatic label spacing');

          const stateSvg=arch.render(host,source,{view:'l5State',theme,validation:'strict'});
          const states=Array.from(stateSvg.querySelectorAll('[data-state]'),node=>node.dataset.state);
          if (states.join(',')!=='waiting,located,inNeed,rescued') issues.push('L5 state view includes context as a state');
          const returnEdges=['noAssistance','secure'].map(id=>stateSvg.querySelector('[data-edge="'+id+'"]'));
          const paths=returnEdges.map(edge=>edge.querySelector('path'));
          const targets=paths.map(path=>path.getPointAtLength(path.getTotalLength()));
          if (targets[0].y===targets[1].y || returnEdges.some(edge=>edge.querySelector('[data-state-event] tspan')?.textContent!=='Search Exit'))
            issues.push('L5 state return transitions lost their own ports or trigger labels');
          const checkEventBadges=svg=>{
            for (const badge of svg.querySelectorAll('[data-state-event]')) {
              const text=badge.querySelector('text').getBBox(), box=badge.querySelector('rect').getBBox();
              if (text.x<box.x || text.x+text.width>box.x+box.width || text.y<box.y || text.y+text.height>box.y+box.height)
                issues.push('L5 event text does not fit inside its badge');
              const leader=badge.querySelector('[data-state-event-connector]');
              const edge=badge.closest('[data-edge]'), path=edge.querySelector('path');
              if (!leader) { issues.push('L5 state event is detached from '+edge.dataset.edge); continue; }
              const x1=leader.x1.baseVal.value, x2=leader.x2.baseVal.value, y=leader.y1.baseVal.value;
              if (!path.isPointInStroke(new DOMPoint(x1,y)) || Math.abs(y-(box.y+box.height/2))>.1 ||
                Math.abs(x2-(x1<x2 ? box.x : box.x+box.width))>.1)
                issues.push('L5 state event connector misses its transition or event field');
            }
          }
          checkEventBadges(stateSvg);
          const dense=source.replace('LogicalEvent searchStart "Search Start"',
            'LogicalEvent searchStart "Search Start after receiving radio confirmation from the operator"')
            .replace('relation receive waiting -> located',
              'relation parallel waiting -> located "Receive duplicate signal" { type LogicalStateTransition event searchStart }\n'+
              '    relation loop rescued -> rescued "Retry by radio" { type LogicalStateTransition event searchStart }\n'+
              '    relation receive waiting -> located');
          const denseSvg=arch.render(host,dense,{view:'l5State',theme,validation:'strict'});
          checkEventBadges(denseSvg);
          const segments=[...denseSvg.querySelectorAll('[data-edge] > path')].flatMap(path=>{
            const points=path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
            const bounds=[];
            for (let i=2;i<points.length;i+=2) bounds.push({
              left:Math.min(points[i-2],points[i])-1, right:Math.max(points[i-2],points[i])+1,
              top:Math.min(points[i-1],points[i+1])-1, bottom:Math.max(points[i-1],points[i+1])+1
            });
            return bounds;
          });
          for (const caption of denseSvg.querySelectorAll('[data-state-event] > rect, [data-edge] > text')) {
            const box=caption.getBBox();
            if (segments.some(segment=>segment.left<box.x+box.width && segment.right>box.x &&
              segment.top<box.y+box.height && segment.bottom>box.y))
              issues.push('L5 state crossing through caption on '+caption.closest('[data-edge]').dataset.edge);
          }
          const virtual=source.replace('LogicalEvent searchExit "Search Exit"','LogicalEvent searchExit "Search Exit"\n    LogicalEvent shutdown "Stop Coordination"')
            .replace('diagram state\n',`diagram state {
              initial virtual start "Start" -> waiting
              final waiting -> virtual end "End" { event shutdown }
            }
            place virtual start at (-100, waiting.y - 90)
            place virtual end at (waiting.right + 300, rescued.bottom + 60)\n`);
          const virtualSvg=arch.render(host,virtual,{view:'l5State',theme,validation:'strict'});
          for (const [id,kind,radius] of [['start','initial',10],['end','final',16]]) {
            const circle=virtualSvg.querySelector('[data-state="'+id+'"][data-virtual] circle');
            const edge=virtualSvg.querySelector('[data-edge="@virtual:'+id+'"] > path');
            const p=edge.getPointAtLength(kind==='initial'?0:edge.getTotalLength());
            if (Math.abs(Math.hypot(p.x-circle.cx.baseVal.value,p.y-circle.cy.baseVal.value)-radius)>.1)
              issues.push('L5 virtual state arrow misses its symbol');
          }
          const vbox=virtualSvg.viewBox.baseVal;
          if (vbox.x>=-100 || !virtualSvg.querySelector('[data-edge="@virtual:end"] [data-state-event]'))
            issues.push('L5 virtual placement or end event is missing');
          const starts=['receive','@virtual:end'].map(id=>virtualSvg.querySelector('[data-edge="'+id+'"] > path').getPointAtLength(0));
          if (starts[0].x===starts[1].x && starts[0].y===starts[1].y)
            issues.push('L5 placed final shares its port with an existing state transition');
          const placed=virtual.replace('place virtual start at (-100, waiting.y - 90)',`place waiting at (0, 0)
            place located at (waiting.x, waiting.bottom + 125)
            place inNeed at (located.right + 220, located.y)
            place rescued at (inNeed.x, waiting.y)
            place virtual start at (waiting.centerX - 10, waiting.y - 95)`)
            .replace('place virtual end at (waiting.right + 300, rescued.bottom + 60)',`place virtual end at (rescued.right + 175, rescued.y + 20)
            route virtual start {
              from left 1/4 to left 1/4
              curve rounded
              via (waiting.x - 60, start.centerY - start.height/4), (waiting.x - 60, waiting.y + waiting.height/4)
            }
            route virtual end {
              from right to right
              curve bezier
              via (waiting.right + 120, waiting.y - 145), (end.right + 170, end.centerY - 230)
            }
            route receive {from bottom 1/4 to top 3/4 curve straight}`);
          const state=arch.render(host,placed,{view:'l5State',theme,validation:'strict'});
          const position=id=>state.querySelector('[data-node="'+id+'"]')?.getAttribute('transform');
          if (position('located')!=='translate(0 193)' || position('rescued')!=='translate(440 0)')
            issues.push('L5 symbolic state positions were not applied');
          const startPath=state.querySelector('[data-edge="@virtual:start"] > path');
          const startPort=startPath.getPointAtLength(0), waitingPort=startPath.getPointAtLength(startPath.getTotalLength());
          if (Math.abs(Math.hypot(startPort.x-110,startPort.y+85)-10)>.01 ||
            waitingPort.x!==0 || waitingPort.y!==17 || !startPath.getAttribute('d').includes('Q -60 17'))
            issues.push('L5 routed start did not hit both ports or round the computed bend');
          const endPath=state.querySelector('[data-edge="@virtual:end"] > path');
          const finalPort=endPath.getPointAtLength(endPath.getTotalLength());
          if (finalPort.x!==867 || finalPort.y!==36 || !endPath.hasAttribute('marker-end') || !endPath.getAttribute('d').includes(' C '))
            issues.push('L5 routed final lost its target port or arrowhead');
          const connector=state.querySelector('[data-edge="@virtual:end"] [data-state-event-connector]');
          const endLength=endPath.getTotalLength();
          let distance=Infinity;
          for (let i=0; i<=endLength; i++) {
            const p=endPath.getPointAtLength(i);
            distance=Math.min(distance,Math.hypot(p.x-connector.x1.baseVal.value,p.y-connector.y1.baseVal.value));
          }
          if (distance>1 || state.querySelector('[data-edge="receive"] > path').getAttribute('d')!=='M 55 68 L 165 193')
            issues.push('L5 curve caption attachment or direct straight route is incorrect');
          const receiveLabel=state.querySelector('[data-edge="receive"] > text').getBBox();
          const diagonalX=y=>55+(y-68)*110/125;
          if (receiveLabel.x<diagonalX(receiveLabel.y+receiveLabel.height) && receiveLabel.x+receiveLabel.width>diagonalX(receiveLabel.y))
            issues.push('L5 straight transition crosses its own caption');
          for (const id of ['assistance','stable','secure']) {
            const edge=state.querySelector('[data-edge="'+id+'"]');
            if (!edge.querySelector(':scope > text tspan')) issues.push('L5 placed state lost its transition title');
          }
        }
      }
      host.remove();
      return issues;
    },{source,nodes,edges,labels}),[]);
  }
  console.log('✓ L5 pp.137–138: ownership, compact triggers and objectified transitions in both themes');

  const s6Page=await browser.newPage({viewport:{width:2100,height:1500}});
  for(const [name,nodeCount,edgeCount,messageCount]of [['naf41-service-sequence',10,9,2],['naf41-service-sequence-cutout',7,7,1]]) {
    const source=await readFile(`examples/${name}.arch`,'utf8');
    assert.deepEqual(await page.evaluate(({source,nodeCount,edgeCount,messageCount})=>{
      const issues=[],host=document.createElement('div');document.body.append(host);
      for(const theme of ['light','dark']) {
        const report=arch.validate(source),svg=arch.render(host,source,{theme});
        if(!report.valid||report.diagnostics.length)issues.push('S6 validation notices');
        if(svg.querySelectorAll('[data-node]').length!==nodeCount||svg.querySelectorAll('[data-edge]').length!==edgeCount)issues.push('S6 topology changed');
        if(svg.querySelectorAll('[data-message]').length!==messageCount||svg.querySelectorAll('.arch-sequence-reference').length!==messageCount)issues.push('S6 objectified message lost');
        const bounds=svg.viewBox.baseVal;
        for(const text of svg.querySelectorAll('text')) {
          const box=text.getBBox(),matrix=svg.getCTM().inverse().multiply(text.getCTM());
          for(const [x,y]of [[box.x,box.y],[box.x+box.width,box.y+box.height]]) {
            const p=new DOMPoint(x,y).matrixTransform(matrix);if(p.x<bounds.x||p.y<bounds.y||p.x>bounds.x+bounds.width||p.y>bounds.y+bounds.height)issues.push('S6 clipped text');
          }
        }
        if(arch.renderToString(arch.translate(source),{theme,idPrefix:'s6'})!==arch.renderToString(source,{theme,idPrefix:'s6'}))issues.push('S6 JSON differs');
      }
      host.remove();return issues;
    },{source,nodeCount,edgeCount,messageCount}),[]);
    for(const theme of ['light','dark']) {
      await s6Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'s6-preview'}),{source,theme}));
      await s6Page.locator('svg').screenshot({path:`test-results/${name}-${theme}.png`});
    }
    await page.locator(`[data-example="${name}"]`).click();assert.equal(await page.locator('#error').isVisible(),false);
  }
  await s6Page.close();
  console.log('✓ S6 pp.117–118: sequence/connected objectification, context links, service timelines, ordering and both themes');

  const roadmapSource=await readFile('examples/naf41-capability-roadmap.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const report=arch.validate(source),graph=arch.layout(source),svg=arch.render(host,source,{theme});
      if(!report.valid||report.diagnostics.length)issues.push('Cr phase relation rejected');
      if(svg.querySelectorAll('.arch-node').length!==6||svg.querySelectorAll('.arch-edge').length!==7||!svg.querySelector('[data-edge="cr.2"][data-type="RelatesToEnterprisePhase"]'))issues.push('Missing Cr sample content');
      if(graph.edges.find(e=>e.id==='cr.2').target!=='enterprisePhase_IOC')issues.push('Increment must relate to IOC in the p.103 sample');
      if(svg.querySelectorAll('[data-type="AggregatesEnterprisePhase"]').length!==3||svg.querySelectorAll('[data-type="TriggersEnterprisePhase"]').length!==2)issues.push('Missing phase grouping/trigger links');
      if(graph.sharedPaths[0]?.edgeIds.join(',')!=='cr.3,cr.4,cr.5')issues.push('Phase aggregate paths are not shared');
      const cards=[...svg.querySelectorAll('.arch-node')].map(el=>el.getBoundingClientRect());
      const labels=[...svg.querySelectorAll('.arch-edge-label > rect')].map(el=>el.getBoundingClientRect());
      const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      if(labels.some(a=>cards.some(b=>overlaps(a,b))))issues.push('Cr label overlaps a card');
      for(let i=0;i<labels.length;i++)if(labels.slice(i+1).some(b=>overlaps(labels[i],b)))issues.push('Cr labels overlap');
      const bounds=svg.viewBox.baseVal;
      for(const node of svg.querySelectorAll('text')) {
        const b=node.getBBox(),transform=node.getCTM(),root=svg.getCTM();
        const matrix=root.inverse().multiply(transform);
        const corners=[[b.x,b.y],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
        if(corners.some(p=>p.x<bounds.x||p.y<bounds.y||p.x>bounds.x+bounds.width||p.y>bounds.y+bounds.height))issues.push('Cr text exceeds viewBox');
      }
      const json=arch.translate(source);
      if(arch.renderToString(json,{theme,idPrefix:'cr'})!==arch.renderToString(source,{theme,idPrefix:'cr'}))issues.push('Cr JSON differs');
      if(/NaN|Infinity|undefined/.test(svg.outerHTML))issues.push('Cr SVG has invalid coordinates');
    }
    host.remove();return issues;
  },roadmapSource),[]);
  const roadmapPage=await browser.newPage({viewport:{width:1900,height:1200}});
  for(const theme of ['light','dark']) {
    await roadmapPage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'cr-preview'}),{source:roadmapSource,theme}));
    await roadmapPage.locator('svg').screenshot({path:`test-results/naf41-cr-${theme}.png`});
  }
  await roadmapPage.close();
  await page.locator('[data-example="naf41-capability-roadmap"]').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#diagram .arch-node').count(),6);
  console.log('✓ Cr p.103: six nodes, seven edges, shared aggregates, triggers, implicit milestones, JSON, bounds and both themes');

  const taxonomySource = await readFile('examples/naf41-resource-taxonomy.arch','utf8');
  const taxonomyPage = await browser.newPage({viewport:{width:1360,height:960}});
  for (const theme of ['light','dark']) {
    const markup = await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,validation:'strict',idPrefix:'p1-preview'}),{source:taxonomySource,theme});
    await taxonomyPage.setContent('<style>body{margin:0}</style>' + markup);
    const svg = taxonomyPage.locator('svg').first();
    assert.equal(await svg.locator('.arch-node').count(),7);
    assert.equal(await svg.locator('.arch-edge').count(),6);
    assert.ok(await svg.locator('.arch-shared-path').count()>0);
    for (const id of ['kindVhf','kindHf'])
      assert.match(await svg.locator(`.arch-edge[data-edge="${id}"] > path`).getAttribute('d'),/ Q /);
    const spine = await svg.locator('[data-shared-part="spine"] > path').getAttribute('d');
    assert.equal(spine.match(/ Q /g)?.length,2);
    await svg.screenshot({path:`test-results/naf41-p1-${theme}.png`});
  }
  await taxonomyPage.close();
  console.log('✓ P1 p.149: shared generalizations and independently positioned context in both themes');

  const styleExpressionsSource=await readFile('examples/style-expressions.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const graph=arch.layout(source),svg=arch.render(host,source,{theme});
      const byId=Object.fromEntries(graph.nodes.map(n=>[n.id,n]));
      if(byId.base.height<=100||byId.measured.height!==2*byId.base.height||byId.minimum.height!==200)issues.push('Measured and explicit heights differ from expressions');
      if(byId.measured.width!==320||byId.minimum.width!==320||byId.measured.fontSize!==18)issues.push('Resolved width/fontSize incorrect');
      if(byId.measured.x!==byId.base.x+byId.base.width+120||byId.minimum.x!==byId.measured.x+byId.measured.width+120)issues.push('Placement did not use computed dimensions');
      for(const card of svg.querySelectorAll('.arch-node')) {
        const id=card.getAttribute('data-node'),node=byId[id];
        for(const text of card.querySelectorAll('text')) {
          const b=text.getBBox();
          if(b.x<0||b.y<0||b.x+b.width>node.width+1||b.y+b.height>node.height+1)issues.push(`Calculated style clips ${id}: ${text.textContent}`);
        }
      }
      if(arch.renderToString(arch.translate(source),{theme,idPrefix:'style-math'})!==arch.renderToString(source,{theme,idPrefix:'style-math'}))issues.push('Computed style JSON differs');
      if(/NaN|Infinity|undefined/.test(svg.outerHTML))issues.push('Invalid calculated SVG coordinates');
    }
    const cycle=source.replace('height 2 * base.height','height measured.height * 2');
    if(arch.validate(cycle).valid||!arch.inspectSource(cycle).diagnostics.some(d=>/Circular style dependency/.test(d.message)))issues.push('Cycle diagnostic missing');
    host.remove();return issues;
  },styleExpressionsSource),[],'Calculated style geometry, placement, text bounds, JSON, themes and cycles');
  const mathStylesPage=await browser.newPage({viewport:{width:1500,height:850}});
  for(const theme of ['light','dark']) {
    await mathStylesPage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'style-math-preview'}),{source:styleExpressionsSource,theme}));
    await mathStylesPage.locator('svg').screenshot({path:`test-results/style-expressions-${theme}.png`});
  }
  await mathStylesPage.close();
  await page.locator('[data-example="style-expressions"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ Calculated node styles: measured/explicit dimensions, fonts, placement, text bounds, JSON, cycles and both themes');

  const placedS6Source=await readFile('examples/naf41-service-sequence-placed.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const graph=arch.layout(source),svg=arch.render(host,source,{theme});
      const edge=graph.edges.find(e=>e.id==='s6.8'),path=svg.querySelector('[data-edge="s6.8"] path');
      if(edge.points.length!==2||edge.points[0].y!==edge.points[1].y||(path.getAttribute('d').match(/ L /g)??[]).length!==1)issues.push('Reverse straight S6 message has a bend');
      const label=svg.querySelector('[data-label-for="s6.8"] rect').getBBox();
      const reference=svg.querySelector('.arch-reference-label[data-reference-for="s6.8"] rect').getBBox();
      if(label.y+label.height>=edge.points[0].y||reference.y-(label.y+label.height)<8)issues.push('Acknowledge and is-equal-to captions lack separation');
      if(arch.renderToString(source,{theme,idPrefix:'placed-s6'})!==arch.renderToString(arch.translate(source),{theme,idPrefix:'placed-s6'}))issues.push('Placed S6 JSON differs');
    }
    host.remove();return issues;
  },placedS6Source),[],'Positioned S6 reply remains straight in SVG and JSON');
  const placedS6Page=await browser.newPage({viewport:{width:1600,height:1300}});
  for(const theme of ['light','dark']) {
    await placedS6Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'placed-s6-preview'}),{source:placedS6Source,theme}));
    await placedS6Page.locator('svg').screenshot({path:`test-results/s6-placed-${theme}.png`});
  }
  await placedS6Page.close();
  await page.locator('[data-example="naf41-service-sequence-placed"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ Positioned S6: calculated lifeline heights, fractional ports and a straight reverse message in both themes');

  const l8CrossingSource=await readFile('examples/naf41-logical-constraints.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[], host=document.createElement('div');
    document.body.append(host);
    for (const theme of ['light','dark']) {
      const svg=arch.render(host,source,{theme});
      const select=(root,id)=>root.querySelector(`[data-edge="${id}"] > path`);
      const bridge=select(svg,'permanentSearch'), crossed=select(svg,'independentC2');
      const hasBridge=path=>/\bA \d/.test(path.getAttribute('d'));
      if (!hasBridge(bridge)||hasBridge(crossed)||svg.querySelectorAll('[data-shared-path]').length!==2)
        issues.push('L8 bridge or shared path is missing');
      const bridgeLength=bridge.getTotalLength();
      const flat=arch.render(host,source.replace('dasharray none','dasharray none crossings none'),{theme});
      const plain=select(flat,'permanentSearch');
      if (hasBridge(plain)||bridgeLength<=plain.getTotalLength())
        issues.push('L8 crossing opt-out or arc length is incorrect');
      const exported=new DOMParser().parseFromString(arch.renderToString(source,{theme}),'image/svg+xml');
      if (select(exported,'permanentSearch').getAttribute('d')!==bridge.getAttribute('d'))
        issues.push('L8 export differs from the browser rendering');
    }
    host.remove();
    return issues;
  },l8CrossingSource),[]);
  console.log('✓ L8 crossing bridges, shared paths, opt-out and SVG export in both themes');

  const reuseSource=await readFile('examples/view-reuse.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const g=arch.layout(source,{view:'embedded'}),svg=arch.render(host,source,{view:'embedded',theme});
      if(g.nodes.length!==5||new Set(g.nodes.map(n=>n.id)).size!==5)issues.push('Embedded cards duplicated');
      if(!svg.querySelector('[data-embed="structure"]'))issues.push('Embed frame missing');
      if(svg.querySelectorAll('[data-node="service"]').length!==1)issues.push('Source card duplicated in SVG');
      if(arch.renderToString(source,{theme,idPrefix:'reuse'})!==arch.renderToString(arch.translate(source),{theme,idPrefix:'reuse'}))issues.push('Reuse JSON differs');
      if(new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelector('parsererror'))issues.push('Invalid composed SVG');
    }
    host.remove();return issues;
  },reuseSource),[],'Embedded/extended views: cards, frame, JSON and themes');
  const reusePage=await browser.newPage({viewport:{width:1500,height:1200}});
  for(const theme of ['light','dark']) {
    await reusePage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{view:'embedded',theme,idPrefix:'reuse-preview'}),{source:reuseSource,theme}));
    await reusePage.locator('svg').screenshot({path:`test-results/view-reuse-${theme}.png`});
  }
  await reusePage.close();
  console.log('✓ View reuse: extends, seamless/framed embeds, outer connections, JSON and themes');

  const overlapping = await page.evaluate(() => {
    const source = `architecture "Overlapping" {
      model { service a "Actor" service b "Recipient" relation e a -> b "Flow" }
      view row "Row" {}
      view host "Host" {
        embed row as sub1
        embed row as sub2
        place sub1 at (0, 0)
        place sub2 at (0, sub1.bottom + 40)
      }
    }`;
    const host = document.createElement('div');
    document.body.append(host);
    const svg = arch.render(host, source, {view:'host'});
    const cards = [...svg.querySelectorAll('[data-model-id="a"]')].map(card => ({
      id:card.dataset.node, transform:card.getAttribute('transform')
    }));
    const edges = [...svg.querySelectorAll('[data-model-id="e"]')].map(edge => edge.dataset.edge);
    host.remove();
    return {cards, edges};
  });
  assert.deepEqual(overlapping.cards.map(card => card.id), ['sub1.a','sub2.a']);
  assert.notEqual(overlapping.cards[0].transform, overlapping.cards[1].transform);
  assert.deepEqual(overlapping.edges, ['sub1.e','sub2.e']);
  console.log('✓ Overlapping embeds display independent cards and relationship paths with shared model identities');

  const parameterSource=await readFile('examples/naf41-service-parameters.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const view of ['s7','embeddedS7']) {
      const g=arch.layout(source,{view}),svg=arch.render(host,source,{theme,view});
      if(g.nodes.length!==15||g.edges.length!==15||svg.querySelectorAll('[data-type="InvolvesLogicalResource"]').length!==2)issues.push('Missing S7 logical parameter chains');
      if(arch.renderToString(source,{theme,view,idPrefix:'parameters'})!==arch.renderToString(arch.translate(source),{theme,view,idPrefix:'parameters'}))issues.push('S7 JSON differs');
      if(/NaN|Infinity|undefined/.test(svg.outerHTML))issues.push('Invalid S7 coordinates');
    }
    host.remove();return issues;
  },parameterSource),[]);
  const parameterPage=await browser.newPage({viewport:{width:1900,height:1800}});
  for(const theme of ['light','dark']) {
    await parameterPage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,view:'s7',idPrefix:'parameter-preview'}),{source:parameterSource,theme}));
    await parameterPage.locator('svg').screenshot({path:`test-results/naf41-s7-${theme}.png`});
  }
  await parameterPage.close();
  console.log('✓ S7: logical/physical parameter chains, S3 reuse, JSON and both themes');

  const fittedS3Source=(await readFile('examples/naf41-view-reuse.arch','utf8')).replace('place situation at (-400,240)','place situation at (-1.5*situation.width,picture.centerY-situation.height/2)');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const g=arch.layout(source,{view:'s7'}),svg=arch.render(host,source,{theme,view:'s7'});
      const top=Math.min(...g.nodes.map(n=>n.y));
      if(g.bounds.y<=0||Math.abs(top-g.bounds.y-48)>0.01)issues.push('Extended S3 retains empty origin');
      if(svg.viewBox.baseVal.y!==g.bounds.y)issues.push('SVG does not use tight bounds');
    }
    host.remove();return issues;
  },fittedS3Source),[]);
  const fittedS3Page=await browser.newPage({viewport:{width:1700,height:1300}});
  await fittedS3Page.setContent(await page.evaluate(source=>arch.renderToString(source,{view:'s7',idPrefix:'s3-fit'}),fittedS3Source));
  await fittedS3Page.locator('svg').screenshot({path:'test-results/s3-extended-fit.png'});await fittedS3Page.close();
  console.log('✓ Extended S3: moved card alignment and tight viewport without empty origin');

  const labelsSource=await readFile('examples/label-positions.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const g=arch.layout(source),svg=arch.render(host,source,{theme});
      for(const [id,fraction,offset]of [['request',0.3,g.nodes.find(n=>n.id==='source').width/2],['onward',0.5,-g.nodes.find(n=>n.id==='receiver').height/2]]) {
        const path=svg.querySelector(`[data-edge="${id}"] path`),p=path.getPointAtLength(path.getTotalLength()*fraction+offset),label=g.edges.find(e=>e.id===id).label;
        if(Math.hypot(label.x-p.x,label.y-p.y)>1)issues.push('Label does not follow rendered path length');
      }
      const a=g.nodes.find(n=>n.id==='source'),b=g.nodes.find(n=>n.id==='target'),reply=g.edges.find(e=>e.id==='reply');
      if(reply.label.x!==(a.x+a.width+b.x)/2||reply.label.y!==a.y+a.height+20)issues.push('Calculated label differs');
      if(arch.renderToString(source,{theme,idPrefix:'label-math'})!==arch.renderToString(arch.translate(source),{theme,idPrefix:'label-math'}))issues.push('Label JSON differs');
    }
    host.remove();return issues;
  },labelsSource),[],'Calculated label anchors and relative rendered curve lengths');
  const labelsPage=await browser.newPage({viewport:{width:1500,height:1000}});
  for(const theme of ['light','dark']) {
    await labelsPage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'labels-preview'}),{source:labelsSource,theme}));
    await labelsPage.locator('svg').screenshot({path:`test-results/label-positions-${theme}.png`});
  }
  await labelsPage.close();
  console.log('✓ Calculated and relative labels: browser path lengths, geometry anchors, JSON and both themes');

  const mappingSource=await readFile('examples/mapping-review.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const svg=arch.render(host,source,{theme});
      if(svg.querySelectorAll('.arch-validation-marker').length!==2||!svg.querySelector('[data-validation-node="unmodeled"][data-validation-status="review"]')||!svg.querySelector('[data-validation-node="hidden"][data-validation-status="hidden"]'))issues.push('Missing or misplaced mapping markers');
      if(svg.querySelector('[data-edge="hiddenMapping"]'))issues.push('Hidden relationship was invented/restored');
      if(!svg.textContent.includes('Mapping not modeled')||!svg.textContent.includes('Required mapping is hidden'))issues.push('Missing mapping notice explanations');
      const clean=arch.render(host,source,{theme,showValidation:false});if(clean.querySelector('.arch-validation-marker,.arch-validation-notices'))issues.push('Clean export retains validation presentation');
      if(arch.validate(source,{validation:'strict',showValidation:false}).valid)issues.push('Clean export bypasses strict validation');
    }
    const missing=source.replace('style hiddenMapping {display none}','');
    if(!arch.validate(missing,{validation:'strict'}).valid||!arch.validate(missing,{validation:'strict'}).reviewRequired)issues.push('Unmodeled mapping incorrectly blocks strict rendering');
    host.remove();return issues;
  },mappingSource),[],'Mapping review: distinct markers, source meaning, tooltips, strict/draft and clean export');
  const mappingPage=await browser.newPage({viewport:{width:1600,height:1100}});
  for(const theme of ['light','dark']) {
    await mappingPage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'mapping-preview'}),{source:mappingSource,theme}));
    await mappingPage.locator('svg').first().screenshot({path:`test-results/mapping-review-${theme}.png`});
  }
  await mappingPage.close();
  console.log('✓ Mapping visibility: distinct node markers, explanations, clean exports, strict/draft and themes');

  const l1Source=await readFile('examples/naf41-logical-taxonomy.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      if(arch.validate(source).diagnostics.length)issues.push('L1 example has validation notices');
      const svg=arch.render(host,source,{theme});
      if(svg.querySelectorAll('[data-node]').length!==12||svg.querySelectorAll('[data-edge]').length!==11)issues.push('L1 content missing');
      if(svg.querySelector('[data-node="crew"]')?.getAttribute('data-type')!=='LogicalActor')issues.push('Logical actor type lost');
      if(svg.querySelector('[data-node="communicationDevice"]')?.getAttribute('data-type')!=='LogicalEquipment')issues.push('Logical equipment type lost');
      if(svg.querySelector('.arch-validation-notices'))issues.push('L1 incorrectly requires activities');
      const bounds=svg.viewBox.baseVal;
      for(const text of svg.querySelectorAll('text')) {
        const b=text.getBBox();
        if(b.x<bounds.x||b.y<bounds.y||b.x+b.width>bounds.x+bounds.width||b.y+b.height>bounds.y+bounds.height)issues.push('L1 text clipped: '+text.textContent);
      }
    }
    host.remove();return issues;
  },l1Source),[],'L1 p.127: full taxonomy, distinct types, no fabricated activities, both themes and bounds');
  const l1Page=await browser.newPage({viewport:{width:1800,height:1200}});
  for(const theme of ['light','dark']) {
    await l1Page.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'l1-preview'}),{source:l1Source,theme}));
    await l1Page.locator('svg').screenshot({path:`test-results/naf41-l1-${theme}.png`});
  }
  await l1Page.close();
  await page.locator('[data-example="naf41-logical-taxonomy"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ NAF L1: full p.127 taxonomy, logical actors/equipment, grouping rules, demo and themes');

  const needlineExample=await readFile('examples/naf41-needlines.arch','utf8');
  const needlineCutout=await readFile('examples/naf41-needlines-cutout.arch','utf8');
  assert.deepEqual(await page.evaluate(({example,cutout})=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const [source,view,nodes,edges,references]of [[example,'l2',4,6,0],[cutout,'objectified',4,2,1],[cutout,'compact',2,1,0],[cutout,'withoutPayload',3,1,1]]) {
      if(arch.validate(source).diagnostics.length)issues.push('Needline example invalid');
      const graph=arch.layout(source,{view}),svg=arch.render(host,source,{view,theme});
      if(graph.nodes.length!==nodes||graph.edges.length!==edges||graph.referenceNodes.length!==references)issues.push('Wrong Needline projection: '+view);
      if(svg.querySelectorAll('.arch-reference-label').length!==references)issues.push('Objectification label missing: '+view);
      if(references&&!svg.textContent.includes('is equal to'))issues.push('is equal to caption missing');
      if(view==='compact'&&svg.querySelector('[data-node="taskingNeed"]'))issues.push('Compact view forces object card');
      if(view==='withoutPayload'&&(svg.querySelector('[data-node="taskingOrder"]')||svg.querySelector('[data-edge="payload"]')))issues.push('may-show payload forced visible');
      if(arch.renderToString(source,{view,theme,idPrefix:'needline'})!==arch.renderToString(arch.translate(source),{view,theme,idPrefix:'needline'}))issues.push('Needline JSON parity');
      const bounds=svg.viewBox.baseVal;
      for(const text of svg.querySelectorAll('text')) {
        const b=text.getBBox();if(b.x<bounds.x||b.y<bounds.y||b.x+b.width>bounds.x+bounds.width||b.y+b.height>bounds.y+bounds.height)issues.push('Needline text clipped: '+view+' '+text.textContent);
      }
    }
    const wrong=cutout.replace('type Needline needline taskingNeed','type Needline').replace(/\s*route taskingNeed -> tasking \{[^}]+\}/,'');
    if(arch.validate(wrong).valid)issues.push('Orphan object accepted');
    if(!arch.renderToString(wrong,{view:'objectified',validation:'draft'}).includes('arch-validation-notices'))issues.push('Draft loses binding notices');
    for(const q of ['relations naf41-uaf Needline','connections naf41-uaf Needline','viewpoints naf41-uaf L2'])if(!arch.help(q).includes('Needline'))issues.push('Needline help missing');
    host.remove();return issues;
  },{example:needlineExample,cutout:needlineCutout}),[],'L2 p.129, objectification, optional cards/payloads, binding notices, help, JSON and themes');
  const needlinePage=await browser.newPage({viewport:{width:1500,height:1000}});
  for(const theme of ['light','dark'])for(const [source,view,name]of [[needlineExample,'l2','example'],[needlineCutout,'objectified','objectified']]) {
    await needlinePage.setContent(await page.evaluate(({source,view,theme})=>arch.renderToString(source,{view,theme,idPrefix:'needline-preview'}),{source,view,theme}));
    await needlinePage.locator('svg').screenshot({path:`test-results/naf41-l2-${name}-${theme}.png`});
  }
  await needlinePage.close();
  await page.locator('[data-example="naf41-needlines"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ NAF L2: compact needlines, objectification, routed is equal to, optional payloads, JSON and themes');

  assert.deepEqual(await page.evaluate(()=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    const source='architecture "Lists" {model {application a "A" application b "B" application c "C" relation flow a -> b "Calls" {type flow}} view v "V" {include [a,b,c] exclude [c] propertyFields title,type diagram connected {propertyFields id} style a {propertyFields title} tree g {nodes a,b direction down}}}';
    for(const theme of ['light','dark']) {
      const svg=arch.render(host,source,{theme});
      if(svg.querySelectorAll('[data-node]').length!==2||svg.querySelector('[data-node="c"]'))issues.push('Bracketed view selection differs');
      if(svg.querySelectorAll('[data-node-properties="true"]').length!==2)issues.push('Bare property fields missing');
      if(arch.renderToString(source,{theme,idPrefix:'lists'})!==arch.renderToString(arch.translate(source),{theme,idPrefix:'lists'}))issues.push('JSON list roundtrip differs');
      const empty=source.replace('include [a,b,c]','include []').replace('tree g {nodes a,b direction down}','');
      if(arch.render(host,empty,{theme}).querySelector('[data-node]'))issues.push('Empty include selects elements');
    }
    host.remove();return issues;
  }),[],'Bracketed selections, bare tree/property lists, JSON parity and empty selections in both themes');
  console.log('✓ List syntax: bracketed/unbracketed forms, singletons, empty selections, JSON and themes');

  const treeSharingSource=await readFile('examples/tree-shared-paths.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const [view,count]of [['stereotypes',2],['all',3],['separate',0],['named',2]]) {
      const graph=arch.layout(source,{view}),svg=arch.render(host,source,{view,theme});
      if(graph.edges.length!==3||graph.edges.filter(e=>e.sharedPath).length!==count)issues.push('Wrong tree bundle: '+view);
      if(svg.querySelectorAll('.arch-shared-path').length!==(count?2:0))issues.push('Shared trunk missing: '+view);
      if(svg.querySelectorAll('[data-label-for]').length!==3)issues.push('Tree relationship labels missing: '+view);
      if(arch.renderToString(source,{view,theme,idPrefix:'shared-tree'})!==arch.renderToString(arch.translate(source),{view,theme,idPrefix:'shared-tree'}))issues.push('Tree sharing JSON parity: '+view);
      const bounds=svg.viewBox.baseVal;
      for(const text of svg.querySelectorAll('text')) {
        const b=text.getBBox();
        if(b.x<bounds.x||b.y<bounds.y||b.x+b.width>bounds.x+bounds.width||b.y+b.height>bounds.y+bounds.height)issues.push('Tree sharing text clipped: '+view);
      }
    }
    host.remove();return issues;
  },treeSharingSource),[],'Whole/named tree sharing, three modes, branch labels, JSON and both themes');
  const treeSharingPage=await browser.newPage({viewport:{width:1200,height:750}});
  for(const theme of ['light','dark']) {
    await treeSharingPage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{view:'stereotypes',theme,idPrefix:'tree-sharing-preview'}),{source:treeSharingSource,theme}));
    await treeSharingPage.locator('svg').screenshot({path:`test-results/tree-shared-paths-${theme}.png`});
  }
  await treeSharingPage.close();
  await page.locator('[data-example="tree-shared-paths"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ Tree sharePath: whole views, named groups, all/stereotypes/none, labels, JSON and themes');

  const compactTreeSource=await readFile('examples/compact-tree.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const view of ['down','right','named']) {
      const graph=arch.layout(source,{view}),svg=arch.render(host,source,{view,theme});
      const get=id=>graph.nodes.find(n=>n.id===id);
      if(view!=='right'&&Math.abs(get('airborne').x-get('waterborne').x-get('waterborne').width-48)>1e-7)issues.push('Shallow siblings reserve the complete subtree: '+view);
      const boxes=[...svg.querySelectorAll('[data-node],.arch-edge-label')].map(n=>({id:n.getAttribute('data-node')??n.getAttribute('data-label-for'),box:n.getBoundingClientRect()}));
      for(let i=0;i<boxes.length;i++)for(const b of boxes.slice(i+1)) {
        const a=boxes[i];if(a.box.left<b.box.right-.5&&a.box.right>b.box.left+.5&&a.box.top<b.box.bottom-.5&&a.box.bottom>b.box.top+.5)issues.push('Compact SVG overlap: '+a.id+'/'+b.id+' '+view);
      }
      if(arch.renderToString(source,{view,theme,idPrefix:'compact'})!==arch.renderToString(arch.translate(source),{view,theme,idPrefix:'compact'}))issues.push('Compact JSON parity: '+view);
    }
    host.remove();return issues;
  },compactTreeSource),[],'Compact trees: shallow siblings, real SVG card/label bounds, named groups, shared paths, JSON and themes');
  const compactTreePage=await browser.newPage({viewport:{width:1450,height:950}});
  for(const theme of ['light','dark']) {
    await compactTreePage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{view:'down',theme,idPrefix:'compact-preview'}),{source:compactTreeSource,theme}));
    await compactTreePage.locator('svg').screenshot({path:`test-results/compact-tree-${theme}.png`});
  }
  await compactTreePage.close();
  await page.locator('[data-example="compact-tree"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ Compact tree: occupied ranks, shallow siblings, card/label collisions, named groups, sharing and themes');

  const routeStylesSource=await readFile('examples/route-styles.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    const markerColor=(svg,path)=>{
      const url=path.getAttribute('marker-end'),id=url?.slice(5,-1);
      return svg.querySelector(`[id="${id}"] path`)?.getAttribute('stroke');
    };
    for(const theme of ['light','dark']) {
      const svg=arch.render(host,source,{theme}),g=arch.layout(source);
      for(const id of ['firstFlow','secondFlow','thirdFlow']) {
        const path=svg.querySelector(`[data-edge="${id}"] path`),special=id==='thirdFlow';
        const color=special?'#16a34a':'#3b82f6';
        if(path.getAttribute('stroke')!==color||markerColor(svg,path)!==color)issues.push('Line/arrow colors differ');
        if(path.getAttribute('stroke-width')!==(special?'4':'2'))issues.push('Incorrect width');
        if(path.getAttribute('stroke-dasharray')!==(special?'none':'8 4'))issues.push('Incorrect dash pattern');
        if(getComputedStyle(path).strokeDasharray!==(special?'none':'8px, 4px'))issues.push('Browser dash rendering differs');
      }
      if(g.sharedPaths?.[0].edgeIds.join(',')!=='firstFlow,secondFlow')issues.push('Different styles were bundled');
      for(const path of svg.querySelectorAll('.arch-shared-path path'))if(path.getAttribute('stroke')!=='#3b82f6'||path.getAttribute('stroke-width')!=='2'||path.getAttribute('stroke-dasharray')!=='8 4')issues.push('Shared path lost styling');
      const json=arch.translate(source);if(arch.renderToString(json,{theme,idPrefix:'style'})!==arch.renderToString(source,{theme,idPrefix:'style'}))issues.push('Styled JSON differs');
      if(new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelector('parsererror'))issues.push('Invalid styled SVG');
    }
    const profile={nodeTypes:{actor:{},item:{}},relationTypes:{flow:{style:'dependency',attributes:{payload:{type:'reference',targets:['item'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
    const ref='architecture "References" {model {actor a "A" actor b "B" item info "Data" relation e a -> b "Carries" {type flow payload [info]}} view v "V" {place a at (0,0) place b at (700,0) place info at (300,-240) routes {color blue width 3 dasharray [8,4]} route info -> e {color orange width 2.5 dasharray [2,3]}}}';
    for(const theme of ['light','dark']) {
      const svg=arch.render(host,ref,{profile,theme}),path=svg.querySelector('.arch-reference-connector');
      if(path.getAttribute('stroke')!=='#ffa500'||path.getAttribute('stroke-width')!=='2.5'||path.getAttribute('stroke-dasharray')!=='2 3'||markerColor(svg,path)!=='#ffa500')issues.push('Independent reference style failed');
    }
    const stacked=source.replace('view overview','view plain "Plain" {} view overview');
    const svg=arch.render(host,stacked,{views:['overview','plain']});
    const ids=[...svg.querySelectorAll('[id]')].map(e=>e.id);if(new Set(ids).size!==ids.length)issues.push('Stacked marker IDs collide');
    for(const path of svg.querySelectorAll('[marker-end]'))if(!svg.querySelector(`[id="${path.getAttribute('marker-end').slice(5,-1)}"]`))issues.push('Export marker target missing');
    host.remove();return issues;
  },routeStylesSource),[]);
  const stylesPage=await browser.newPage({viewport:{width:1300,height:1000}});
  for(const theme of ['light','dark']) {
    await stylesPage.setContent(await page.evaluate(({source,theme})=>arch.renderToString(source,{theme,idPrefix:'route-style-preview'}),{source:routeStylesSource,theme}));
    await stylesPage.locator('svg').screenshot({path:`test-results/route-styles-${theme}.png`});
  }
  await stylesPage.close();
  await page.locator('[data-example="route-styles"]').click();assert.equal(await page.locator('#error').isVisible(),false);
  console.log('✓ Route styles: color/width/dashes, arrowheads, shared paths, independent reference connectors, JSON, themes and export IDs');

  assert.deepEqual(await page.evaluate(async()=>{
    const issues=[];
    const source=`architecture "Dash overlap" {
      model { application a "A" application b "B" application c "C"
        relation first a -> c "First" relation second b -> c "Second" }
      view v "V" {
        place a at (-60,152) place b at (-55,212) place c at (390,24)
        routes { dasharray [5,5] color red width 2 label none }
        route first { from right to bottom via (500,200) }
        route second { from right to bottom via (500,260) }
      }
    }`;
    const raster=async (doc,theme)=>{
      const markup=arch.renderToString(doc,{theme,idPrefix:'dash-overlap'});
      const svg=new DOMParser().parseFromString(markup,'image/svg+xml').documentElement;
      const [left,top,width,height]=svg.getAttribute('viewBox').split(' ').map(Number);
      const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(markup);await image.decode();
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(500-left,140-top,1,50).data;
      return {pixels:[...pixels],svg};
    };
    for(const theme of ['light','dark']) {
      const result=await raster(source,theme);
      const baseline=await raster(source.replace('view v "V" {','view v "V" { style second {display none}'),theme);
      const redCount=result.pixels.filter((red,i)=>i%4===0&&red>180&&result.pixels[i+1]<100).length;
      if (redCount!==25||result.pixels.some((value,i)=>value!==baseline.pixels[i]))
        issues.push('Overlapped dashes changed the visible stroke or gaps');
      if (!result.svg.querySelector('[data-edge="second"] path[mask]')||
          !result.svg.querySelector('[data-edge="second"] path[marker-end]'))
        issues.push('Overlap correction lost the SVG mask or target marker');
    }
    return issues;
  }),[]);
  console.log('✓ Coincident manual dashed routes preserve rasterized gaps and markers in both themes');

  const sharedSource=await readFile('examples/shared-paths.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark']) {
      const graph=arch.layout(source),svg=arch.render(host,source,{theme});
      if(!arch.validate(source).valid||graph.sharedPaths?.length!==2)issues.push('C8 sharing or Constraint validation failed');
      if(svg.querySelectorAll('.arch-edge').length!==2||svg.querySelectorAll('.arch-shared-path').length!==2||svg.querySelectorAll('.arch-edge-label').length!==2)issues.push('Shared network lost relationship identity');
      if(svg.querySelectorAll('.arch-shared-path [marker-end]').length!==1||svg.querySelector('.arch-edge [marker-end]'))issues.push('Fan-in must have exactly one common arrowhead');
      for(const edge of graph.edges) {
        const path=svg.querySelector(`[data-edge="${edge.id}"] path`);
        const p=path.getPointAtLength(path.getTotalLength());
        if(!Number.isFinite(p.x)||!Number.isFinite(p.y))issues.push('Invalid branch geometry');
      }
      const rects=[...svg.querySelectorAll('.arch-node > g > rect,.arch-edge-label > rect')].map(el=>el.getBoundingClientRect());
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++) {
        const a=rects[i],b=rects[j];if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)issues.push('C8 label/card overlap');
      }
      if(new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelector('parsererror'))issues.push('Shared paths produced invalid SVG');
    }
    host.remove();return issues;
  },sharedSource),[]);
  const sharedPage=await browser.newPage({viewport:{width:1300,height:800}});
  await sharedPage.setContent(await page.evaluate(source=>arch.renderToString(source,{idPrefix:'shared-preview'}),sharedSource));
  await sharedPage.locator('svg').screenshot({path:'test-results/shared-paths-c8.png'});await sharedPage.close();
  const sharedC7=c7Effectiveness.replace('viewpoint C7','viewpoint C7 routes {sharePath stereotypes} tree g {nodes [maritime,seaState,weather,coverage,seaStateValue,weatherValue,coverageValue] parentDirection target direction left}');
  assert.deepEqual(await page.evaluate(source=>{
    const g=arch.layout(source);return g.sharedPaths?.[0].edgeIds;
  },sharedC7),['seaCharacterizes','weatherCharacterizes','coverageCharacterizes']);
  const c7Page=await browser.newPage({viewport:{width:1500,height:1300}});
  await c7Page.setContent(await page.evaluate(source=>arch.renderToString(source,{idPrefix:'shared-c7-preview'}),sharedC7));
  await c7Page.locator('svg').screenshot({path:'test-results/shared-paths-c7.png'});await c7Page.close();
  console.log('✓ C8 Constraint vocabulary and shared fan-in: separate labels/IDs, one common arrow, both themes and valid SVG');

  assert.deepEqual(await page.evaluate(()=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    const profile={defaultRelation:'exchange',nodeTypes:{service:{template:'service'},document:{template:'artifact'}},relationTypes:{exchange:{style:'flow',attributes:{payload:{type:'reference',targets:['document'],many:true}},referenceLabels:{payload:'Carries'},referenceDisplay:'nodes'}}};
    const source='architecture "Via" {model{service a "A" service b "B" document info "Report" relation e a -> b "Exchange" {payload [info]}}view v "V"{place a at (20,40) place b at (a.right + 300,a.y + 200) place info at (a.x - 40,a.bottom + 150) route e {via (a.right + 40,a.y - 50), (b.x - 40,b.centerY) curve bezier} route info -> e {via (info.centerX,info.y - 40), (b.x - 60,a.centerY) curve bezier}}}';
    for(const theme of ['light','dark']) {
      const g=arch.layout(source,{profile}),svg=arch.render(host,source,{profile,theme}),a=g.nodes.find(n=>n.id==='a'),b=g.nodes.find(n=>n.id==='b'),info=g.nodes.find(n=>n.id==='info');
      if(g.edges[0].points[1].x!==a.x+a.width+40||g.edges[0].points[2].y!==b.y+b.height/2)issues.push('Edge via expression failed');
      if(g.referenceNodes[0].points[1].x!==info.x+info.width/2||g.referenceNodes[0].points[1].y!==info.y-40)issues.push('Reference via expression failed');
      if(!svg.querySelector('.arch-reference-connector')?.getAttribute('d').includes(' C '))issues.push('Missing calculated reference bezier');
      if(/NaN|Infinity|undefined/.test(svg.outerHTML))issues.push('Nonfinite via SVG');
      const json=arch.translate(source);if(arch.renderToString(json,{profile,theme,idPrefix:'via'})!==arch.renderToString(source,{profile,theme,idPrefix:'via'}))issues.push('Via JSON differs');
    }
    const bad=arch.validate(source.replace('a.right + 40','missing.x'),{profile});if(bad.valid||!bad.diagnostics[0].message.includes('Unknown via reference'))issues.push('Missing via error');
    host.remove();return issues;
  }),[]);
  console.log('✓ Calculated via: final node positions, ordinary/reference bezier paths, both themes, JSON and diagnostics');

  const propertySource=await readFile('examples/property-fields.arch','utf8');
  assert.deepEqual(await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const view of ['cards','classes']) {
      const g=arch.layout(source,{view}),svg=arch.render(host,source,{view,theme}),byId=new Map(g.nodes.map(n=>[n.id,n]));
      if(!svg.querySelector('[data-node="timeToFind"]').textContent.includes('Elapsed time in minutes'))issues.push('Criterion properties missing');
      if(!svg.querySelector('[data-node="elapsed"]').textContent.includes('value: 25'))issues.push('Measure properties missing');
      if(byId.get('elapsed').y!==byId.get('timeToFind').y+byId.get('timeToFind').height+100)issues.push('Property-aware relative placement failed');
      for(const n of g.nodes)for(const text of svg.querySelector(`[data-node="${n.id}"]`).querySelectorAll('text')) {
        const b=text.getBBox();if(b.x<-1||b.y<-1||b.x+b.width>n.width+1||b.y+b.height>n.height+1)issues.push(`Property text overflow: ${view}/${n.id}/${text.textContent}`);
      }
      const json=arch.translate(source);if(arch.renderToString(json,{view,theme,idPrefix:'props'})!==arch.renderToString(source,{view,theme,idPrefix:'props'}))issues.push('Properties JSON differs');
    }
    const shifted=source.replaceAll('place sar at (0, 0)','place sar at (-300, -200)');
    const svg=arch.render(host,shifted,{view:'classes'}),b=svg.getBoundingClientRect();
    for(const el of svg.querySelectorAll('text,rect,path'))if(!el.closest('defs')){const r=el.getBoundingClientRect();if(r.width&&(r.left<b.left-2||r.top<b.top-2||r.right>b.right+2||r.bottom>b.bottom+2))issues.push('Negative class placement clipped');}
    host.remove();return issues;
  },propertySource),[]);
  for(const view of ['cards','classes']) {
    const svg=await page.evaluate(({source,view})=>arch.renderToString(source,{view,idPrefix:'property-export'}),{source:propertySource,view});
    const propPage=await browser.newPage({viewport:{width:1700,height:1100}});await propPage.setContent(svg);await propPage.locator('svg').screenshot({path:`test-results/property-fields-${view}.png`});await propPage.close();
  }
  assert.deepEqual(await page.evaluate(()=>{
    const templates=['package','person','system','service','database','queue','component','node','artifact','interface','process','capability'],profile={nodeTypes:{}},issues=[];
    for(const template of templates)profile.nodeTypes[template]={template,...(template==='package'?{container:true}:{}),attributes:{expression:{}}};
    const text='Time until confirmed localization. '+ '漢字 Überwachung 🙂 '.repeat(8),nodes=templates.map((t,i)=>`${t} n${i} "${t}" {expression ${JSON.stringify(text)}}`).join(' ');
    const host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const iconPosition of ['left','right','top','bottom']) {
      const styles=templates.map((_,i)=>`style n${i} {width 180 fontSize 20 iconPosition ${iconPosition}}`).join(' '),source=`architecture "Property bounds"{model{${nodes}}view v "V"{propertyFields [expression] ${styles}}}`;
      const g=arch.layout(source,{profile}),svg=arch.render(host,source,{profile,theme});
      for(const n of g.nodes)for(const text of svg.querySelector(`[data-node="${n.id}"]`).querySelectorAll('text')){const b=text.getBBox();if(b.x<-1||b.y<-1||b.x+b.width>n.width+1||b.y+b.height>n.height+1)issues.push(`Property/icon bounds: ${theme}/${iconPosition}/${n.id}/${text.textContent}`);}
    }
    host.remove();return issues;
  }),[]);
  console.log('✓ Properties on normal/tree/package cards and freely positioned class cards: fields, bounds, relative placement, themes, templates, icons, JSON and SVG export');

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
  const organizationsReference=await readFile('ReferenceDocs/organizationLogos.json','utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  const rawFidelity=await page.evaluate(async({affinity,organizations})=>{
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
    const backgroundBodies={
      attribute:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" enable-background="new 0 0 24 24"><rect width="24" height="24" fill="#facc15"/><circle cx="12" cy="12" r="8" fill="#2563eb"/></svg>',
      style:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" enable-background="new" style="enable-background:accumulate"><g style="enable-background:new 0 0 24 24;fill:#ef4444"><path d="M0 0h24v24H0Z"/></g></svg>',
      metadata:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" enable-background="new" data-name="Layer 1" data-export="test"><g data-name="Shapes"><path data-name="Rectangle" d="M0 0h24v24H0Z" fill="#0d9488"/></g></svg>'
    };
    arch.registerIconPack('background-export',{icons:Object.fromEntries(Object.entries(backgroundBodies).map(([name,body])=>[name,{body}]))});
    for(const [name,body]of Object.entries(backgroundBodies)) {
      const generated=arch.renderIconToString(`background-export.${name}`,{size:64});
      if(!generated.includes('enable-background='))issues.push(`enable-background missing: ${name}`);
      if(generated.includes('data-name=')||generated.includes('data-export='))issues.push(`Editor metadata leaked: ${name}`);
      const raster=async svg=>{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(svg);await img.decode();const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,64,64);return ctx.getImageData(0,0,64,64).data;};
      const a=await raster(body.replace('<svg ','<svg width="64" height="64" ')),b=await raster(generated);
      const error=a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;if(error>1)issues.push({name:`enable-background ${name}`,error});
    }
    if(organizations) {
      arch.registerIconPack('direct-organizations',organizations);
      if(!CSS.supports('fill','contrast-color(currentColor)'))issues.push('Browser cannot evaluate contrast-color');
      const raster=async svg=>{const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(svg);await img.decode();const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,64,64);return ctx.getImageData(0,0,64,64).data;};
      for(const [id,icon]of Object.entries(organizations.icons))for(const color of ['#111111','#eeeeee']) {
        const w=icon.width??organizations.width??16,h=icon.height??organizations.height??16,max=Math.max(w,h);
        // Use the same documented monochrome paint defaults as arch's icon viewport.
        const reference=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${64*w/max}" height="${64*h/max}" viewBox="0 0 ${w} ${h}" color="${color}" fill="currentColor" stroke="none">${icon.body}</svg>`;
        const generated=arch.renderIconToString(`direct-organizations.${id}`,{size:64}).replace('<svg ','<svg color="'+color+'" ');
        const a=await raster(reference),b=await raster(generated),error=a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;
        if(error>1)issues.push({name:'organizations',id,color,error});
        if(id==='nato') {
          const colors=new Set();for(let i=0;i<b.length;i+=4)if(b[i+3]===255)colors.add(b[i]);
          if(!colors.has(color==='#111111'?255:0))issues.push(`Missing NATO contrast: ${color}`);
        }
        if(['nato','nato_color','rollsroyce','siemenshealthineers_color'].includes(id)) {
          const tile=document.createElement('div');tile.style.cssText=`width:110px;text-align:center;font:12px sans-serif;background:${color==='#111111'?'white':'#222'};color:${color};padding:8px`;tile.innerHTML=generated;
          const label=document.createElement('div');label.textContent=id;tile.append(label);gallery.append(tile);
        }
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
  },{affinity:affinityReference,organizations:organizationsReference});
  assert.deepEqual(rawFidelity,[],'Original Iconify packs retain their colors, gradients, clips and filters');
  await page.locator('#raw-iconify-gallery').screenshot({path:'test-results/iconify-originals.png'});
  await page.locator('#raw-iconify-gallery').evaluate(e=>e.remove());
  console.log('✓ Direct original Iconify packs, colored logos, local IDs and raster fidelity');


  const treeSource=await readFile('examples/taxonomy.arch','utf8');
  await page.locator('[data-example="taxonomy"]').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  const treeIssues=await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const input of [source,arch.translate(source)])for(const theme of ['light','dark'])for(const view of ['taxonomy','horizontal']) {
      const graph=arch.layout(input,{view,theme}),svg=arch.render(host,input,{view,theme});
      if(svg.dataset.diagram!=='tree')issues.push('Missing tree marker');
      if(svg.querySelectorAll('.arch-node').length!==6||svg.querySelectorAll('.arch-edge').length!==5)issues.push('Missing tree elements');
      const root=graph.nodes.find(n=>n.id==='c_SAR');if(root.treeDepth!==0)issues.push('Wrong root');
      const bounds=svg.viewBox.baseVal;
      for(const node of graph.nodes) {
        const group=[...svg.querySelectorAll('[data-node]')].find(g=>g.dataset.node===node.id);
        for(const text of group.querySelectorAll(':scope > text')) {
          const b=text.getBBox();if(b.x<0||b.y<0||b.x+b.width>node.width+1||b.y+b.height>node.height+1)issues.push(`Tree text clipped: ${view}/${node.id}/${text.textContent}`);
        }
        if(node.treeParent) {
          const parent=graph.nodes.find(n=>n.id===node.treeParent);
          if(view==='taxonomy'?node.y<parent.y+parent.height:node.x<parent.x+parent.width)issues.push('Wrong hierarchy direction');
        }
      }
      for(const label of svg.querySelectorAll('.arch-edge-label')) {
        const b=label.getBBox();if(b.x<bounds.x||b.y<bounds.y||b.x+b.width>bounds.x+bounds.width+1||b.y+b.height>bounds.y+bounds.height+1)issues.push('Tree label outside SVG');
        const rect=label.querySelector('rect').getBBox();for(const text of label.querySelectorAll('text')){const t=text.getBBox();if(t.x<rect.x||t.y<rect.y||t.x+t.width>rect.x+rect.width+1||t.y+t.height>rect.y+rect.height+1)issues.push('Tree edge label overflow');}
      }
      for(const edge of svg.querySelectorAll('.arch-edge path'))if(!edge.getAttribute('marker-end')?.includes('triangle'))issues.push('Generalization marker missing');
    }
    host.remove();return issues;
  },treeSource);
  assert.deepEqual(treeIssues,[]);
  await page.screenshot({path:'test-results/tree-taxonomy.png',fullPage:true});
  await page.locator('#toggle-theme').click();await page.screenshot({path:'test-results/tree-taxonomy-dark.png',fullPage:true});await page.locator('#toggle-theme').click();
  const treeExport=await page.evaluate(source=>arch.renderToString(source,{idPrefix:'tree-export'}),treeSource);
  await import('node:fs/promises').then(fs=>fs.writeFile('test-results/tree-taxonomy.svg',treeExport));
  const treePage=await browser.newPage({viewport:{width:1100,height:900}});
  await treePage.setContent(treeExport);await treePage.locator('svg').screenshot({path:'test-results/tree-taxonomy-export.png'});await treePage.close();
  console.log('✓ Tree taxonomy: automatic parents/ranks, C1 profiles, both orientations/themes, JSON, node/label bounds and SVG export');

  const bidirectionalSource=await readFile('examples/bidirectional.arch','utf8');
  await page.locator('#source').fill(bidirectionalSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  const bidirectionalIssues=await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const input of [source,arch.translate(source)]) {
      const svg=arch.render(host,input,{view:'overview',theme});
      const edge=svg.querySelector('[data-edge="exchange"] path');
      if(!edge?.hasAttribute('marker-start')||!edge?.hasAttribute('marker-end'))issues.push('Missing bidirectional markers');
      const marker=svg.querySelector('marker[id$="-arrow"]');if(marker?.getAttribute('orient')!=='auto-start-reverse')issues.push('Wrong start arrow orientation');
      if(svg.querySelectorAll('[data-edge="exchange"]').length!==1)issues.push('Relationship was duplicated');
      const outer=svg.querySelector('[data-node="enterprise"] rect'),inner=svg.querySelector('[data-node="datacenter"] rect');
      if(inner?.getAttribute('fill')!=='#dbeafe'||inner?.getAttribute('fill-opacity')!=='1')issues.push('Package background lost');
      const a=outer.getBoundingClientRect(),b=inner.getBoundingClientRect();
      if(b.left<a.left||b.top<a.top||b.right>a.right||b.bottom>a.bottom)issues.push('Nested package outside parent');
      const matrix=arch.render(host,input,{view:'matrix',theme});
      for(const cell of ['a:b','b:a'])if(matrix.querySelector(`[data-cell="${cell}"] tspan`)?.textContent!=='1')issues.push(`Missing matrix direction ${cell}`);
    }
    host.remove();return issues;
  },bidirectionalSource);
  assert.deepEqual(bidirectionalIssues,[]);
  await page.screenshot({path:'test-results/bidirectional-packages.png',fullPage:true});
  console.log('✓ Bidirectional edges: both markers, one ID, DSL/JSON, both themes, matrices and nested styled packages');

  const draftSource=await readFile('examples/draft.arch','utf8');
  await page.locator('#source').fill(draftSource);await page.locator('#render-button').click();
  assert.equal(await page.locator('#error').isVisible(),false);
  const draftIssues=await page.evaluate(source=>{
    const issues=[],host=document.createElement('div');document.body.append(host);
    for(const theme of ['light','dark'])for(const input of [source,arch.translate(source)]) {
      const svg=arch.render(host,input,{theme}),graph=arch.layout(input,{theme});
      if(svg.dataset.archValidation!=='draft')issues.push('Missing draft wrapper');
      if(svg.querySelectorAll('.arch-node').length!==3)issues.push('Draft nodes were not rendered');
      if(svg.querySelector('[data-edge="exchange"]'))issues.push('Hidden edge was rendered');
      const footer=svg.querySelector('.arch-validation-notices'),box=footer?.getBBox(),bounds=svg.viewBox.baseVal;
      if(!box||box.y<graph.content.bounds.height||box.x<0||box.x+box.width>bounds.width+1||box.y+box.height>bounds.height+1)issues.push('Draft footer overflow');
      if(!footer?.textContent.includes('found 0'))issues.push('Missing correction message');
      const report=arch.validate(input);if(!report.valid||report.conformant!==false||report.diagnostics.some(d=>d.severity!=='warning'))issues.push('Wrong draft validation status');
      if(arch.validate(input,{validation:'strict'}).valid)issues.push('Strict override did not reject incomplete model');
      const completed=JSON.parse(arch.translate(source));completed.architecture.model.relations.extra={from:'pending',to:'a',name:'New exchange',direction:'both'};
      if(arch.renderToString(completed,{theme}).includes('arch-validation-notices'))issues.push('Resolved warnings did not disappear');
    }
    const escaped=arch.render(host,source.replace('Draft with pending connections','& <Draft>'),{theme:'dark'});
    if(escaped.querySelector('script'))issues.push('Unescaped source');
    const hiddenNodes=JSON.parse(arch.translate(source));hiddenNodes.architecture.views.draft.style.pending={display:'none'};
    const hidden=arch.render(host,hiddenNodes);
    if(hidden.querySelector('[data-node="pending"]')||hidden.querySelectorAll('.arch-node').length!==2)issues.push('Node display none was ignored');
    if(arch.validate(hiddenNodes).diagnostics.length!==arch.validate(source).diagnostics.length)issues.push('Node hiding changed semantic requirements');
    host.remove();return issues;
  },draftSource);
  assert.deepEqual(draftIssues,[]);
  await page.screenshot({path:'test-results/draft-validation.png',fullPage:true});
  const draftNode = page.locator('#diagram [data-node="pending"]');
  const draftDetails = page.locator('#diagram [data-arch-draft-details]');
  const diagnosticDialog = page.locator('[data-arch-diagnostic-dialog]');
  const diagnosticLink = query => `a[data-arch-diagnostic-help=${JSON.stringify(query)}]`;
  const closeDiagnosticHelp = async () => {
    await page.keyboard.press('Escape');
    await diagnosticDialog.waitFor({state:'detached'});
  };
  const draftLink = page.locator('#diagram .arch-validation-notices ' + diagnosticLink('relations . exchange')).first();
  await draftLink.focus();
  await page.keyboard.press('Enter');
  await diagnosticDialog.locator('svg[data-arch-help="relations"]').waitFor();
  assert.match(await diagnosticDialog.textContent(), /exchange/);
  assert.equal(await page.locator('#source').inputValue(), draftSource);
  await closeDiagnosticHelp();
  await draftNode.click();
  assert.equal(await draftDetails.isVisible(), true);
  assert.match(await draftDetails.innerText(), /ID\s+pending\s+Type\s+service/);
  assert.match(await draftDetails.innerText(), /Validation notices.*found 0/s);
  assert.equal(await draftDetails.locator(diagnosticLink('relations . exchange')).count(), 2);
  assert.equal(await draftNode.getAttribute('aria-expanded'), 'true');
  const detailsBounds = await draftDetails.boundingBox();
  assert.ok(detailsBounds.x >= 0 && detailsBounds.y >= 0 && detailsBounds.x + detailsBounds.width <= 1536 && detailsBounds.y + detailsBounds.height <= 1050);
  await page.screenshot({path:'test-results/draft-element-details.png'});
  await page.keyboard.press('Escape');
  assert.equal(await draftDetails.isVisible(), false);
  assert.equal(await draftNode.getAttribute('aria-expanded'), 'false');
  assert.ok(await draftNode.evaluate(node => node === node.ownerDocument.activeElement));
  await page.keyboard.press('Enter');
  assert.equal(await draftDetails.isVisible(), true);
  await draftDetails.getByRole('button',{name:'Close details'}).click();
  assert.equal(await draftDetails.isVisible(), false);

  const detailsIssues = await page.evaluate(() => {
    const host = document.createElement('div'), issues = [];
    document.body.append(host);
    const source = `architecture "Details" {config {
        validation draft views all extends default
        type service {template service attribute owner {type string required true}}
      }
      model {
        service a "API" {owner "<img src=x>" stereotype "Gateway"}
        service b "Queue"
        relation r a -> b "Publishes" {type flow description "Delivery"}
      }
      view overview "Overview" {
        place a at (0,20)
        place b at (a.right + 40, a.y + 150)
        style b {width 1.5 * a.width height 96 fontSize a.fontSize + 5 backgroundColor gold}
        routes {color red width 2}
        route r {from right 10 / a.height to (b.x,b.centerY) via (a.right + 20,b.centerY) label 1/2 offset a.width / 4 sideOffset a.width / 10 curve straight}
      }
      view detail "Detail" {theme dark diagram class}
      view composed "Composed" {embed overview as sub place sub at (200,300)}
    }`;
    const graph = arch.render(host, source);
    const panel = host.querySelector('[data-arch-draft-details]');
    const activate = (root, selector) => root.querySelector(selector)?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    const row = (section, field, key='value') => panel.querySelector(`[data-arch-details-section="${section}"] [data-arch-detail-field="${field}"] [data-arch-detail-${key}]`)?.textContent;
    const overview = graph.querySelector('[data-view-id="overview"]');
    activate(overview, '[data-node="b"]');
    if (row('geometry','x') !== '260' || row('geometry','y') !== '170' || row('geometry','x','input') !== 'a.right + 40') issues.push('Missing calculated card position');
    if (row('geometry','width') !== '330' || row('styles','width','input') !== '1.5 * a.width' || row('styles','fontSize') !== '20' || row('styles','fontSize','input') !== 'a.fontSize + 5') issues.push('Missing resolved card styles or formulas');
    if (row('styles','backgroundColor') !== '#ffd700') issues.push('Missing rendered background color');
    activate(overview, '[data-label-for="r"]');
    if (row('geometry','Start') !== '(220, 30)' || !row('geometry','End') || !row('geometry','Label')) issues.push('Missing edge geometry');
    if (row('routing','from','input') !== 'right 10 / a.height' || !row('routing','via','input')?.includes('a.right + 20') || row('routing','label') !== '0.5 offset 55 sideOffset 22' || !row('routing','label','input')?.includes('sideOffset a.width / 10')) issues.push('Missing resolved route settings or formulas');
    if (row('styles','color') !== '#ff0000' || row('styles','width') !== '2') issues.push('Missing inherited route style');
    const composed = graph.querySelector('[data-view-id="composed"]');
    activate(composed, '[data-node="b"]');
    if (row('geometry','x') === '260' || row('geometry','x','input') !== 'a.right + 40' || row('styles','fontSize') !== '20') issues.push('Missing embedded card geometry or source formula');
    activate(composed, '[data-label-for="r"]');
    if (row('geometry','Start') === '(220, 30)' || row('routing','from','input') !== 'right 10 / a.height') issues.push('Missing embedded route geometry or source formula');
    const detail = graph.querySelector('[data-view-id="detail"]');
    activate(detail, '[data-node="a"]');
    if (!panel.matches(':popover-open') || !panel.textContent.includes('<img src=x>') || panel.querySelector('img') || !panel.textContent.includes('Gateway')) issues.push('Missing or unsafe node details');
    if (panel.style.colorScheme !== 'dark') issues.push('Details did not use the originating view theme');
    if (row('styles','fontSize') !== '18') issues.push('Class style inspection did not use the rendered font size');
    activate(detail, '[data-edge="r"]');
    for (const value of ['Publishes','From','To','Delivery']) if (!panel.textContent.includes(value)) issues.push(`Missing relation field: ${value}`);
    activate(detail, '[data-node="b"]');
    if (!panel.textContent.includes('Missing required attribute owner')) issues.push('Missing validation issue');
    const muted = arch.render(host, source, {showValidation:false});
    activate(muted, '[data-node="b"]');
    const mutedPanel = host.querySelector('[data-arch-draft-details]');
    if (!mutedPanel.matches(':popover-open') || mutedPanel.textContent.includes('Missing required attribute')) issues.push('showValidation false did not hide details warnings');
    const complete = source.replace('service b "Queue"','service b "Queue" {owner "Ops"}');
    arch.render(host, complete);
    if (!host.querySelector('[data-arch-draft-details]') || host.querySelector('.arch-validation-notices')) issues.push('Complete drafts should still offer details');
    arch.render(host, complete, {validation:'strict'});
    if (host.querySelector('[data-arch-draft-details]')) issues.push('Strict render contains a draft panel');
    if (/data-arch-draft-details|aria-haspopup/.test(arch.renderToString(source))) issues.push('Static SVG contains interaction markup');
    host.remove();
    return issues;
  });
  assert.deepEqual(detailsIssues, []);

  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'swimlane-draft-details';
    host.style.cssText = 'position:fixed;left:260px;top:64px;width:900px;z-index:100';
    document.body.append(host);
    arch.render(host, `architecture "L4 swimlane inspection" {
      config { profile naf41-uaf validation draft }
      model {
        Node vessel "Vessel in Distress"
        Role controller "SAR Asset Controller"
        OperationalActivity log "Log Distress" { tags controller }
        OperationalActivity report "Reports Problem" { tags vessel }
        relation handover report -> log "Operational Control Flow" { type OperationalControlFlow }
      }
      view swimlanes "L4" {
        viewpoint L4
        diagram activity { lanes [vessel,controller] laneAttribute tags }
      }
    }`);
  });
  const swimlaneHost = page.locator('#swimlane-draft-details');
  const swimlanePanel = swimlaneHost.locator('[data-arch-draft-details]');
  const swimlaneField = (section, field) => swimlanePanel.locator(`[data-arch-details-section="${section}"] [data-arch-detail-field="${field}"] [data-arch-detail-value]`);
  await swimlaneHost.locator('[data-node="report"] text').last().click();
  assert.ok(await swimlanePanel.isVisible());
  assert.equal(await swimlaneField('model','ID').textContent(), 'report');
  assert.equal(await swimlaneField('model','Type').textContent(), 'OperationalActivity');
  assert.equal(await swimlaneField('model','Tags').textContent(), 'vessel');
  assert.equal(await swimlaneField('geometry','y').textContent(), '95');
  await page.keyboard.press('Escape');
  for (const [id,type] of [['vessel','Node'],['controller','Role']]) {
    await swimlaneHost.locator(`[data-node="${id}"] text`).click();
    assert.ok(await swimlanePanel.isVisible());
    assert.equal(await swimlaneField('model','ID').textContent(), id);
    assert.equal(await swimlaneField('model','Type').textContent(), type);
    assert.equal(await swimlaneField('geometry','width').textContent(), '330');
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Enter');
  assert.ok(await swimlanePanel.isVisible());
  assert.equal(await swimlaneField('model','ID').textContent(), 'controller');
  await page.keyboard.press('Escape');
  await swimlaneHost.evaluate(host=>host.remove());
  console.log('✓ Draft swimlane inspection opens from activity cards and lane headlines');

  const draftExport=await page.evaluate(source=>arch.renderToString(source,{theme:'dark',idPrefix:'draft-export'}),draftSource);
  await import('node:fs/promises').then(fs=>fs.writeFile('test-results/draft-validation.svg',draftExport));
  console.log('✓ Draft mode: element and relation popovers, formulas and final geometry, embedded view offsets, keyboard, notices and static SVG export');

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
  const subsetSource=multipleViewsSource.replace('views all','views detail, overview');
  await page.locator('#source').fill(subsetSource);await page.locator('#render-button').click();
  assert.deepEqual(await page.locator('#diagram [data-arch-view]').evaluateAll(elements=>elements.map(e=>e.dataset.archView)),['detail','overview']);
  await page.locator('#source').fill(subsetSource.replace('views detail, overview','views detail, missing'));await page.locator('#render-button').click();
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
  const partialSource = `architecture "Editing" {
    model {
      service a "Current A"
      service b "Not yet closed
      service c "Current C"
      relation e a -> c "Still visible"
    }
    view v "Preview" {
      route
      place c at (420, 0)
    }
  }`;
  await page.locator('#source').fill(partialSource);
  await page.waitForSelector('#diagram svg[data-arch-syntax]');
  assert.match(await page.locator('#diagram [data-node="c"]').textContent(), /Current C/);
  assert.equal(await page.locator('#diagram [data-node="b"]').count(), 0);
  assert.equal(await page.locator('#diagram [data-edge="e"]').count(), 1);
  assert.match(await page.locator('.arch-syntax-notices').textContent(), /line 4, column \d+/);
  assert.match(await page.locator('.arch-syntax-notices').textContent(), /line 9, column \d+/);
  await page.locator('#diagram ' + diagnosticLink('routing')).click();
  await diagnosticDialog.locator('svg[data-arch-help="routing"]').waitFor();
  assert.equal(await page.locator('#diagram [data-node="c"]').count(), 1);
  const helpBounds = await diagnosticDialog.boundingBox();
  await page.mouse.click(helpBounds.x + 4, helpBounds.y + 20);
  assert.equal(await diagnosticDialog.isVisible(), true);
  await page.mouse.click(helpBounds.x - 6, helpBounds.y + 20);
  await diagnosticDialog.waitFor({state:'detached'});
  assert.equal(await page.locator('#source').inputValue(), partialSource);
  assert.equal(await page.locator('#export-svg').isDisabled(), true);
  await page.locator('#source').fill(partialSource.replace('Current C', 'Updated C'));
  await page.waitForFunction(() => document.querySelector('#diagram [data-node="c"]')?.textContent.includes('Updated C'));
  await page.locator('#source').fill(partialSource.replace('"Not yet closed','"Now complete"').replace('route\n','route e { curve straight }\n'));
  await page.waitForSelector('#diagram [data-node="b"]');
  assert.equal(await page.locator('#diagram svg[data-arch-syntax]').count(),0);
  assert.equal(await page.locator('#export-svg').isDisabled(),false);

  const equipmentSource = `architecture "Equipment" {
    config {profile naf41-uaf validation draft}
    model {
      EquipmentType radio "Radio" {isStandardConfiguration true}
      EquipmentTyp equipmentType_commandPost "Command Post" {isStandardConfiguration true}
      EquipmentType aircraft "Aircraft" {isStandardConfiguration true}
      relation command radio -> equipmentType_commandPost "Depends on" {type PhysicalDependency}
    }
    view p2 "P2" {
      viewpoint P2
      include [radio, aircraft, equipmentType_commandPost]
      route command {}
    }
  }`;
  await page.locator('#source').fill(equipmentSource);
  await page.waitForSelector('#diagram .arch-syntax-notices[aria-label="Type errors"]');
  assert.equal(await page.locator('#diagram [data-node="aircraft"]').count(),1);
  assert.equal(await page.locator('#diagram [data-node="equipmentType_commandPost"]').count(),0);
  assert.match(await page.locator('#diagram .arch-syntax-notices').textContent(), /EquipmentType\?/);
  assert.equal(await page.locator('#error').isVisible(),false);
  await page.locator('#source').fill(equipmentSource.replace('EquipmentTyp equipmentType_commandPost','EquipmentType equipmentType_commandPost'));
  await page.waitForSelector('#diagram [data-node="equipmentType_commandPost"]');
  assert.equal(await page.locator('#diagram [data-edge="command"]').count(),1);
  assert.equal(await page.locator('#diagram .arch-syntax-notices').count(),0);

  const missingTypeSource = equipmentSource.replace('EquipmentTyp equipmentType_commandPost','EquipmentType equipmentType_commandPost')
    .replaceAll(/\bcommand\b/g,'p3.1').replace(' {type PhysicalDependency}', '');
  await page.locator('#source').fill(missingTypeSource);
  await page.waitForSelector('#diagram .arch-syntax-notices[aria-label="Type errors"]');
  assert.match(await page.locator('#diagram .arch-syntax-notices').textContent(), /Relationship p3\.1 requires an explicit type/);
  assert.equal(await page.locator('#diagram [data-node="equipmentType_commandPost"]').count(),1);
  assert.equal(await page.locator('#diagram [data-edge="p3.1"]').count(),0);
  await page.locator('#source').fill(missingTypeSource.replace('"Depends on"', '"Depends on" {type PhysicalDependency}'));
  await page.waitForSelector('#diagram [data-edge="p3.1"]', {state:'attached'});
  assert.equal(await page.locator('#diagram .arch-syntax-notices').count(),0);

  const resourceSource = (await readFile('examples/naf41-resource-viewpoints.arch', 'utf8'))
    .replace(/views \[p2, p3,[^\]]+\]/,'views [p2, p3]').replaceAll(/\bradioVoice\b/g,'p2.5');
  await page.locator('#source').fill(resourceSource.replace('    exclude p2.5\n',''));
  const viewpointNotice = page.locator('#diagram .arch-syntax-notices[aria-label="Viewpoint errors"]');
  await viewpointNotice.waitFor();
  assert.match(await viewpointNotice.textContent(), /Use exclude p2\.5/);
  assert.equal(await viewpointNotice.locator(diagnosticLink('viewpoints naf41-uaf P3')).count(), 1);
  assert.equal(await page.locator('#diagram [data-arch-view="p2"] [data-edge="p2.5"]').count(),1);
  assert.equal(await page.locator('#diagram [data-arch-view="p3"] [data-edge="p2.5"]').count(),0);
  assert.equal(await page.locator('#diagram [data-arch-view="p3"] [data-edge="signal"]').count(),1);
  await page.locator('#source').fill(resourceSource);
  await viewpointNotice.waitFor({state:'detached'});
  assert.equal(await page.locator('#export-svg').isDisabled(),false);

  await page.locator('#source').fill(resourceSource.replace('type ConveysPhysicalResource', 'type Conveyes'));
  const relationshipTypeNotice = page.locator('#diagram .arch-syntax-notices[aria-label="Type errors"]');
  await relationshipTypeNotice.waitFor();
  assert.match(await relationshipTypeNotice.textContent(), /Suggested relationship types.*type ConveysPhysicalResource/s);
  assert.doesNotMatch(await relationshipTypeNotice.textContent(), /ConveysLogicalResource/);
  await page.locator('#source').fill(resourceSource);
  await relationshipTypeNotice.waitFor({state:'detached'});

  const p5Source = resourceSource.replace('views [p2, p3]','views p5').replace('    diagram state\n','    diagram connected\n');
  await page.locator('#source').fill(p5Source.replace('enableApproach moving -> approach','enableApproach progress -> approach'));
  await relationshipTypeNotice.waitFor();
  assert.match(await relationshipTypeNotice.textContent(), /ResourceStateGroup.*StateEnablesResourceFunction/s);
  assert.match(await relationshipTypeNotice.textContent(), /Allowed source types: ResourceState/);
  assert.equal(await page.locator('#diagram [data-edge="enableApproach"]').count(),0);
  assert.equal(await page.locator('#diagram [data-edge="enableDeploy"]').count(),1);
  await page.locator('#source').fill(p5Source);
  await relationshipTypeNotice.waitFor({state:'detached'});
  assert.equal(await page.locator('#diagram [data-edge="enableApproach"]').count(),1);

  const abstractDiagnostic = 'architecture "Local" { config { type Base {abstract true} type Concrete {extends Base} } model {Base n "N"} }';
  await page.locator('#source').fill(abstractDiagnostic);
  const fatalLink = page.locator('#error ' + diagnosticLink('types . Base'));
  await fatalLink.click();
  await diagnosticDialog.locator('svg[data-arch-help="types"]').waitFor();
  assert.match(await diagnosticDialog.textContent(), /Concrete subtypes.*Concrete ID/s);
  assert.equal(await page.locator('#source').inputValue(), abstractDiagnostic);
  await closeDiagnosticHelp();

  await page.locator('#source').fill(original.replace('Your application', 'Edited application'));
  await page.waitForFunction(() => document.querySelector('#diagram svg').textContent.includes('Edited application'));
  await page.locator('#source').fill('architecture "Broken');
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
  await page.locator('#meta-diagnostics ' + diagnosticLink('json')).click();
  await diagnosticDialog.locator('svg[data-arch-help="json"]').waitFor();
  await closeDiagnosticHelp();
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
  await page.locator('#studio-divider[aria-orientation="horizontal"]').waitFor();
  const initialSourceHeight = (await editor.boundingBox()).height;
  await divider.press('ArrowDown');
  assert.ok(Math.abs((await editor.boundingBox()).height - initialSourceHeight - 16) < 1);
  await paneControls.getByRole('button',{name:'Preview',exact:true}).click();
  assert.equal(await editor.isVisible(),false);
  await paneControls.getByRole('button',{name:'Both',exact:true}).click();
  assert.ok(Math.abs((await editor.boundingBox()).height - initialSourceHeight - 16) < 1);
  await divider.dblclick();
  assert.equal((await editor.boundingBox()).height,initialSourceHeight);
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
  await direct.goto(pathToFileURL(path.resolve('studio.html')).href);
  await direct.waitForSelector('#diagram svg');
  assert.equal(await direct.locator('#error').isVisible(), false);
  const originalDraft = (await direct.locator('#source').inputValue()) + '\n# Keep this draft';
  await direct.locator('#source').fill(originalDraft);
  const importedDSL = 'architecture "Local model" { model { service svc "Imported service" } }\n# Original comment';
  await openModelFile(direct,'local.arch',importedDSL);
  await direct.locator('#diagram').getByText('Imported service',{exact:true}).waitFor();
  assert.equal(await direct.locator('#source').inputValue(),importedDSL);
  const importedJSON = JSON.stringify({architecture:{name:'Local JSON model',
    model:{elements:{api:{type:'service',name:'Imported JSON API'}}}}},null,2);
  await openModelFile(direct,'local.json',importedJSON);
  await direct.locator('#diagram').getByText('Imported JSON API',{exact:true}).waitFor();
  assert.equal(await direct.locator('#source').inputValue(),importedJSON);
  assert.equal(await direct.locator('#source-extension').textContent(),'.json');
  await direct.locator('[data-example="platform"]').click();
  assert.equal(await direct.locator('#source').inputValue(),originalDraft);
  await direct.getByRole('navigation',{name:'Opened files'}).getByRole('button',{name:/^local\.arch/}).click();
  assert.equal(await direct.locator('#source').inputValue(),importedDSL);
  console.log('✓ Studio opens local DSL and JSON through the file picker and preserves existing drafts');
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
  await direct.setViewportSize({width:1480,height:980});
  await direct.locator('[data-example="naf41-logical-activities"]').click();
  await direct.locator('#open-dashboard').click();
  const dashboard = direct.getByRole('dialog',{name:'Architecture dashboard'});
  const dashboardHelp = direct.getByRole('dialog',{name:'Architecture help'});
  await dashboard.getByRole('button',{name:'Help',exact:true}).click();
  await dashboardHelp.getByRole('button',{name:'@help config',exact:true}).click();
  await dashboardHelp.getByRole('heading',{name:'Browser presentation'}).waitFor();
  const presentationHelp = dashboardHelp.getByRole('heading',{name:'Browser presentation',exact:true}).locator('xpath=..');
  assert.deepEqual(await presentationHelp.locator('code').allTextContents(),['diagram','dashboard']);
  assert.equal(await dashboardHelp.locator('pre code').filter({hasText:'presentation dashboard'}).textContent(),
    'config {\n  presentation dashboard\n  views [overview, detail]\n}');
  await dashboardHelp.getByRole('button',{name:'Back',exact:true}).click();
  await dashboardHelp.getByRole('heading',{name:'arch.js · Help'}).waitFor();
  await dashboardHelp.getByRole('button',{name:'Forward',exact:true}).click();
  await dashboardHelp.getByRole('heading',{name:'Help · config'}).waitFor();
  await direct.keyboard.press('Escape');
  await dashboardHelp.waitFor({state:'hidden'});
  const liveSource = dashboard.getByRole('region',{name:'View source'});
  await dashboard.getByRole('button',{name:'Source',exact:true}).click();
  await liveSource.locator('.ad-code-keyword').first().waitFor();
  assert.match(await liveSource.locator('code').textContent(),/view l4 /);
  assert.match(await liveSource.locator('code').textContent(),/relation performLog /);
  assert.match(await liveSource.locator('code').textContent(),/OperationalActivity log /);
  await liveSource.getByRole('button',{name:'JSON'}).click();
  await liveSource.locator('.ad-code-key').first().waitFor();
  assert.ok(JSON.parse(await liveSource.locator('code').textContent()).architecture.views.l4);
  await dashboard.getByRole('button',{name:'Next view'}).click();
  let viewSource = JSON.parse(await liveSource.locator('code').textContent()).architecture;
  assert.deepEqual(Object.keys(viewSource.views),['l4Swimlane']);
  assert.ok(viewSource.model.relations.performLog,'Source retains swimlane performer links');
  await dashboard.getByRole('button',{name:'Back',exact:true}).click();
  await dashboard.getByRole('button',{name:'Diagram',exact:true}).click();
  const controlFlowLabel = dashboard.locator('.ad-diagram [data-label-for="logToAssess"]');
  await controlFlowLabel.locator('text').click();
  assert.match(await dashboard.locator('.ad-inspector').innerText(),/logToAssess/);
  assert.equal(await dashboard.locator('.ad-diagram [data-edge="logToAssess"][data-dashboard-highlight]').count(),1);
  assert.equal(await controlFlowLabel.getAttribute('data-dashboard-highlight'),'');
  await dashboard.locator('.ad-diagram [data-label-for="performLog"]').press('Enter');
  assert.match(await dashboard.locator('.ad-inspector').innerText(),/performLog/);
  await dashboard.locator('.ad-diagram [data-node="log"]').click();
  await dashboard.getByRole('heading',{name:'Used in 2 views'}).waitFor();
  await dashboard.getByRole('button',{name:/L4 · Activity lanes/}).last().click();
  await dashboard.locator('.ad-diagram svg[data-diagram="activity"]').waitFor();
  assert.ok(await dashboard.locator('[data-node="log"][data-dashboard-highlight]').count());
  await dashboard.getByRole('button',{name:'Back',exact:true}).click();
  await dashboard.locator('.ad-diagram [data-node="log"][data-dashboard-highlight]').waitFor();
  await dashboard.getByRole('button',{name:/^Elements /}).click();
  await dashboard.getByRole('searchbox').fill('regional');
  assert.equal(await dashboard.locator('.ad-results .ad-entry').count(),1);
  await dashboard.getByRole('searchbox').fill('');
  const assessEntry = dashboard.locator('.ad-results').getByRole('button',{name:/^Assess Situation/});
  await assessEntry.press('Enter');
  assert.equal(await assessEntry.getAttribute('aria-current'),'true');
  assert.ok(await assessEntry.evaluate(row=>row===row.ownerDocument.activeElement),'Navigation retains catalog focus');
  await dashboard.getByRole('button',{name:'Back',exact:true}).click();
  assert.equal(await assessEntry.getAttribute('aria-current'),null);
  await direct.screenshot({path:'test-results/architecture-dashboard.png'});
  const exported = direct.waitForEvent('download');
  await dashboard.getByRole('button',{name:'Download HTML'}).click();
  const dashboardFile='test-results/architecture-dashboard.html';
  await (await exported).saveAs(dashboardFile);
  const standalone=await browser.newPage({viewport:{width:420,height:900}});
  const dashboardErrors=[];
  standalone.on('pageerror',error => dashboardErrors.push(error.message));
  await standalone.goto(pathToFileURL(path.resolve(dashboardFile)).href);
  await standalone.locator('.ad-diagram svg').waitFor();
  await standalone.getByRole('button',{name:'Source',exact:true}).click();
  const offlineSource = standalone.getByRole('region',{name:'View source'});
  const keyword = offlineSource.locator('.ad-code-keyword').first();
  await keyword.waitFor();
  assert.notEqual(await keyword.evaluate(token=>getComputedStyle(token).color),
    await offlineSource.locator('code').evaluate(code=>getComputedStyle(code).color));
  await offlineSource.getByRole('button',{name:'JSON'}).click();
  await offlineSource.locator('.ad-code-key').first().waitFor();
  assert.ok(JSON.parse(await offlineSource.locator('code').textContent()).architecture.views.l4);
  await offlineSource.getByRole('button',{name:'Copy source'}).click();
  await offlineSource.getByRole('status').filter({hasText:/Copied|Selected for copying/}).waitFor();
  await standalone.getByRole('button',{name:'Diagram',exact:true}).click();
  await standalone.getByRole('button',{name:'Help',exact:true}).click();
  const offlineHelp=standalone.getByRole('dialog',{name:'Architecture help'});
  await offlineHelp.getByRole('button',{name:'@help config',exact:true}).click();
  await offlineHelp.getByRole('heading',{name:'Browser presentation'}).waitFor();
  assert.equal(await offlineHelp.locator('pre code').filter({hasText:'presentation dashboard'}).count(),1);
  await offlineHelp.getByRole('button',{name:'Close help'}).click();
  await standalone.getByRole('button',{name:'Viewpoint help'}).click();
  await offlineHelp.getByRole('heading',{name:'Required model contents'}).waitFor();
  await offlineHelp.getByRole('button',{name:'Close help'}).click();
  await standalone.locator('.ad-diagram [data-label-for="performLog"]').click();
  assert.match(await standalone.locator('.ad-inspector').innerText(),/performLog/);
  await standalone.getByRole('button',{name:'Present',exact:true}).click();
  await standalone.keyboard.press('ArrowRight');
  await standalone.locator('.ad-diagram svg[data-diagram="activity"]').waitFor();
  assert.ok(await standalone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await standalone.locator('.ad-diagram svg').evaluate(svg => {
    const canvas = svg.closest('.ad-canvas');
    const drawing = svg.getBoundingClientRect();
    return drawing.width > 0 && drawing.width <= canvas.clientWidth && drawing.height <= canvas.clientHeight;
  }), 'Offline presentation fits a view on a narrow screen');
  assert.deepEqual(dashboardErrors,[]);
  await standalone.close();
  await dashboard.getByRole('button',{name:'Close',exact:true}).click();
  const dashboardSource=(await direct.locator('#source').inputValue()).replace('profile naf41-uaf','profile naf41-uaf presentation dashboard views l4Swimlane');
  await direct.locator('#source').fill(dashboardSource);
  await dashboard.locator('.ad-diagram svg[data-diagram="activity"]').waitFor();
  assert.equal(await dashboard.locator('.ad-results .ad-entry').count(),2);
  await dashboard.getByRole('button',{name:'Close',exact:true}).click();
  await direct.locator('#render-button').click();
  assert.equal(await dashboard.isVisible(),false);
  assert.equal(await direct.locator('#export-svg').isEnabled(),true);
  const domPresentation=await direct.evaluate(source=>{
    const root=document.createElement('div');
    const mounted=arch.render(root,source);
    const configured=mounted.matches('.arch-dashboard') && mounted.querySelector('.ad-diagram svg').dataset.diagram==='activity';
    const override=arch.render(root,source,{presentation:'diagram'}).dataset.diagram==='activity';
    const help=arch.render(root,'@help',{presentation:'dashboard'}).dataset.archHelp==='overview';
    const fallback=arch.render(root,source.replace('views l4Swimlane','views all')).querySelector('.ad-viewbar h2').textContent;
    const block=document.createElement('div');
    block.setAttribute('data-arch','');
    block.textContent=source;
    root.replaceChildren(block);
    const [converted]=arch.renderAll({root});
    return {configured,override,help,fallback,converted:converted.matches('.arch-dashboard')};
  },dashboardSource);
  assert.deepEqual(domPresentation,{configured:true,override:true,help:true,fallback:'L4 · Logical Activities',converted:true});
  console.log('✓ Configured dashboard, cross-view reuse, live and offline help, keyboard presentation and standalone HTML');

  const markdownPage = await browser.newPage({viewport:{width:1480,height:980}});
  const imageURL = new URL('portable-test.gif',address).href;
  await markdownPage.route(imageURL,route=>route.fulfill({contentType:'image/gif',
    body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}));
  await markdownPage.route(new URL('portable-test.svg',address).href,route=>route.fulfill({contentType:'image/svg+xml',
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>'}));
  const embeddedSource = `architecture "Portable review" {
    # Keep this original comment
    config {profile "portable-fixture@2" presentation dashboard views overview}
    model {Tool app "Review service" {icon portable.sample backgroundImage "portable-test.gif"}}
    view overview "Overview" {}
    view details "Details" {backgroundImage "portable-test.svg" showBackgroundImage true}
  }`;
  async function embedDashboards() {
    await markdownPage.goto(address);
    await markdownPage.addScriptTag({url:new URL('arch.min.js',address).href});
    await markdownPage.evaluate(source=>{
      arch.registerProfile('portable-fixture',{version:'2',extends:'default',nodeTypes:{Tool:{template:'service'}}});
      arch.registerIconPack('portable',{icons:{sample:{body:'<circle cx="8" cy="8" r="6" fill="#ff0000"/>'}}});
      const root=document.createElement('article');
      for (const key of ['review','other']) {
        const block=document.createElement('pre'), code=document.createElement('code');
        block.dataset.archNotesKey=key;
        code.className='language-arch';
        code.textContent=source;
        block.append(code);
        root.append(block);
      }
      document.body.replaceChildren(root);
      arch.renderAll({root});
    },embeddedSource);
  }
  const review = markdownPage.locator('[data-arch-notes-key="review"]');
  const notesDialog = markdownPage.getByRole('dialog',{name:'Architecture notes'});
  const architectureNote = 'Literal </script><script>window.portableInjected=true</script>';
  await embedDashboards();
  await review.getByRole('button',{name:'Notes',exact:true}).click();
  await notesDialog.getByRole('textbox',{name:'Architecture notes',exact:true}).fill(architectureNote);
  await notesDialog.getByRole('textbox',{name:'View notes · Overview',exact:true}).fill('Review the overview.');
  await notesDialog.getByRole('button',{name:'Close notes'}).click();
  await markdownPage.locator('[data-arch-notes-key="other"]').getByRole('button',{name:'Notes',exact:true}).click();
  assert.equal(await notesDialog.getByRole('textbox',{name:'Architecture notes',exact:true}).inputValue(),'');
  await notesDialog.getByRole('button',{name:'Close notes'}).click();
  await embedDashboards();
  await review.getByRole('button',{name:'Notes',exact:true}).click();
  assert.equal(await notesDialog.getByRole('textbox',{name:'Architecture notes',exact:true}).inputValue(),architectureNote);
  assert.equal(await notesDialog.getByRole('textbox',{name:'View notes · Overview',exact:true}).inputValue(),'Review the overview.');
  await notesDialog.getByRole('button',{name:'Close notes'}).click();
  await review.getByRole('button',{name:'Next view'}).click();
  await review.getByRole('button',{name:'Notes',exact:true}).click();
  await notesDialog.getByRole('textbox',{name:'View notes · Details',exact:true}).fill('Details follow-up.');
  await notesDialog.getByRole('button',{name:'Close notes'}).click();
  for (const [label,extension] of [['SVG','svg'],['draw.io','drawio'],['Visio','vsdx'],['Excalidraw','excalidraw']]) {
    await review.locator('.ad-export-menu summary').click();
    const [file] = await Promise.all([markdownPage.waitForEvent('download'),
      review.getByRole('button',{name:`Export ${label}`,exact:true}).click()]);
    assert.equal(file.suggestedFilename(),`portable-review-details.${extension}`);
    const bytes = await readFile(await file.path());
    if (extension==='vsdx') assert.equal(bytes.readUInt32LE(0),0x04034b50);
    else assert.match(bytes.toString(),/data:image\/png[;,]/);
  }
  const exportedStudioEvent=markdownPage.waitForEvent('download');
  await review.getByRole('button',{name:'Download Studio',exact:true}).click();
  const exportedStudio=await exportedStudioEvent;
  const studioFile='test-results/portable-review-studio.html';
  await exportedStudio.saveAs(studioFile);
  const snapshotEvent=markdownPage.waitForEvent('download');
  await review.getByRole('button',{name:'Download HTML',exact:true}).click();
  const snapshot=await snapshotEvent;
  const snapshotMarkup=await readFile(await snapshot.path(),'utf8');
  const snapshotData=JSON.parse(snapshotMarkup.match(/id="model">([^]*?)<\/script>/)[1]);
  assert.equal(snapshotData.notes.architecture,architectureNote);
  assert.deepEqual(snapshotData.notes.views,{overview:'Review the overview.',details:'Details follow-up.'});
  assert.match(snapshotData.report.previews.details.svg,/data:image\/png;base64,/);
  assert.match(snapshotData.report.previews.details.svg,/data-arch-image-source="portable-test.svg"/);
  const snapshotFile = 'test-results/portable-review-local.html';
  await snapshot.saveAs(snapshotFile);
  const nearbyImage = 'test-results/portable-test.svg';
  await writeFile(nearbyImage,'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="tomato"/></svg>');
  const nearbyURL = pathToFileURL(path.resolve(nearbyImage)).href;
  await markdownPage.close();

  const localSnapshot = await browser.newPage({viewport:{width:1480,height:980}});
  await localSnapshot.goto(pathToFileURL(path.resolve(snapshotFile)).href);
  await localSnapshot.locator('.ad-diagram image[data-background-image="node"][href^="data:image/gif;"]').waitFor();
  assert.equal(await localSnapshot.locator('.ad-diagram image[data-background-image="view"]').getAttribute('href'),nearbyURL);
  assert.ok(await assertPaintedImage(localSnapshot,localSnapshot.locator('.ad-diagram > svg')));
  await localSnapshot.close();

  const portable = await browser.newPage({viewport:{width:1480,height:980}});
  const portableErrors = [], portableRequests = [];
  portable.on('pageerror',error=>portableErrors.push(error.message));
  portable.on('request',request=>portableRequests.push(request.url()));
  await portable.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}});
  });
  await portable.goto(pathToFileURL(path.resolve(studioFile)).href);
  const portableDashboard = portable.getByRole('dialog',{name:'Architecture dashboard'});
  await portableDashboard.locator('.ad-viewbar').getByRole('heading',{name:'Details',exact:true}).waitFor();
  await portableDashboard.locator('.ad-diagram image[data-background-image="node"][href^="data:image/gif;"]').waitFor();
  assert.equal(await portableDashboard.locator('.ad-diagram image[data-background-image="view"]').getAttribute('href'),nearbyURL);
  assert.ok(await assertPaintedImage(portable,portableDashboard.locator('.ad-diagram > svg')));
  assert.equal(await portableDashboard.locator('.ad-diagram [data-icon="portable.sample"]').count(),1);
  assert.equal(await portableDashboard.getByRole('button',{name:'Notes',exact:true}).getAttribute('aria-description'),'3 saved notes');
  await portableDashboard.getByRole('button',{name:'Open notes for Overview',exact:true}).click();
  const portableNotes=portable.getByRole('dialog',{name:'Architecture notes'});
  assert.equal(await portableNotes.getByRole('textbox',{name:'View notes · Overview',exact:true}).inputValue(),'Review the overview.');
  assert.ok(await portableNotes.getByRole('textbox',{name:'View notes · Overview',exact:true}).evaluate(node=>document.activeElement===node));
  await portableNotes.getByRole('navigation',{name:'Jump to saved note'}).getByRole('button',{name:'Details',exact:true}).click();
  assert.equal(await portableNotes.getByRole('textbox',{name:'Architecture notes',exact:true}).inputValue(),architectureNote);
  assert.equal(await portableNotes.getByRole('textbox',{name:'View notes · Details',exact:true}).inputValue(),'Details follow-up.');
  assert.match(await portableNotes.getByRole('status').textContent(),/storage unavailable/i);
  await portableNotes.getByRole('textbox',{name:'View notes · Details',exact:true}).fill('Updated offline.');
  await portableNotes.getByRole('button',{name:'Close notes'}).click();
  await portableDashboard.getByRole('button',{name:'Edit source',exact:true}).click();
  assert.equal(await portable.locator('#source').inputValue(),embeddedSource);
  assert.equal(await portable.locator('#diagram image[data-background-image="view"]').getAttribute('href'),nearbyURL);
  await portable.locator('#studio-export summary').click();
  const [offlineDiagram] = await Promise.all([portable.waitForEvent('download'),
    portable.getByRole('button',{name:'Export Excalidraw',exact:true}).click()]);
  const offlineScene = JSON.parse(await readFile(await offlineDiagram.path(),'utf8'));
  assert.equal(offlineScene.elements.filter(element=>element.type==='image').length,2);
  assert.ok(Object.values(offlineScene.files).every(file=>file.dataURL.startsWith('data:image/png;base64,')));
  const portablePanes = portable.getByRole('group',{name:'Pane layout'});
  await portablePanes.getByRole('button',{name:'Editor',exact:true}).click();
  assert.equal(await portable.locator('#preview-panel').isVisible(),false);
  await portablePanes.getByRole('button',{name:'Both',exact:true}).click();
  assert.equal(await portable.getByRole('separator',{name:'Resize editor and preview'}).isVisible(),true);
  await portable.locator('#source').fill(embeddedSource.replace('Review service','Changed offline'));
  await portable.locator('#render-button').click();
  await portable.locator('#diagram').getByText('Changed offline',{exact:true}).waitFor();
  await portable.locator('#open-dashboard').click();
  const secondExport=portable.waitForEvent('download');
  await portableDashboard.getByRole('button',{name:'Download Studio',exact:true}).click();
  const again=await secondExport;
  const againMarkup=await readFile(await again.path(),'utf8');
  const workspaceData=JSON.parse(againMarkup.match(/id="studio-workspace">([^]*?)<\/script>/)[1]);
  assert.equal(workspaceData.notes.views.details,'Updated offline.');
  assert.match(workspaceData.source,/Changed offline/);
  await portableDashboard.getByRole('button',{name:'Edit source',exact:true}).click();
  await openModelFile(portable,'offline.arch','architecture "Offline import" { model { service svc "Imported offline" } }');
  await portable.locator('#diagram').getByText('Imported offline',{exact:true}).waitFor();
  await portable.locator('[data-example="workspace"]').click();
  await portableDashboard.locator('.ad-viewbar').getByRole('heading',{name:'Details',exact:true}).waitFor();
  assert.match(await portable.locator('#source').inputValue(),/Changed offline/);
  assert.equal(await portable.evaluate(()=>window.portableInjected),undefined);
  assert.deepEqual(portableErrors,[]);
  assert.ok(portableRequests.every(url=>url.startsWith('file:') || url.startsWith('data:')));
  await portable.close();
  console.log('✓ Markdown dashboards isolate and autosave notes, export both HTML formats, and reopen and re-export editable Studio offline');

  const imageSource = 'architecture "Local images" { config { presentation dashboard } model {system svc "Service"} view main "Main" {backgroundImage "./map.svg"} }';
  const localImage = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="24"><rect width="40" height="24" fill="tomato"/></svg>';
  async function assertPaintedImage(page, preview) {
    let pixel;
    for (let attempt=0;attempt<10;attempt++) {
      const screenshot = await preview.screenshot();
      pixel = await page.evaluate(async data => {
        const image = new Image();
        image.src = 'data:image/png;base64,'+data;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width=image.width;
        canvas.height=image.height;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(image,0,0);
        return [...ctx.getImageData(Math.round(image.width*.08),Math.round(image.height*.1),1,1).data];
      },screenshot.toString('base64'));
      if (pixel[0]-pixel[1]>30 && pixel[0]-pixel[2]>30) return pixel;
    }
    assert.fail(`Expected the tinted background image in the live preview, got ${pixel}`);
  }
  const assertSamePixel = (actual,expected) => assert.ok(actual.every((channel,i)=>Math.abs(channel-expected[i])<=2),
    `Expected ${expected}, got ${actual}`);
  const assetPage = await browser.newPage();
  const imageRequests = [];
  assetPage.on('request',request=>{
    if (request.url().endsWith('/map.svg')) imageRequests.push(request.url());
  });
  await assetPage.route(new URL('available/map.svg',address).href,route=>route.fulfill({contentType:'image/svg+xml',body:localImage}));
  await assetPage.route(new URL('missing/map.svg',address).href,route=>route.fulfill({status:404,body:'Not found'}));
  await assetPage.goto(address);
  await assetPage.addScriptTag({url:new URL('arch.min.js',address).href});
  await assetPage.evaluate(source => {
    for (const id of ['available','missing','diagram']) {
      const host=document.createElement('div');
      host.id=id;
      host.dataset.archImageBase=id==='diagram' ? '/available/' : `/${id}/`;
      document.body.append(host);
      arch.render(host,source,id==='diagram' ? {presentation:'diagram'} : undefined);
    }
  },imageSource);
  for (const id of ['available','diagram']) {
    assert.equal(await assetPage.locator(`#${id} svg image`).getAttribute('href'),new URL('available/map.svg',address).href);
  }
  const diagramPixel = await assertPaintedImage(assetPage,assetPage.locator('#diagram svg'));
  assertSamePixel(await assertPaintedImage(assetPage,assetPage.locator('#available .ad-diagram svg')),diagramPixel);
  assert.equal(imageRequests.includes(new URL('map.svg',address).href),false);
  const available = assetPage.locator('#available');
  const [availableHTML] = await Promise.all([assetPage.waitForEvent('download'),available.getByRole('button',{name:'Download HTML',exact:true}).click()]);
  const availableMarkup = await readFile(await availableHTML.path(),'utf8');
  const availableSVG = JSON.parse(availableMarkup.match(/id="model">([^]*?)<\/script>/)[1]).report.previews.main.svg;
  const suppliedImage = availableSVG.match(/href="(data:image\/png;base64,[^"]+)"/)[1];
  await assetPage.evaluate(({source,data}) => {
    const host = document.createElement('div');
    host.id='supplied-image';
    document.body.append(host);
    window.suppliedImageLoads=0;
    arch.renderDashboard(host,source,{baseURL:'/supplied/',loadImage:async () => {
      window.suppliedImageLoads++;
      return data;
    }});
  },{source:imageSource,data:suppliedImage});
  const supplied = assetPage.locator('#supplied-image');
  assertSamePixel(await assertPaintedImage(assetPage,supplied.locator('.ad-diagram svg')),diagramPixel);
  const [suppliedHTML] = await Promise.all([assetPage.waitForEvent('download'),supplied.getByRole('button',{name:'Download HTML',exact:true}).click()]);
  const suppliedMarkup = await readFile(await suppliedHTML.path(),'utf8');
  assert.ok(JSON.parse(suppliedMarkup.match(/id="model">([^]*?)<\/script>/)[1]).report.previews.main.svg.includes(suppliedImage));
  assert.equal(await assetPage.evaluate(()=>window.suppliedImageLoads),1);
  assert.equal(imageRequests.includes(new URL('supplied/map.svg',address).href),false);
  const missing = assetPage.locator('#missing');
  await missing.getByRole('button',{name:'Attach image',exact:true}).waitFor();
  assert.match(await missing.locator('.ad-image-status').textContent(),/\/missing\/map\.svg/);
  const htmlEvent = assetPage.waitForEvent('download');
  await missing.getByRole('button',{name:'Download HTML',exact:true}).click();
  const picker = assetPage.getByRole('dialog',{name:'Attach background image'});
  await picker.getByText(/Image request returned 404.*\/missing\/map\.svg/).waitFor();
  await picker.getByLabel('Choose image file').setInputFiles({name:'map.svg',mimeType:'image/svg+xml',buffer:Buffer.from(localImage)});
  const attachedHTML = await htmlEvent;
  const attachedMarkup = await readFile(await attachedHTML.path(),'utf8');
  const attachedSVG = JSON.parse(attachedMarkup.match(/id="model">([^]*?)<\/script>/)[1]).report.previews.main.svg;
  assert.match(attachedSVG,/href="data:image\/png;base64,/);
  assert.match(await missing.locator('svg image').getAttribute('href'),/^data:image\/png;base64,/);
  assertSamePixel(await assertPaintedImage(assetPage,missing.locator('.ad-diagram svg')),diagramPixel);
  assert.equal(await missing.locator('.ad-image-status').isVisible(),false);
  assert.equal(await available.locator('svg image').getAttribute('href'),new URL('available/map.svg',address).href);
  const [attachedStudio] = await Promise.all([assetPage.waitForEvent('download'),missing.getByRole('button',{name:'Download Studio',exact:true}).click()]);
  const studioMarkup = await readFile(await attachedStudio.path(),'utf8');
  const attachment = JSON.parse(studioMarkup.match(/id="studio-workspace">([^]*?)<\/script>/)[1]).images[0];
  assert.equal(attachment[0],'./map.svg');
  assert.match(attachment[1],/^data:image\/png;base64,/);
  await missing.locator('.ad-export-menu summary').click();
  const [attachedScene] = await Promise.all([assetPage.waitForEvent('download'),missing.getByRole('button',{name:'Export Excalidraw',exact:true}).click()]);
  const attachedFiles = Object.values(JSON.parse(await readFile(await attachedScene.path(),'utf8')).files);
  assert.equal(attachedFiles.length,1);
  assert.match(attachedFiles[0].dataURL,/^data:image\/png;base64,/);

  await assetPage.route(new URL('preview/*.svg',address).href,route=>route.fulfill({contentType:'image/svg+xml',body:localImage}));
  await assetPage.evaluate(source => {
    const host = document.createElement('pre');
    host.id = 'host-rewrite';
    document.body.append(host);
    const code = document.createElement('code');
    code.className = 'language-arch';
    code.textContent = source.replace(/}\s*$/, 'view other "Other" {backgroundImage "./other.svg"} }');
    host.append(code);
    arch.renderAll({root:host});
    // LivePreview rewrites relative resources once, after arch.renderAll.
    for (const image of host.querySelectorAll('svg image')) {
      const href = image.getAttribute('href');
      if (href?.startsWith('./')) image.setAttribute('href','/preview/'+href.slice(2));
    }
  },imageSource);
  const rewritten = assetPage.locator('#host-rewrite');
  assert.equal(await rewritten.locator('svg image').getAttribute('href'),'/preview/map.svg');
  assertSamePixel(await assertPaintedImage(assetPage,rewritten.locator('.ad-diagram svg')),diagramPixel);
  const [rewrittenHTML] = await Promise.all([assetPage.waitForEvent('download'),rewritten.getByRole('button',{name:'Download HTML',exact:true}).click()]);
  const rewrittenMarkup = await readFile(await rewrittenHTML.path(),'utf8');
  const previews = JSON.parse(rewrittenMarkup.match(/id="model">([^]*?)<\/script>/)[1]).report.previews;
  for (const view of ['main','other']) assert.match(previews[view].svg,/href="data:image\/png;base64,/);
  await rewritten.getByRole('button',{name:'Next view'}).click();
  assert.equal(await rewritten.locator('svg image').getAttribute('href'),new URL('preview/other.svg',address).href);
  assertSamePixel(await assertPaintedImage(assetPage,rewritten.locator('.ad-diagram svg')),diagramPixel);
  await assetPage.close();

  await mkdir('test-results/local-image',{recursive:true});
  await writeFile('test-results/local-image/map.svg',localImage);
  await writeFile('test-results/local-image/index.html',`<!doctype html><script src="../../arch.min.js"></script><main id="host"></main>
    <script>arch.render('#host',${JSON.stringify(imageSource)})</script>`);
  const localPage = await browser.newPage();
  await localPage.goto(pathToFileURL(path.resolve('test-results/local-image/index.html')).href);
  assert.match(await localPage.locator('#host svg image').evaluate(image=>new URL(image.getAttribute('href'),image.baseURI).href),/^file:.*\/local-image\/map\.svg$/);
  const localPreview = localPage.locator('#host .ad-diagram svg');
  assertSamePixel(await assertPaintedImage(localPage,localPreview),diagramPixel);
  await localPage.locator('.ad-export-menu summary').click();
  const localDownload = localPage.waitForEvent('download');
  await localPage.getByRole('button',{name:'Export SVG',exact:true}).click();
  const localPicker = localPage.getByRole('dialog',{name:'Attach background image'});
  await localPicker.getByText(/Choose the local image to include/).waitFor();
  await localPicker.getByLabel('Choose image file').setInputFiles('test-results/local-image/map.svg');
  assert.match(await readFile(await (await localDownload).path(),'utf8'),/href="data:image\/png;base64,/);
  assertSamePixel(await assertPaintedImage(localPage,localPreview),diagramPixel);
  await localPage.close();
  console.log('✓ Live image pixels, scoped resolvers, Dashboard 404 recovery, and portable downloads over HTTP and file://');

  await direct.setViewportSize({width:1960,height:1200});
  await direct.locator('[data-example="taxonomy"]').click();
  await direct.locator('#open-dashboard').click();
  const taxonomy = dashboard.locator('.ad-diagram svg[data-diagram="tree"]');
  const dimensions = () => taxonomy.evaluate(svg => {
    const {width,height} = svg.getBoundingClientRect();
    const canvas = svg.closest('.ad-canvas');
    return {width,height,nativeWidth:svg.viewBox.baseVal.width,canvasHeight:canvas.clientHeight};
  });
  const wide = await dimensions();
  assert.ok(wide.width > 0 && wide.width <= wide.nativeWidth+1, 'C1 is never enlarged by Fit on a wide screen');
  await direct.setViewportSize({width:1960,height:740});
  const fitted = await dimensions();
  assert.ok(fitted.width < wide.width && fitted.height < fitted.canvasHeight, 'C1 responds to the available height');
  await dashboard.getByRole('button',{name:'Zoom in'}).click();
  assert.ok((await dimensions()).width > fitted.width, 'Manual zoom can enlarge a fitted view');
  await dashboard.getByRole('button',{name:'Fit',exact:true}).click();
  assert.ok(Math.abs((await dimensions()).width-fitted.width) < 1);
  await dashboard.getByRole('button',{name:'Present',exact:true}).click();
  const presentationFit = await dimensions();
  await dashboard.getByRole('button',{name:'Zoom out'}).click();
  assert.ok((await dimensions()).width < presentationFit.width, 'Zoom controls work in presentation mode');
  await dashboard.getByRole('button',{name:'Close',exact:true}).click();
  console.log('✓ Dashboard fits C1 to both dimensions and retains manual zoom in presentations');
  await direct.setViewportSize({width:1680,height:1080});
  await direct.locator('[data-example="naf41-foundation-viewpoints"]').click();
  const gridSource=(await direct.locator('#source').inputValue())
    .replace('NafViewpoint logical "Logical Structure" { nafViewpoint L2 }',`Viewpoint logical "L2 Logical Scenario" ${naf41Cases.L2}`)
    .replace('model {',`model { ${naf41Cases['L2-L3']}`)
    .replace('views all','views a2')
    .replace('understanding, resources]\n    diagram nafgrid','understanding, resources, logicalDiagram]\n    diagram nafgrid')
    .replace(/}\s*$/, `view logicalDiagram "SAR Logical Scenario Diagram" {
      viewpoint L2 include centre,team,need represents logicalView
    }
    view logicalAlternate "Alternate SAR diagram" { extends logicalDiagram }
    view logicalConcept "SAR Concept Diagram" { viewpoint L2-L3 include concept }
  }`);
  await direct.locator('#source').fill(gridSource);
  await direct.locator('#render-button').click();
  await direct.locator('#open-dashboard').click();
  const l2Cell=dashboard.locator('.ad-diagram [data-naf-cell="L2"]');
  await l2Cell.waitFor();
  assert.equal(await l2Cell.getAttribute('data-product-count'),'1');
  assert.equal(await l2Cell.getAttribute('data-diagram-count'),'2');
  assert.equal(await l2Cell.getAttribute('data-grid-state'),'selected');
  assert.equal(await l2Cell.locator('.arch-grid-tile-frame').evaluate(el=>getComputedStyle(el).fill),'rgb(106, 90, 205)');
  assert.equal(await l2Cell.locator('.arch-grid-tile-frame').evaluate(el=>getComputedStyle(el).fillOpacity),'0.2');
  const conceptCell = dashboard.locator('.ad-diagram [data-naf-cell="L2-L3"]');
  assert.equal(await conceptCell.getAttribute('data-diagram-count'),'1');
  assert.match(await conceptCell.locator('text[transform]').getAttribute('transform'),/^rotate\(-90 /);
  const tileWidth = tile => tile.locator('.arch-grid-tile-frame').getAttribute('width').then(Number);
  assert.ok(await tileWidth(conceptCell) < await tileWidth(l2Cell));
  assert.equal(await l2Cell.locator('[data-node], [data-view-link]').count(),0);
  await l2Cell.locator('.arch-grid-tile-frame').press('Enter');
  assert.equal(await l2Cell.getAttribute('data-grid-state'),'selected');
  const gridInspector=dashboard.locator('.ad-inspector');
  await gridInspector.getByRole('button',{name:/^SAR Logical Scenario Architecture product/}).click();
  await dashboard.getByRole('heading',{name:'SAR Logical Scenario',exact:true}).waitFor();
  assert.equal(await dashboard.getByRole('heading',{name:'Open diagram',exact:true}).count(),1);
  await dashboard.getByRole('button',{name:'Back',exact:true}).click();
  await gridInspector.getByRole('button',{name:/^SAR Logical Scenario Diagram L2/}).click();
  await dashboard.locator('.ad-viewbar').getByRole('heading',{name:'SAR Logical Scenario Diagram',exact:true}).waitFor();
  await dashboard.getByRole('button',{name:'Back',exact:true}).click();
  await l2Cell.waitFor();
  await dashboard.getByRole('button',{name:'Back',exact:true}).click();
  assert.equal(await l2Cell.getAttribute('data-grid-state'),'selected');
  assert.equal(await dashboard.locator('[data-naf-cell="A1"]').getAttribute('data-grid-state'),'available');
  await direct.screenshot({path:'test-results/architecture-dashboard-grid.png'});
  await dashboard.getByRole('button',{name:'Close',exact:true}).click();
  await direct.locator('#source').fill(gridSource.replace('diagram nafgrid','diagram nafgrid {show selected}'));
  await direct.locator('#render-button').click();
  await direct.locator('#open-dashboard').click();
  await l2Cell.locator('.arch-grid-tile-frame').press('Enter');
  assert.equal(await l2Cell.getAttribute('data-diagram-count'),'1');
  assert.equal(await dashboard.locator('[data-naf-cell="A1"]').count(),0);
  assert.equal(await gridInspector.getByRole('button',{name:/^Alternate SAR diagram/}).count(),0);
  assert.equal(await gridInspector.getByRole('button',{name:/^SAR Logical Scenario Diagram L2/}).getAttribute('aria-current'),'true');
  await dashboard.getByRole('button',{name:'Close',exact:true}).click();
  await direct.locator('#source').fill(gridSource.replace('diagram nafgrid','diagram nafgrid {show coverage}'));
  await direct.locator('#render-button').click();
  await direct.locator('#open-dashboard').click();
  const unmodeledCell = dashboard.locator('.ad-diagram [data-naf-cell="P2"]');
  await unmodeledCell.waitFor();
  assert.equal(await unmodeledCell.getAttribute('data-grid-coverage'),'unmodeled');
  assert.equal(await unmodeledCell.getAttribute('data-product-count'),'1');
  assert.equal(await unmodeledCell.locator('.arch-grid-tile-frame').evaluate(el=>getComputedStyle(el).fill),'rgb(227, 230, 236)');
  const coverageCell = dashboard.locator('.ad-diagram [data-naf-cell="A2"]');
  assert.equal(await coverageCell.getAttribute('data-grid-coverage'),'modeled');
  assert.equal(await coverageCell.getAttribute('data-grid-views'),'a2');
  assert.equal(await coverageCell.locator('.arch-grid-tile-frame').evaluate(el=>getComputedStyle(el).fillOpacity),'0.2');
  assert.equal(await conceptCell.getAttribute('data-grid-coverage'),'modeled');
  assert.equal(await conceptCell.getAttribute('data-grid-state'),'available');
  assert.equal(await conceptCell.locator('.arch-grid-tile-frame').evaluate(el=>getComputedStyle(el).fill),'rgb(106, 90, 205)');
  await direct.screenshot({path:'test-results/architecture-dashboard-coverage.png'});
  await conceptCell.locator('.arch-grid-tile-frame').press('Enter');
  await gridInspector.getByRole('button',{name:/^SAR Concept Diagram L2-L3/}).click();
  await dashboard.locator('.ad-viewbar').getByRole('heading',{name:'SAR Concept Diagram',exact:true}).waitFor();
  await dashboard.getByRole('button',{name:'Close',exact:true}).click();
  console.log('✓ A2 tile colors, vertical L2-L3, include selection, and diagram coverage');
  await direct.close();
  assert.ok(requests.every(url => url.startsWith(address) || url.startsWith('data:')), requests.filter(url => !url.startsWith(address)));
  assert.deepEqual(errors, []);
  console.log('✓ file:// launch, zero external requests, zero JavaScript errors');
  console.log('Browser checks passed. Screenshots: test-results/');
} finally {
  await browser?.close(); child.kill('SIGTERM');
}
