import { ArchError } from './errors.js';
import { escape, num } from './svg-values.js';
import { wrap } from './text-layout.js';
import { toSVG } from './svg.js';

export function stackViews(model, layouts) {
  const padding = 24, gap = 24, width = Math.max(...layouts.map(graph => graph.bounds.width));
  let y = padding;
  const sections = layouts.map(graph => {
    const lines = wrap(graph.view.title.trim() || graph.view.id, Math.max(40, width - 24), 16);
    const headingHeight = Math.max(1, lines.length) * 22 + 12;
    const section = {graph, x: padding, y, titleLines: lines, headingHeight};
    y += headingHeight + graph.bounds.height + gap;
    return section;
  });
  const unique = key => [...new Map(layouts.flatMap(graph => graph[key]).map(item => [item.id, item])).values()];
  return {kind: 'views', title: model.title, description: model.description, profile: layouts[0].profile,
    view: layouts[0].view, layouts, sections, nodes: unique('nodes'), edges: unique('edges'),
    bounds: {x: 0, y: 0, width: width + 2 * padding, height: y - gap + padding}};
}

let serial = 0;
export function viewsSVG(graph, options = {}) {
  const prefix = options.idPrefix ?? `arch-views-${++serial}`;
  if (typeof prefix !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) throw new ArchError('Invalid idPrefix');
  const theme = options.theme ?? graph.view.theme, bg = theme === 'dark' ? '#111827' : '#fafbfe';
  const b = graph.bounds;
  const sections = graph.sections.map((section, index) => {
    const {graph: child, x, y, titleLines, headingHeight} = section;
    const childTheme = options.theme ?? child.view.theme, dark = childTheme === 'dark';
    const childSVG = toSVG(child, {...options, idPrefix: `${prefix}-view-${index + 1}`})
      .replace(/^<svg\b/, `<svg x="${num(x)}" y="${num(y + headingHeight)}" data-view-id="${escape(child.view.id)}"`);
    const heading = titleLines.map((line, row) => `<tspan x="${num(x + 12)}" dy="${row ? 22 : 0}">${escape(line)}</tspan>`).join('');
    return `<g data-arch-view="${escape(child.view.id)}"><rect x="${num(x)}" y="${num(y)}" width="${num(b.width - 48)}" height="${num(headingHeight + child.bounds.height)}" fill="${dark ? '#111827' : '#fafbfe'}"/><text x="${num(x + 12)}" y="${num(y + 21)}" font-size="16" font-weight="650" fill="${dark ? '#e2e8f0' : '#334155'}">${heading}</text>${childSVG}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${prefix}-diagram" data-arch-svg="${theme}" data-arch-views="${graph.layouts.length}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" viewBox="0 0 ${num(b.width)} ${num(b.height)}" width="${num(b.width)}" height="${num(b.height)}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:${bg}"><title id="${prefix}-title">${escape(graph.title)}</title><desc id="${prefix}-desc">${escape(graph.description || `${graph.layouts.length} selected architecture views`)}</desc><rect width="${num(b.width)}" height="${num(b.height)}" fill="${bg}"/>${sections}</svg>`;
}
