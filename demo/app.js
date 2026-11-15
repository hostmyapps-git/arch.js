/* global arch, ARCH_EXAMPLES, ARCH_ICON_PACKS */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const source = $('source'), diagram = $('diagram'), canvas = $('canvas');
  const html = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentExample, model, viewId, theme, profileOverride, zoom = 1, bounds, debounce, toastTimeout, lastSvg;
  const drafts = new Map();
  function highlight() {
    // Tokenize before escaping so quotes/entities cannot break markup.
    const token = /"(?:\\.|[^"\\])*"|#[^\n]*|\/\/[^\n]*|\b(?:architecture|model|view|diagram|participants|messages|returns|asyncMessages|lanes|laneAttribute|initial|finals|decisions|forks|joins|rows|columns|valueAttribute|parentAttribute|startAttribute|endAttribute|ownerAttribute|signatureAttribute|methods|functions|interfaces|ports|parameters|config|profile|styleGroup|backgroundColor|extends|attribute|attributes|required|enum|abstract|container|contains|defaultRelation|requireViewpoint|viewpoint|nodes|relations|requiredNodes|requiredRelations|incoming|outgoing|allowSelf|min|max|minLength|maxLength|description|technology|icon|stereotype|tags|person|system|application|service|component|database|queue|interface|capability|process|artifact|node|package|relation|type|direction|spacing|theme|include|place|at|size|style|accent|template|route|from|to|via|curve|path|label)\b|-?\b\d+(?:\.\d+)?\b/g;
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
    if (bounds) setZoom(Math.min(1, (canvas.clientWidth - 40) / bounds.width, (canvas.clientHeight - 40) / bounds.height));
  }
  function updateViews() {
    const selected = model.views.some(v => v.id === viewId) ? viewId : model.views[0].id;
    $('view-select').replaceChildren(...model.views.map(view => {
      const option = document.createElement('option'); option.value = view.id; option.textContent = view.title; return option;
    }));
    $('view-select').value = viewId = selected;
  }
  function render(resetFit = false) {
    clearTimeout(debounce);
    const started = performance.now();
    try {
      const next = arch.parse(source.value, profileOverride ? { profile: profileOverride } : {});
      const selected = next.views.some(v => v.id === viewId) ? viewId : next.views[0].id;
      const graph = arch.layout(next, { view: selected });
      const svg = arch.renderToString(next, { view: selected, theme });
      // Only commit UI state after the complete render succeeds.
      model = next; viewId = selected; bounds = graph.bounds; lastSvg = svg;
      $('profile-info').innerHTML = '<span class="live-dot"></span>';
      $('profile-info').append(document.createTextNode(`${model.profile.id} · ${model.profile.version}`));
      diagram.innerHTML = svg; updateViews();
      const view = model.views.find(v => v.id === viewId), activeTheme = theme ?? view.theme;
      canvas.classList.toggle('dark', activeTheme === 'dark');
      $('toggle-theme').textContent = activeTheme === 'dark' ? '☀' : '☾';
      $('model-title').textContent = model.title; $('model-description').textContent = model.description || 'A readable model, rendered directly in your browser.';
      $('view-title').textContent = view.title;
      $('element-count').textContent = `${graph.nodes.length} elements · ${graph.edges.length} connections`;
      $('render-status').innerHTML = `<span class="live-dot"></span> Rendered in ${Math.max(1, Math.round(performance.now() - started))} ms`;
      $('error').hidden = true; source.removeAttribute('aria-invalid');
      $('export-svg').disabled = false;
      if (resetFit) fit(); else setZoom(zoom);
    } catch (error) {
      $('error').textContent = error.diagnostics ? error.diagnostics.slice(0, 8).map(d => `${d.message}${d.line ? ` (Ln ${d.line}, Col ${d.column})` : ''}`).join('\n') : error.message;
      $('error').hidden = false;
      $('render-status').textContent = 'Check your source · last valid preview retained';
      source.setAttribute('aria-invalid', 'true'); $('export-svg').disabled = true;
    }
  }
  function selectExample(example) {
    if (currentExample) drafts.set(currentExample.id, source.value);
    currentExample = example; viewId = undefined; theme = undefined; profileOverride = undefined; $('profile-select').value = '';
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
    button.innerHTML = `<span class="example-symbol">${['◈','⇢','▥','✧','◇','▤','◎','▦','＋'][index]}</span><span><strong>${html(example.title)}</strong><small>${html(example.subtitle)}</small></span>`;
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
  $('view-select').addEventListener('change', () => { viewId = $('view-select').value; theme = undefined; render(true); });
  $('toggle-theme').addEventListener('click', () => {
    if (!model) return;
    const active = theme ?? model.views.find(v => v.id === viewId).theme;
    theme = active === 'dark' ? 'light' : 'dark'; render(false);
  });
  $('zoom-in').addEventListener('click', () => setZoom(zoom * 1.25));
  $('zoom-out').addEventListener('click', () => setZoom(zoom / 1.25)); $('fit').addEventListener('click', fit);
  $('export-svg').addEventListener('click', () => { if (lastSvg) { download(lastSvg, 'image/svg+xml;charset=utf-8', 'svg'); toast('Your SVG is ready.'); } });
  $('download-source').addEventListener('click', () => { download(source.value, 'text/plain;charset=utf-8', 'arch'); toast('Your architecture source is ready.'); });
  $('open-guide').addEventListener('click', () => $('guide').showModal()); $('close-guide').addEventListener('click', () => $('guide').close());
  new ResizeObserver(() => { if (bounds) fit(); }).observe(canvas);
  selectExample(ARCH_EXAMPLES[0]);
})();
