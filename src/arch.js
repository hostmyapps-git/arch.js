import { ArchError, parse, validate } from './parser.js';
import { layout } from './geometry.js';
import { toSVG, escape } from './svg.js';
export { ArchError, parse, layout, validate };
export { registerProfile, getProfiles, getProfile } from './profiles.js';
export { registerIconPack, getIconPacks } from './icons.js';
export { renderIconToString } from './svg.js';
export const version = '0.1.0';

export function renderToString(sourceOrModel, options = {}) {
  const model = typeof sourceOrModel === 'string' ? parse(sourceOrModel, options) : sourceOrModel;
  return toSVG(layout(model, options), options);
}

export function render(target, sourceOrModel, options = {}) {
  const element = typeof target === 'string' ? globalThis.document?.querySelector(target) : target;
  if (!element || typeof element.replaceChildren !== 'function') throw new ArchError('Gültiges DOM-Zielelement erforderlich');
  const svg = renderToString(sourceOrModel, options);
  const template = element.ownerDocument.createElement('template');
  template.innerHTML = svg;
  element.replaceChildren(template.content.firstElementChild);
  return element.firstElementChild;
}

export function renderAll(options = {}) {
  const { root = globalThis.document, selector = 'pre > code.language-arch, [data-arch]', ...renderOptions } = options;
  if (!root?.querySelectorAll) throw new ArchError('DOM-root für renderAll erforderlich');
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
  if (typeof markdown !== 'string') throw new ArchError('Markdown muss ein String sein');
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [], paragraph = [];
  const flush = () => { if (paragraph.length) html.push(`<p>${escape(paragraph.splice(0).join(' '))}</p>`); };
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/);
    if (fence) {
      flush(); const body = [], opening = i, char = fence[1][0], length = fence[1].length;
      while (++i < lines.length && !new RegExp(`^\\s{0,3}${char}{${length},}\\s*$`).test(lines[i])) body.push(lines[i]);
      if (i >= lines.length) throw new ArchError('Nicht abgeschlossener Markdown-Codeblock', { line: opening + 1, column: 1 });
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
