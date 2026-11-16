/* global arch, ARCH_EXAMPLES, ARCH_ICON_PACKS */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const source = $('source'), diagram = $('diagram'), canvas = $('canvas');
  const html = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const configuredViews = '@configured';
  const metaView = '@meta';
  let metaResult;
  const sourceIsJSON = () => /^[\s\uFEFF]*[\[{]/.test(source.value);
  let viewOverride = false;
  let currentExample, model, viewId, theme, profileOverride, zoom = 1, bounds, debounce, toastTimeout, lastSvg;
  const drafts = new Map();
  function highlight() {
    $('source-extension').textContent = sourceIsJSON() ? '.json' : '.arch';
    $('source-format').textContent = sourceIsJSON() ? 'json' : 'arch';
    // Tokenize before escaping so quotes/entities cannot break markup.
    const token = /"(?:\\.|[^"\\])*"|#[^\n]*|\/\/[^\n]*|@help\b|\b(?:architecture|model|view|diagram|participants|messages|returns|asyncMessages|lanes|laneAttribute|initial|finals|decisions|forks|joins|rows|columns|valueAttribute|parentAttribute|startAttribute|endAttribute|ownerAttribute|signatureAttribute|methods|functions|interfaces|ports|parameters|config|views|all|profile|styleGroup|backgroundColor|opacity|extends|attribute|attributes|required|enum|abstract|container|contains|defaultRelation|requireViewpoint|viewpoint|nodes|relations|requiredNodes|requiredRelations|incoming|outgoing|allowSelf|min|max|minLength|maxLength|description|technology|icon|stereotype|tags|person|system|application|service|component|database|queue|interface|capability|process|artifact|node|package|relation|type|direction|spacing|theme|include|exclude|place|at|size|style|accent|template|route|from|to|via|curve|path|label)\b|-?\b\d+(?:\.\d+)?\b/g;
    let result = '', previous = 0;
    for (const match of source.value.matchAll(token)) {
      result += html(source.value.slice(previous, match.index));
      const text = match[0];
      const kind = text[0] === '"' ? 'string' : /^(#|\/\/)/.test(text) ? 'comment' : /^-?\d/.test(text) ? 'number' : 'keyword';
      result += `<span class="token-${kind}">${html(text)}</span>`; previous = match.index + text.length;
    }
    $('highlight').innerHTML = result + html(source.value.slice(previous)) + '\n';
    $('line-numbers').textContent = Array.from({length: source.value.split('\n').length}, (_, i) => i + 1).join('\n');
    syncScroll(); updateCursor();
  }
  function syncScroll() {
    $('highlight').scrollTop = source.scrollTop; $('highlight').scrollLeft = source.scrollLeft;
    $('line-numbers').scrollTop = source.scrollTop;
  }
  function updateCursor() {
    const before = source.value.slice(0, source.selectionStart).split('\n');
    $('cursor-position').textContent = `Ln ${before.length}, Col ${before.at(-1).length + 1}`;
  }
  function setZoom(value) {
    zoom = Math.min(2.5, Math.max(.1, value));
    const svg = diagram.querySelector('svg');
    if (svg && bounds) { svg.style.width = `${bounds.width * zoom}px`; svg.style.height = `${bounds.height * zoom}px`; }
    $('fit').textContent = `${Math.round(zoom * 100)}%`;
  }
  function fit() {
    if (bounds) setZoom(Math.min(1, (canvas.clientWidth - 40) / bounds.width,
      model?.kind === 'help' || diagram.querySelector('svg[data-arch-views],svg[data-arch-meta]') ? 1 : (canvas.clientHeight - 40) / bounds.height));
  }
  function updateViews() {
    const views = viewId===metaView && metaResult?.views ? metaResult.views : model?.views ?? [];
    const configured = viewId===metaView ? metaResult?.configuredViews : model?.config?.views;
    const kind = viewId===metaView ? metaResult?.kind : model?.kind;
    const options = views.map(view => {
      const option = document.createElement('option'); option.value = view.id; option.textContent = view.title; return option;
    });
    if (kind !== 'help' && configured !== undefined) {
      const option = document.createElement('option'); option.value = configuredViews; option.textContent = 'Configured views'; options.unshift(option);
    }
    const meta = document.createElement('option'); meta.value = metaView;
    meta.textContent = sourceIsJSON() ? 'Meta view · DSL' : 'Meta view · JSON'; options.push(meta);
    $('view-select').replaceChildren(...options);
    $('view-select').value = viewId;
  }
  function renderMeta() {
    metaResult = arch.inspectSource(source.value, profileOverride ? {profile: profileOverride} : {});
    canvas.hidden = true; $('source-meta').hidden = false; $('error').hidden = true;
    $('toggle-theme').disabled = $('zoom-in').disabled = $('zoom-out').disabled = $('fit').disabled = true;
    $('export-svg').disabled = true;
    $('meta-title').textContent = `${metaResult.sourceFormat.toUpperCase()} → ${metaResult.targetFormat.toUpperCase()}`;
    if(metaResult.title)$('model-title').textContent=metaResult.title;
    $('profile-info').textContent=metaResult.profile?`${metaResult.profile.id} · ${metaResult.profile.version}`:'Source inspection';
    $('meta-output').textContent = metaResult.output ?? 'Translation is available once the syntax is corrected.';
    $('meta-copy').disabled = $('meta-download').disabled = metaResult.output === null;
    $('meta-download').textContent = `Download ${metaResult.targetFormat.toUpperCase()}`;
    $('meta-diagnostics').replaceChildren();
    const sourceLines = source.value.split('\n');
    for (const diagnostic of metaResult.diagnostics.slice(0, 12)) {
      const card = document.createElement('article'); card.className = 'meta-diagnostic';
      const message = document.createElement('strong'); message.textContent = diagnostic.message; card.append(message);
      if (diagnostic.path) {const path = document.createElement('code'); path.className = 'meta-path'; path.textContent = diagnostic.path; card.append(path);}
      if (diagnostic.line) {
        const jump = document.createElement('button'); jump.textContent = `Line ${diagnostic.line}, column ${diagnostic.column ?? 1}`;
        jump.addEventListener('click', () => {
          const line = Math.max(0, Math.min(sourceLines.length - 1, diagnostic.line - 1));
          const at = sourceLines.slice(0, line).reduce((n, text) => n + text.length + 1, 0) + Math.min(sourceLines[line].length, Math.max(0,(diagnostic.column??1)-1));
          source.focus(); source.setSelectionRange(at, Math.min(source.value.length,at+1));
          source.scrollTop = Math.max(0,(line-3)*parseFloat(getComputedStyle(source).lineHeight));syncScroll();updateCursor();
        });card.append(jump);
        const excerpt = document.createElement('pre'); excerpt.className = 'meta-excerpt';
        for(let i=Math.max(0,diagnostic.line-2);i<Math.min(sourceLines.length,diagnostic.line+1);i++) {
          const row = document.createElement('span');row.textContent = `${i+1}  ${sourceLines[i]}\n`;
          if(i+1===diagnostic.line)row.className='meta-error-line';excerpt.append(row);
        }
        card.append(excerpt);
      }
      const list = document.createElement('ul');list.className='meta-candidates';
      for (const candidate of diagnostic.candidates) {
        const item = document.createElement('li'), label = document.createElement('span'), example = document.createElement('code');
        label.textContent = candidate.label; example.textContent = candidate.example; item.append(label,example);
        if(candidate.detail){const detail=document.createElement('small');detail.textContent=candidate.detail;item.append(detail);}
        list.append(item);
      }
      card.append(list);$('meta-diagnostics').append(card);
    }
    if(metaResult.diagnostics.length>12){const more=document.createElement('p');more.textContent=`${metaResult.diagnostics.length-12} additional diagnostics. Correct the displayed issues and render again.`;$('meta-diagnostics').append(more);}
    $('render-status').textContent = metaResult.valid ? 'Source translation ready' : `${metaResult.diagnostics.length} source issue${metaResult.diagnostics.length===1?'':'s'} · review correction candidates`;
    $('view-title').textContent = 'Meta view · Source translation';
    $('element-count').textContent = metaResult.output ? `${metaResult.output.split('\n').length-1} translated lines` : 'Source needs correction';
    $('preview-kind').textContent = 'SOURCE';
    if(metaResult.valid)source.removeAttribute('aria-invalid');else source.setAttribute('aria-invalid','true');
    updateViews();
  }
  function render(resetFit = false) {
    clearTimeout(debounce);
    if(viewId===metaView){renderMeta();return;}
    canvas.hidden = false; $('source-meta').hidden = true;
    $('preview-kind').textContent = 'INLINE SVG';
    $('toggle-theme').disabled = $('zoom-in').disabled = $('zoom-out').disabled = $('fit').disabled = false;
    const started = performance.now();
    try {
      const next = arch.parse(source.value, profileOverride ? { profile: profileOverride } : {});
      const explicit = viewOverride && next.views.some(view => view.id === viewId);
      const selected = explicit ? viewId : next.kind !== 'help' && next.config?.views !== undefined ? configuredViews : next.views[0].id;
      const options = selected === configuredViews ? {theme} : {view: selected, theme};
      const graph = arch.layout(next, options);
      const svg = arch.renderToString(next, options);
      // Only commit UI state after the complete render succeeds.
      model = next; viewId = selected; viewOverride = explicit; bounds = graph.bounds; lastSvg = svg;
      $('profile-info').innerHTML = '<span class="live-dot"></span>';
      $('profile-info').append(document.createTextNode(`${model.profile.id} · ${model.profile.version}`));
      diagram.innerHTML = svg; updateViews();
      const view = graph.view, activeTheme = theme ?? view.theme;
      canvas.classList.toggle('dark', activeTheme === 'dark');
      $('toggle-theme').textContent = activeTheme === 'dark' ? '☀' : '☾';
      $('model-title').textContent = model.title; $('model-description').textContent = model.description || 'A readable model, rendered directly in your browser.';
      $('view-title').textContent = graph.kind === 'views' ? `${graph.layouts.length} configured views` : view.title;
      $('element-count').textContent = model.kind === 'help' ? 'Built-in language reference' : `${graph.nodes.length} elements · ${graph.edges.length} connections`;
      $('render-status').innerHTML = `<span class="live-dot"></span> Rendered in ${Math.max(1, Math.round(performance.now() - started))} ms`;
      $('error').hidden = true; source.removeAttribute('aria-invalid');
      $('export-svg').disabled = false;
      if (resetFit) fit(); else setZoom(zoom);
    } catch (error) {
      $('error').textContent = error.diagnostics ? error.diagnostics.slice(0, 8).map(d => `${d.message}${d.line ? ` (Ln ${d.line}, Col ${d.column})` : ''}`).join('\n') : error.message;
      $('error').hidden = false;
      updateViews();
      $('render-status').textContent = 'Check your source · last valid preview retained';
      source.setAttribute('aria-invalid', 'true'); $('export-svg').disabled = true;
    }
  }
  function selectExample(example) {
    if (currentExample) drafts.set(currentExample.id, source.value);
    currentExample = example; viewId = undefined; viewOverride = false; theme = undefined; profileOverride = undefined; $('profile-select').value = '';
    source.value = drafts.get(example.id) ?? example.source; source.scrollTop = source.scrollLeft = 0;
    source.setSelectionRange(0, 0); $('example-select').value = example.id;
    for (const button of $('examples').children) {
      const active = button.dataset.example === example.id;
      button.classList.toggle('active', active); button.setAttribute('aria-current', String(active));
    }
    $('unsaved').hidden = source.value === example.source; highlight(); render(true);
  }
  function toast(message) {
    clearTimeout(toastTimeout); $('toast').textContent = message; $('toast').hidden = false;
    toastTimeout = setTimeout(() => $('toast').hidden = true, 2500);
  }
  function download(content, type, extension) {
    const blob = new Blob([content], { type }), url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = `${(model?.title ?? 'architecture').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'architecture'}.${extension}`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('example-count').textContent = String(ARCH_EXAMPLES.length).padStart(2, '0');
  for (const [index, example] of ARCH_EXAMPLES.entries()) {
    const option = document.createElement('option'); option.value = example.id; option.textContent = example.title;
    $('example-select').append(option);
    const button = document.createElement('button'); button.className = 'example-button'; button.dataset.example = example.id;
    button.innerHTML = `<span class="example-symbol">${['◈','⇢','▥','✧','◇','▤','◎','⊙','▦','＋','?'][index] ?? '◇'}</span><span><strong>${html(example.title)}</strong><small>${html(example.subtitle)}</small></span>`;
    button.addEventListener('click', () => selectExample(example)); $('examples').append(button);
  }
  const automatic = document.createElement('option'); automatic.value = ''; automatic.textContent = 'From document'; $('profile-select').append(automatic);
  for (const id of arch.getProfiles()) {
    const option = document.createElement('option'); option.value = id; option.textContent = id; $('profile-select').append(option);
  }
  $('profile-select').addEventListener('change', () => { profileOverride = $('profile-select').value || undefined; render(true); });
  const samples = {
    bootstrap: ['person','window','database','cloud','shield-lock','diagram-3'],
    lucide: ['user','app-window','database','cloud','shield-check','network'],
    tabler: ['user','app-window','database','cloud','shield-lock','topology-star'],
  };
  for (const pack of ARCH_ICON_PACKS) {
    const card = document.createElement('article'); card.className = `iconpack-card iconpack-${pack.name}`;
    const figures = samples[pack.name].map(id => {
      const name = `${pack.name}.${id}`;
      return `<figure title="${html(name)}">${arch.renderIconToString(name, { size: 30 })}<figcaption>${html(id)}</figcaption></figure>`;
    }).join('');
    card.innerHTML = `<div class="iconpack-title"><h3>${html(pack.title)}</h3><span>${pack.count.toLocaleString('en-US')} icons</span></div><div class="iconpack-samples">${figures}</div><div class="iconpack-footer"><code>icon ${html(pack.name)}.cloud</code><a href="${html(pack.file)}" download>JSON ↓</a></div>`;
    $('iconpack-cards').append(card);
  }
  $('iconpack-summary').textContent = `${ARCH_ICON_PACKS.reduce((sum, pack) => sum + pack.count, 0).toLocaleString('en-US')} icons and aliases, available locally. Use pack.name in your model.`;
  $('show-icon-example').addEventListener('click', () => {
    selectExample(ARCH_EXAMPLES.find(example => example.id === 'iconpacks'));
    document.querySelector('.studio').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });
  $('example-select').addEventListener('change', () => selectExample(ARCH_EXAMPLES.find(example => example.id === $('example-select').value)));
  source.addEventListener('input', () => {
    highlight(); $('unsaved').hidden = source.value === currentExample.source;
    clearTimeout(debounce); debounce = setTimeout(() => render(false), 240);
  });
  source.addEventListener('scroll', syncScroll);
  source.addEventListener('click', updateCursor); source.addEventListener('keyup', updateCursor);
  source.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); render(true); }
    if (event.key === 'Tab') {
      event.preventDefault(); source.setRangeText('  ', source.selectionStart, source.selectionEnd, 'end');
      source.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  $('render-button').addEventListener('click', () => render(true));
  $('view-select').addEventListener('change', () => { viewId = $('view-select').value; viewOverride = ![configuredViews,metaView].includes(viewId); theme = undefined; render(true); });
  $('meta-copy').addEventListener('click', async () => {
    if(!metaResult?.output)return;
    try {await navigator.clipboard.writeText(metaResult.output);toast('Translated source copied.');}
    catch {const range=document.createRange();range.selectNodeContents($('meta-output'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);toast('Select and copy the translated source.');}
  });
  $('meta-download').addEventListener('click', () => {
    if(metaResult?.output)download(metaResult.output,metaResult.targetFormat==='json'?'application/json;charset=utf-8':'text/plain;charset=utf-8',metaResult.targetFormat==='json'?'json':'arch');
  });
  $('toggle-theme').addEventListener('click', () => {
    if (!model) return;
    const active = theme ?? diagram.querySelector('svg').dataset.archSvg;
    theme = active === 'dark' ? 'light' : 'dark'; render(false);
  });
  $('zoom-in').addEventListener('click', () => setZoom(zoom * 1.25));
  $('zoom-out').addEventListener('click', () => setZoom(zoom / 1.25)); $('fit').addEventListener('click', fit);
  $('export-svg').addEventListener('click', () => { if (lastSvg) { download(lastSvg, 'image/svg+xml;charset=utf-8', 'svg'); toast('Your SVG is ready.'); } });
  $('download-source').addEventListener('click', () => {
    const json = sourceIsJSON();
    download(source.value, json ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8', json ? 'json' : 'arch');
    toast('Your architecture source is ready.');
  });
  $('open-guide').addEventListener('click', () => $('guide').showModal()); $('close-guide').addEventListener('click', () => $('guide').close());
  new ResizeObserver(() => { if (bounds) fit(); }).observe(canvas);
  selectExample(ARCH_EXAMPLES[0]);
})();
