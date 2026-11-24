import {detailValue, inspectionSections} from './draft-geometry.js';
import {createDiagnosticHelpLink} from './diagnostic-help.js';

// Keep live inspection data outside layout snapshots and standalone SVGs.
const drafts = new WeakMap();
const attached = new WeakSet();
let serial = 0;

export function rememberDraftDetails(graph, diagnostics) {
  drafts.set(graph, diagnostics);
}

const nodeAttributes = ['data-node', 'data-member', 'data-port', 'data-state', 'data-tile', 'data-bar', 'data-validation-node'];
const edgeAttributes = ['data-edge', 'data-label-for'];
const selector = [...nodeAttributes, ...edgeAttributes].map(key => `[${key}]`).join(',');
const readID = (element, keys) => keys.map(key => element.getAttribute(key)).find(value => value !== null);
const index = items => new Map(items.map(item => [item.id, item]));

function referenceCards(layout) {
  const edges = new Map();
  for (const ref of layout.referenceNodes ?? []) {
    if (!edges.has(ref.edgeId)) edges.set(ref.edgeId, new Map());
    edges.get(ref.edgeId).set(ref.nodeId, ref);
  }
  return edges;
}

function fields(item, nodes) {
  const id = item.modelId ?? item.id;
  const result = [['ID', id], ['Type', item.type]];
  if (id !== item.id) result.push(['Occurrence', item.id]);
  if (item.stereotype && item.stereotype !== item.type) result.push(['Stereotype', item.stereotype]);
  if (item.source !== undefined) {
    result.push(['From', nodes.get(item.source)?.modelId ?? item.source], ['To', nodes.get(item.target)?.modelId ?? item.target]);
    if (item.direction === 'both') result.push(['Direction', 'Bidirectional']);
  }
  for (const [key, label] of [['description', 'Description'], ['technology', 'Technology'], ['tags', 'Tags']]) {
    if (item[key]) result.push([label, item[key]]);
  }
  return [...result, ...Object.entries(item.attributes ?? {})];
}

