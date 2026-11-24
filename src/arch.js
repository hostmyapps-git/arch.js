import { ArchError, bindPreviewModel, parseDocument, validate as validateArchitecture } from './parser.js';
import { errorDiagnostic } from './errors.js';
import { layoutView } from './geometry.js';
import { validatePreviewModel } from './model-validation.js';
import { toSVG } from './svg.js';
import { escape } from './svg-values.js';
import { checkPresentationMode, selectedViewIds } from './view-selection.js';
import { stackViews, viewsSVG } from './multi-view.js';
import { helpContent, helpLineStyles, layoutHelp, helpSVG } from './help.js';
import { isJSONDocument } from './json.js';
import { withValidationNotices, withSyntaxNotices, noticesSVG } from './validation-mode.js';
import { syntaxDiagnostics } from './syntax-recovery.js';
import { attachHelpNavigation, attachDiagnosticHelp } from './help-navigation.js';
import { attachDraftDetails, rememberDraftDetails } from './draft-details.js';
import { createDiagnosticHelpLink, rememberDiagnosticProfile } from './diagnostic-help.js';
import { prepareArchitecture } from './architecture-report.js';
import { dashboardStyle } from './dashboard-style.js';
import { dashboardUI } from './dashboard-ui.js';
import { sourceTokenizerScript, sourceTokens } from './source-highlight.js';
import { helpDocument, parseHelpCommand, queryFor, topics } from './help-syntax.js';
import { DIAGRAMS } from './diagrams.js';
export { ArchError, parse, parsePreview } from './parser.js';
export { help } from './help.js';
export { registerProfile, getProfiles, getProfile, getProfileVersions } from './profiles.js';
export { registerIconPack, getIconPacks } from './icons.js';
export { renderIconToString } from './svg.js';
export { translate, inspectSource } from './source.js';
export { sourceTokens } from './source-highlight.js';
export { attachDraftDetails } from './draft-details.js';
export { attachDiagnosticHelp, attachHelpNavigation } from './help-navigation.js';
export { createDiagnosticHelpLink } from './diagnostic-help.js';
export const version = '0.1.0';

export function layout(model, options = {}) {
  const fromSource = typeof model === 'string' || isJSONDocument(model);
  if (fromSource) model = bindPreviewModel(model, options);
  return layoutPreview(model, options, fromSource);
}

function layoutPreview(model, options, fromSource) {
  let document = fromSource ? validatePreviewModel(model, options, model.profile) : undefined;
  if (model?.kind === 'help') return layoutHelp(model, options);
  const ids = selectedViewIds(model, options);
  document ??= validatePreviewModel(model, options);
  const layouts = ids.map(id => layoutView(document, id));
  const graph = layouts.length === 1 ? layouts[0] : stackViews(model, layouts);
  const selected = new Set(ids);
  const diagnostics = document.diagnostics.filter(d => !d.viewId || selected.has(d.viewId));
  const showValidation = options.showValidation ?? model.config?.showValidation;
  const validated = withValidationNotices(graph, diagnostics, { validation: document.mode, showValidation });
  let sourceDiagnostics = syntaxDiagnostics(model);
  if (document.omittedByView?.size) {
    // An omission in an embedded source matters when the host is rendered.
    const visibleViews = new Set(selected);
    for (const id of visibleViews) for (const embed of Object.values(document.views.get(id).embeddings ?? {}))
      visibleViews.add(embed.view);
    sourceDiagnostics = [...sourceDiagnostics, ...[...visibleViews].flatMap(id => document.omittedByView.get(id) ?? [])]
      .sort((a, b) => a.line - b.line || a.column - b.column);
  }
  const rendered = withSyntaxNotices(validated, sourceDiagnostics);
  if (document.mode === 'draft') rememberDraftDetails(rendered, showValidation === false ? [] : diagnostics);
  return rememberDiagnosticProfile(rendered, document.profile);
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
      diagnostics: [errorDiagnostic(error)] };
  }
}

function renderGraph(graph, options) {
  if (graph.kind === 'notices' || graph.kind === 'syntax-notices') return noticesSVG(graph, renderGraph, options);
  if (graph.kind === 'help') return helpSVG(graph, options);
  if (graph.kind === 'views') return viewsSVG(graph, options);
  return toSVG(graph, options);
}

export function renderToString(sourceOrModel, options = {}) {
  return renderGraph(layout(sourceOrModel, options), options);
}

// A preview that needs bounds and SVG can get both from the same layout.
export function renderDiagram(sourceOrModel, options = {}) {
  const graph = layout(sourceOrModel, options);
  return { graph, svg: renderGraph(graph, options) };
}

export function architectureReport(sourceOrModel, options = {}) {
  const prepared = prepareArchitecture(sourceOrModel,options);
  return options.checkRendering ? dashboardPreviews(prepared,options,false) : prepared.report;
}

export function renderDashboard(target, sourceOrModel, options = {}) {
  const element = typeof target === 'string' ? globalThis.document?.querySelector(target) : target;
  if (!element?.ownerDocument || typeof element.replaceChildren !== 'function') throw new ArchError('A valid DOM target element is required');
  const {report,layout,profile,viewSource} = prepareArchitecture(sourceOrModel,options);
  const page = element.ownerDocument.createElement('div');
  dashboardUI(page,report,{...options, getHelp:query=>dashboardHelp(query,profile),
    viewSource,sourceTokens,
    renderView:id=>renderGraph(layout(id),{theme:options.theme})});
  const css = element.ownerDocument.createElement('style');
  css.textContent = dashboardStyle;
  element.replaceChildren(css,page);
  return report;
}

