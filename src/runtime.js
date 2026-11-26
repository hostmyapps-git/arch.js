import { ArchError, bindPreviewModel, parseDocument, validate as validateArchitecture } from './parser.js';
import { errorDiagnostic } from './errors.js';
import { layoutView } from './geometry.js';
import { validatePreviewModel } from './model-validation.js';
import { toSVG } from './svg.js';
import { escape } from './svg-values.js';
import { checkPresentationMode, selectedViewIds } from './view-selection.js';
import { stackViews, viewsSVG } from './multi-view.js';
import { isJSONDocument } from './json.js';
import { withValidationNotices, withSyntaxNotices, noticesSVG } from './validation-mode.js';
import { syntaxDiagnostics } from './syntax-recovery.js';
import { createDiagnosticHelpLink, rememberDiagnosticProfile } from './diagnostic-help.js';

function studioRequired(feature, loc) {
  return new ArchError(`${feature} requires arch.min.js`, loc, 'ARCH_STUDIO_REQUIRED');
}

// Both distributions use these adapters. Studio supplies the optional
// presentation and inspection hooks when it creates its runtime.
export function createRuntime({
  layoutHelp, validateHelp, renderHelp, renderDashboard,
  rememberDraftDetails, attachDiagram, attachError
} = {}) {
  function layout(model, options = {}) {
    const fromSource = typeof model === 'string' || isJSONDocument(model);
    if (fromSource) model = bindPreviewModel(model, options);
    return layoutPreview(model, options, fromSource);
  }

  function layoutPreview(model, options, fromSource) {
    const boundDocument = fromSource ? validatePreviewModel(model, options, model.profile) : undefined;
    if (model?.kind === 'help') {
      if (!layoutHelp) throw studioRequired('@help');
      return layoutHelp(model, options);
    }
    const ids = selectedViewIds(model, options);
    const document = boundDocument ?? validatePreviewModel(model, options);
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
    if (document.mode === 'draft') rememberDraftDetails?.(rendered, showValidation === false ? [] : diagnostics);
    return rememberDiagnosticProfile(rendered, document.profile);
  }

  function validate(sourceOrModel, options = {}) {
    let profile = null;
    try {
      const model = typeof sourceOrModel === 'string' || isJSONDocument(sourceOrModel) ? parseDocument(sourceOrModel) : sourceOrModel;
      if (model?.kind !== 'help') {
        const report = validateArchitecture(model, options);
        profile = report.profile;
        if (report.valid) selectedViewIds(model, options);
        return report;
      }
      if (!validateHelp) throw studioRequired('@help');
      return validateHelp(model, options);
    } catch (error) {
      if (!(error instanceof ArchError)) throw error;
      return { valid: false, profile,
        diagnostics: [errorDiagnostic(error)] };
    }
  }

  function renderGraph(graph, options) {
    if (graph.kind === 'notices' || graph.kind === 'syntax-notices') return noticesSVG(graph, renderGraph, options);
    if (graph.kind === 'help') return renderHelp(graph, options);
    if (graph.kind === 'views') return viewsSVG(graph, options);
    return toSVG(graph, options);
  }

  function renderToString(sourceOrModel, options = {}) {
    return renderGraph(layout(sourceOrModel, options), options);
  }

  // A preview that needs bounds and SVG can get both from the same layout.
  function renderDiagram(sourceOrModel, options = {}) {
    const graph = layout(sourceOrModel, options);
    return { graph, svg: renderGraph(graph, options) };
  }

  function render(target, sourceOrModel, options = {}) {
    const element = typeof target === 'string' ? globalThis.document?.querySelector(target) : target;
    if (!element || typeof element.replaceChildren !== 'function') throw new ArchError('A valid DOM target element is required');
    checkPresentationMode(options.presentation);
    const fromSource = typeof sourceOrModel === 'string' || isJSONDocument(sourceOrModel);
    const model = fromSource ? bindPreviewModel(sourceOrModel, options) : sourceOrModel;
    if (model?.kind !== 'help' && (options.presentation ?? model?.config?.presentation) === 'dashboard') {
      if (!renderDashboard) throw studioRequired('Dashboard presentation', model.config?.loc);
      const [view] = selectedViewIds(model, options);
      const validation = options.validation ?? model.config?.validation;
      renderDashboard(element, model, {...options, view, validation, originalSource:fromSource ? sourceOrModel : undefined});
      return element.lastElementChild;
    }
    const graph = layoutPreview(model, options, fromSource);
    const svg = renderGraph(graph, options);
    const template = element.ownerDocument.createElement('template');
    template.innerHTML = svg;
    element.replaceChildren(template.content.firstElementChild);
    attachDiagram?.(element, graph, options);
    return element.firstElementChild;
  }

  function renderAll(options = {}) {
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
        attachError?.(target, error, renderOptions);
      }
      target.dataset.archRendered = 'true';
    }
    return results;
  }

  function renderMarkdown(markdown, options = {}) {
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

  return { layout, validate, renderGraph, renderToString, renderDiagram, render, renderAll, renderMarkdown };
}