// Shared by arch.render() and hosts that insert renderDiagram().svg themselves.
// The native popover takes care of Escape, light dismissal and the top layer.
export function attachDraftDetails(svg, graph, options) {
  if (!svg?.ownerDocument || !drafts.has(graph) || attached.has(svg)) return svg;
  const doc = svg.ownerDocument;
  const panel = doc.createElement('section');
  if (typeof panel.showPopover !== 'function') return svg;
  let content = graph;
  while (content.kind === 'notices' || content.kind === 'syntax-notices') content = content.content;
  const views = content.kind === 'views' ? content.layouts : [content];
  const scopes = new Map(views.filter(view => view.kind !== 'help' && view.kind !== 'meta').map(view => [view.view.id, {
    layout:view, nodes:index(view.nodes), edges:index(view.edges), paths:new Map(), references:referenceCards(view),
  }]));
  const warnings = new Map();
  for (const diagnostic of drafts.get(graph)) {
    if (!diagnostic.elementId || diagnostic.severity !== 'warning') continue;
    if (!warnings.has(diagnostic.elementId)) warnings.set(diagnostic.elementId, []);
    warnings.get(diagnostic.elementId).push(diagnostic);
  }

  const triggers = new WeakMap(), focusable = new Set(), diagramGroups = new Set([svg]);
  panel.id = `arch-element-details-${++serial}`;
  for (const anchor of svg.querySelectorAll(selector)) {
    const viewId = anchor.closest('svg[data-view-id]')?.getAttribute('data-view-id') ?? content.view.id;
    const scope = scopes.get(viewId);
    if (!scope) continue;
    const edgeId = readID(anchor, edgeAttributes);
    const item = edgeId === undefined ? scope.nodes.get(readID(anchor, nodeAttributes)) : scope.edges.get(edgeId);
    if (!item || triggers.get(anchor.parentElement?.closest(selector))?.item === item) continue;
    triggers.set(anchor, {item, viewId, scope});
    if (edgeId !== undefined && anchor.hasAttribute('data-edge')) scope.paths.set(edgeId, anchor);
    diagramGroups.add(anchor.closest('svg[data-arch-svg]'));
    anchor.setAttribute('role', 'button');
    anchor.setAttribute('aria-label', `Details for ${item.title || item.type} (${item.modelId ?? item.id})`);
    anchor.setAttribute('aria-haspopup', 'dialog');
    anchor.setAttribute('aria-controls', panel.id);
    anchor.setAttribute('aria-expanded', 'false');
    anchor.setAttribute('tabindex', focusable.has(item) ? '-1' : '0');
    anchor.style.cursor = 'pointer';
    focusable.add(item);
  }
  if (!focusable.size) return svg;
  attached.add(svg);
  for (const group of diagramGroups) group?.setAttribute('role', 'group');

  panel.setAttribute('popover', 'auto');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('data-arch-draft-details', '');
  panel.setAttribute('aria-labelledby', `${panel.id}-title`);
  panel.style.cssText = 'position:fixed;inset:auto;margin:0;box-sizing:border-box;width:min(25rem,calc(100vw - 24px));max-height:min(32rem,calc(100vh - 24px));overflow:auto;padding:14px 16px;border:1px solid;border-radius:10px;box-shadow:0 12px 32px #0f172a38;font:13px/1.45 system-ui,sans-serif;text-align:left;overflow-wrap:anywhere';
  const header = doc.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px';
  const name = doc.createElement('strong');
  name.id = `${panel.id}-title`;
  name.style.fontSize = '15px';
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close details');
  close.style.cssText = 'border:0;background:transparent;color:inherit;font:20px/1 system-ui;padding:3px 6px;cursor:pointer';
  close.addEventListener('click', () => panel.hidePopover());
  header.append(name, close);
  const properties = doc.createElement('div');
  const notices = doc.createElement('div');
  notices.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid currentColor';
  panel.append(header, properties, notices);
  svg.after(panel);

  let active;
  panel.addEventListener('beforetoggle', event => {
    if (event.newState !== 'closed' || !active) return;
    active.setAttribute('aria-expanded', 'false');
    active = undefined;
  });

  const clamp = (value, end) => Math.max(12, Math.min(value, end - 12));
  function addSection(section, title, rows) {
    const valid = rows.filter(([,value]) => value !== undefined && value !== null && (typeof value !== 'number' || Number.isFinite(value)));
    if (!valid.length) return;
    if (title) {
      const label = doc.createElement('strong');
      label.style.cssText = 'display:block;margin:12px 0 5px;padding-top:8px;border-top:1px solid var(--arch-detail-border)';
      label.textContent = title;
      properties.append(label);
    }
    const list = doc.createElement('dl');
    list.dataset.archDetailsSection = section;
    list.style.cssText = 'display:grid;grid-template-columns:minmax(4.5rem,30%) 1fr;gap:5px 12px;margin:0';
    for (const [key, value, input] of valid) {
      const dt = doc.createElement('dt'), dd = doc.createElement('dd');
      dt.textContent = key;
      dt.style.fontWeight = '600';
      const output = doc.createElement('span');
      output.dataset.archDetailValue = '';
      output.textContent = detailValue(value);
      dd.dataset.archDetailField = key;
      dd.style.cssText = 'margin:0;white-space:pre-wrap';
      if (key === 'ID' || key === 'Occurrence' || section !== 'model') output.style.fontFamily = 'ui-monospace,monospace';
      dd.append(output);
      if (input !== undefined && detailValue(input) !== output.textContent) {
        const formula = doc.createElement('code');
        formula.dataset.archDetailInput = '';
        formula.style.cssText = 'display:block;font:11px/1.5 ui-monospace,monospace;color:var(--arch-detail-muted)';
        formula.textContent = detailValue(input);
        dd.append(formula);
      }
      list.append(dt, dd);
    }
    properties.append(list);
  }

  function show(anchor, event) {
    if (active === anchor && panel.matches(':popover-open')) {
      panel.hidePopover();
      return;
    }
    const {item, viewId, scope} = triggers.get(anchor);
    const dark = anchor.closest('[data-arch-svg]')?.getAttribute('data-arch-svg') === 'dark';
    Object.assign(panel.style, {
      colorScheme: dark ? 'dark' : 'light', color: dark ? '#e2e8f0' : '#172033',
      background: dark ? '#1e293b' : '#ffffff', borderColor: dark ? '#475569' : '#cbd5e1',
    });
    panel.style.setProperty('--arch-detail-border', dark ? '#475569' : '#cbd5e1');
    panel.style.setProperty('--arch-detail-muted', dark ? '#b5c4d7' : '#475569');
    name.textContent = item.title || item.type;
    properties.replaceChildren();
    addSection('model', undefined, fields(item, scope.nodes));
    const {geometry, styles, routing} = inspectionSections(item, anchor, scope);
    addSection('geometry', 'Geometry · SVG units', geometry);
    addSection('styles', 'Styles', styles);
    if (routing) addSection('routing', 'Route settings', routing);
    const relevant = (warnings.get(item.modelId ?? item.id) ?? []).filter(d => !d.viewId || d.viewId === viewId);
    notices.hidden = !relevant.length;
    notices.replaceChildren();
    if (relevant.length) {
      const title = doc.createElement('strong'), list = doc.createElement('ul');
      title.textContent = 'Validation notices';
      list.style.cssText = 'margin:6px 0 0;padding-left:18px';
      for (const warning of relevant) {
        const row = doc.createElement('li');
        row.append(warning.message, ' ', createDiagnosticHelpLink(doc, warning, options));
        list.append(row);
      }
      notices.append(title, list);
    }

    active?.setAttribute('aria-expanded', 'false');
    active = anchor;
    active.setAttribute('aria-expanded', 'true');
    anchor.focus({preventScroll:true});
    if (!panel.matches(':popover-open')) panel.showPopover();
    const rect = anchor.getBoundingClientRect();
    const {width, height} = panel.getBoundingClientRect();
    const left = item.source !== undefined && event.type === 'click' && event.detail ? event.clientX : (rect.left + rect.right) / 2;
    const top = item.source !== undefined && event.type === 'click' && event.detail ? event.clientY : rect.top;
    panel.style.left = `${clamp(left - width / 2, doc.documentElement.clientWidth - width)}px`;
    panel.style.top = `${clamp(top - height - 8 >= 12 ? top - height - 8 : rect.bottom + 8, doc.documentElement.clientHeight - height)}px`;
    close.focus({preventScroll:true});
  }

  const trigger = target => {
    for (let element = target.closest?.(selector); element && svg.contains(element); element = element.parentElement?.closest(selector)) {
      if (triggers.has(element)) return element;
    }
  };
  svg.addEventListener('click', event => {
    const anchor = trigger(event.target);
    if (anchor) show(anchor, event);
  });
  svg.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || event.repeat) return;
    const anchor = trigger(event.target);
    if (!anchor) return;
    event.preventDefault();
    show(anchor, event);
  });
  return svg;
}