export function renderDashboardToHTML(sourceOrModel, options = {}) {
  const prepared = prepareArchitecture(sourceOrModel,options);
  const report = dashboardPreviews(prepared,options,true);
  const helpPages = exportDashboardHelp(report,prepared.profile);
  const sources = exportDashboardSources(prepared);
  const payload = JSON.stringify({report,view:options.view,helpPages,sources}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(report.title)}</title><style>body{margin:0}${dashboardStyle}</style><main id="architecture"></main><script type="application/json" id="model">${payload}</script><script>const data=JSON.parse(document.getElementById('model').textContent);(${dashboardUI.toString()})(document.getElementById('architecture'),data.report,{view:data.view,helpPages:data.helpPages,sources:data.sources,sourceTokens:${sourceTokenizerScript()}});</script></html>`;
}

function exportDashboardSources({report,viewSource}) {
  return Object.fromEntries(report.views.map(({id}) => {
    try { return [id,viewSource(id)]; }
    catch (error) {
      if (!(error instanceof ArchError)) throw error;
      return [id,{error:error.message}];
    }
  }));
}

function dashboardHelp(query,profile) {
  const model = {...helpDocument(parseHelpCommand(`@help ${query}`)),profile};
  const {title,sections} = helpContent(model);
  return {title,sections:sections.map(section => {
    if (section.format) return section;
    const lineStyles = helpLineStyles(section);
    return lineStyles.some(Boolean) ? {...section,lineStyles} : section;
  })};
}

function exportDashboardHelp(report,profile) {
  const diagrams = [...DIAGRAMS,...Object.keys(profile?.diagrams ?? {})];
  const queries = new Set(['',...Object.keys(topics),...diagrams.map(type=>queryFor('diagrams',type))]);
  for (const view of report.views) if (view.viewpoint) queries.add(queryFor('viewpoints','.',view.viewpoint));
  for (const element of report.elements) if (element.type) queries.add(queryFor('types','.',element.type));
  for (const relation of report.relationships) if (relation.type) queries.add(queryFor('relations','.',relation.type));
  for (const issue of report.diagnostics) if (issue.help) queries.add(issue.help.replace(/^@help\s*/,''));
  const pages = {};
  for (const query of queries) {
    try { pages[query] = dashboardHelp(query,profile); }
    catch (error) {
      if (!(error instanceof ArchError)) throw error;
    }
  }
  return pages;
}

function dashboardPreviews({report,layout},options,includeSVG) {
  const previews = [];
  for (const view of report.views) {
    let result;
    try {
      const svg = renderGraph(layout(view.id),{idPrefix:'dashboard-'+view.id,theme:options.theme});
      result = {svg};
    } catch (error) {
      if (!(error instanceof ArchError)) throw error;
      result = {error:error.message};
      if (!view.error) report.diagnostics.push({...errorDiagnostic(error),viewId:view.id});
      view.error = error.message;
    }
    if (includeSVG) previews.push([view.id,result]);
  }
  if (includeSVG) report.previews = Object.fromEntries(previews);
  return report;
}

export function render(target, sourceOrModel, options = {}) {
  const element = typeof target === 'string' ? globalThis.document?.querySelector(target) : target;
  if (!element || typeof element.replaceChildren !== 'function') throw new ArchError('A valid DOM target element is required');
  checkPresentationMode(options.presentation);
  const fromSource = typeof sourceOrModel === 'string' || isJSONDocument(sourceOrModel);
  const model = fromSource ? bindPreviewModel(sourceOrModel, options) : sourceOrModel;
  if (model?.kind !== 'help' && (options.presentation ?? model?.config?.presentation) === 'dashboard') {
    const [view] = selectedViewIds(model, options);
    const validation = options.validation ?? model.config?.validation;
    renderDashboard(element, model, {...options, view, validation});
    return element.lastElementChild;
  }
  const graph = layoutPreview(model, options, fromSource);
  const svg = renderGraph(graph, options);
  const template = element.ownerDocument.createElement('template');
  template.innerHTML = svg;
  element.replaceChildren(template.content.firstElementChild);
  if (graph.kind === 'help') return attachHelpNavigation(element.firstElementChild, graph, options);
  attachDiagnosticHelp(element, graph, options);
  return attachDraftDetails(element.firstElementChild, graph, options);
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
      pre.className = 'arch-error'; pre.setAttribute('role', 'alert');
      pre.append(error.message, '\n', createDiagnosticHelpLink(pre.ownerDocument, error, renderOptions));
      target.replaceChildren(pre);
      const {theme, helpBaseURL} = renderOptions;
      attachDiagnosticHelp(target, error, {theme, helpBaseURL});
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
      const closingFence = new RegExp(`^\\s{0,3}${char}{${length},}\\s*$`);
      while (++i < lines.length && !closingFence.test(lines[i])) body.push(lines[i]);
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
