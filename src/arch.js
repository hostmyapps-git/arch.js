import { ArchError, parse, parseDocument, validate as validateArchitecture } from './parser.js';
import { layout as layoutArchitecture } from './geometry.js';
import { toSVG, escape } from './svg.js';
import { selectedViewIds } from './view-selection.js';
import { stackViews, viewsSVG } from './multi-view.js';
import { helpContent, layoutHelp, helpSVG } from './help.js';
import { isJSONDocument } from './json.js';
import { profileDiagnostics, resolveProfile } from './profiles.js';
import { validationMode, validationDiagnostics, withValidationNotices, noticesSVG } from './validation-mode.js';
export { ArchError, parse };
export { help } from './help.js';
export { registerProfile, getProfiles, getProfile } from './profiles.js';
export { registerIconPack, getIconPacks } from './icons.js';
export { renderIconToString } from './svg.js';
export { translate, inspectSource } from './source.js';
export const version = '0.1.0';

export function layout(model, options = {}) {
  if (typeof model === 'string' || isJSONDocument(model)) model = parse(model, options);
  if (model?.kind === 'help') return layoutHelp(model, options);
  const ids = selectedViewIds(model, options);
  const layouts = ids.map(view => layoutArchitecture(model, {...options, view}));
  const graph=layouts.length === 1 ? layouts[0] : stackViews(model, layouts);
  return withValidationNotices(graph,validationDiagnostics(profileDiagnostics(model,resolveProfile(model,options)),validationMode(model,options)));
}

export function validate(sourceOrModel, options = {}) {
  let profile;
  try {
    const model = typeof sourceOrModel === 'string' || isJSONDocument(sourceOrModel) ? parseDocument(sourceOrModel) : sourceOrModel;
    if (model?.kind !== 'help') {
      const report = validateArchitecture(model, options); profile = report.profile;
      if (report.valid) selectedViewIds(model, options);
      return report;
    }
    const content = helpContent(model, options); profile = content.profile;
    return { valid: true, profile: { id: profile.id, version: profile.version }, diagnostics: [] };
  } catch (error) {
    if (!(error instanceof ArchError)) throw error;
    return { valid: false, profile: profile ? { id: profile.id, version: profile.version } : null,
      diagnostics: [{ severity: 'error', code: error.code, message: error.message, line: error.line, column: error.column, ...(error.path !== undefined ? {path: error.path} : {}) }] };
  }
}

export function renderToString(sourceOrModel, options = {}) {
  const model = typeof sourceOrModel === 'string' || isJSONDocument(sourceOrModel) ? parse(sourceOrModel, options) : sourceOrModel;
  const graph = layout(model, options);
  const renderGraph=(graph,options)=>graph.kind==='notices'?noticesSVG(graph,renderGraph,options):graph.kind === 'help' ? helpSVG(graph, options) : graph.kind === 'views' ? viewsSVG(graph, options) : toSVG(graph, options);
  return renderGraph(graph,options);
}

export function render(target, sourceOrModel, options = {}) {
  const element = typeof target === 'string' ? globalThis.document?.querySelector(target) : target;
  if (!element || typeof element.replaceChildren !== 'function') throw new ArchError('A valid DOM target element is required');
  const svg = renderToString(sourceOrModel, options);
  const template = element.ownerDocument.createElement('template');
  template.innerHTML = svg;
  element.replaceChildren(template.content.firstElementChild);
  return element.firstElementChild;
}

export function renderAll(options = {}) {
  const { root = globalThis.document, selector = 'pre > code.language-arch, [data-arch]', ...renderOptions } = options;
  if (!root?.querySelectorAll) throw new ArchError('A DOM root is required for renderAll');
  const results = [];
  for (const element of root.querySelectorAll(selector)) {
    const target = element.matches('pre > code') ? element.parentElement : element;
    if (!root.contains(element) || !target || target.dataset.archRendered) continue;
    const source = element.textContent;
    try { results.push(render(target, source, renderOptions)); }
    catch (error) {
      const pre = target.ownerDocument.createElement('pre');
      pre.className = 'arch-error'; pre.setAttribute('role', 'alert'); pre.textContent = error.message;
      target.replaceChildren(pre);
    }
    target.dataset.archRendered = 'true';
  }
  return results;
}

export function renderMarkdown(markdown, options = {}) {
  if (typeof markdown !== 'string') throw new ArchError('Markdown must be a string');
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [], paragraph = [];
  const flush = () => { if (paragraph.length) html.push(`<p>${escape(paragraph.splice(0).join(' '))}</p>`); };
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/);
    if (fence) {
      flush(); const body = [], opening = i, char = fence[1][0], length = fence[1].length;
      while (++i < lines.length && !new RegExp(`^\\s{0,3}${char}{${length},}\\s*$`).test(lines[i])) body.push(lines[i]);
      if (i >= lines.length) throw new ArchError('Unclosed Markdown code block', { line: opening + 1, column: 1 });
      if (fence[2] === 'arch') html.push(`<figure class="arch-diagram">${renderToString(body.join('\n'), options)}</figure>`);
      else html.push(`<pre><code class="language-${escape(fence[2])}">${escape(body.join('\n'))}</code></pre>`);
    } else if (/^#{1,6} /.test(lines[i])) {
      flush(); const heading = lines[i].match(/^(#{1,6}) (.*)$/);
      html.push(`<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`);
    } else if (!lines[i].trim()) flush();
    else paragraph.push(lines[i]);
  }
  flush(); return html.join('\n');
}
