import { ArchError, errorDiagnostic } from './errors.js';
import { escape } from './svg-values.js';
import { createRuntime } from './runtime.js';
import { helpContent, helpLineStyles, layoutHelp, helpSVG } from './help.js';
import { attachHelpNavigation, attachDiagnosticHelp } from './help-navigation.js';
import { attachDraftDetails, rememberDraftDetails } from './draft-details.js';
import { prepareArchitecture } from './architecture-report.js';
import { dashboardStyle } from './dashboard-style.js';
import { dashboardUI } from './dashboard-ui.js';
import { sourceTokenizerScript, sourceTokens } from './source-highlight.js';
import { helpDocument, parseHelpCommand, queryFor, topics } from './help-syntax.js';
import { DIAGRAMS } from './diagrams.js';
export * from './arch.js';
export { help } from './help.js';
export { inspectSource } from './source.js';
export { sourceTokens } from './source-highlight.js';
export { attachDraftDetails } from './draft-details.js';
export { attachDiagnosticHelp, attachHelpNavigation } from './help-navigation.js';
export { createDiagnosticHelpLink } from './diagnostic-help.js';

const runtime = createRuntime({
  layoutHelp, renderHelp:helpSVG, renderDashboard, rememberDraftDetails,
  validateHelp(model, options) {
    const { profile } = helpContent(model, options);
    return { valid: true, profile: { id: profile.id, version: profile.version }, diagnostics: [] };
  },
  attachDiagram(element, graph, options) {
    const svg = element.firstElementChild;
    if (graph.kind === 'help') attachHelpNavigation(svg, graph, options);
    else {
      attachDiagnosticHelp(element, graph, options);
      attachDraftDetails(svg, graph, options);
    }
  },
  attachError(target, error, { theme, helpBaseURL }) {
    attachDiagnosticHelp(target, error, { theme, helpBaseURL });
  }
});
const { renderGraph } = runtime;
export const { layout, validate, renderToString, renderDiagram, render, renderAll, renderMarkdown } = runtime;

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
