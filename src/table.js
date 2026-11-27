import { escape } from './svg-values.js';
import { wrap } from './text-layout.js';

const labels = { id:'ID', title:'Name', type:'Type', source:'Source', target:'Target' };
const format = value => Array.isArray(value) ? value.join(', ') : (value ?? '—');
const minColumnWidth = 64, maxTableWidth = 10_000_000;
const defaultWidth = key => key === 'description' ? 280 : key === 'title' ? 240 : key === 'type' ? 226 : 182;
export const tableDefaults = mode => mode === 'relationships' ? ['source','title','target','type'] : ['title','type','description'];
export function tableFieldNames(mode, items, profile) {
  const types = mode === 'relationships' ? profile.relationTypes : profile.nodeTypes;
  const keys = new Set([...Object.keys(labels).filter(key => mode === 'relationships' || !['source','target'].includes(key)),
    'description','technology','tags', ...(mode === 'relationships' ? ['direction'] : ['stereotype','icon','parent'])]);
  for (const type of new Set(items.map(item => item.type))) for (const key of Object.keys(types[type]?.attributes ?? {})) keys.add(key);
  return keys;
}

export function validateTableWidths({width, columnWidths, fields, mode}, fail) {
  if (width === undefined && columnWidths === undefined) return;
  if (width !== undefined && (!Number.isFinite(width) || width < minColumnWidth || width > maxTableWidth))
    fail(`Table width must be a number between ${minColumnWidth} and ${maxTableWidth}`);
  if (columnWidths !== undefined && (!columnWidths || typeof columnWidths !== 'object' || Array.isArray(columnWidths)))
    fail('columnWidths requires a block with column names and widths');
  const names = fields ?? tableDefaults(mode);
  let fixedWidth = 0;
  for (const [field,value] of Object.entries(columnWidths ?? {})) {
    if (!names.includes(field)) fail(`columnWidths: ${field} is not a selected column`);
    if (!Number.isFinite(value) || value < minColumnWidth || value > maxTableWidth)
      fail(`Width of column ${field} must be a number between ${minColumnWidth} and ${maxTableWidth}`);
    fixedWidth += value;
  }
  const automatic = names.filter(field => !Object.hasOwn(columnWidths ?? {},field));
  if (width === undefined) {
    if (fixedWidth + automatic.reduce((sum,field) => sum + defaultWidth(field),0) > maxTableWidth)
      fail(`Total table width must be at most ${maxTableWidth}`);
  } else if (automatic.length) {
    const minimum = fixedWidth + minColumnWidth * automatic.length;
    if (width < minimum) fail(`Table width must be at least ${minimum} for the selected column widths`);
  } else if (Math.abs(width - fixedWidth) > 1e-8) {
    fail(`Table width must equal the sum of the column widths (${fixedWidth}) when every column has an explicit width`);
  }
}

export function tableLayout(nodes, edges, options) {
  const byId = new Map(nodes.map(node => [node.id,node]));
  const relationships = options.mode === 'relationships';
  const fields = options.fields ?? tableDefaults(options.mode);
  const fixed = options.columnWidths ?? {};
  const columns = fields.map(key => ({
    key, title:Object.hasOwn(labels,key) ? labels[key] : key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase()),
    width:Object.hasOwn(fixed,key) ? fixed[key] : defaultWidth(key)
  }));
  const naturalWidth = columns.reduce((sum,column) => sum + column.width,0);
  if (options.width !== undefined && options.width !== naturalWidth) {
    const automatic = columns.filter(column => !Object.hasOwn(fixed,column.key));
    // Scale the space above the minimum to retain the default proportions of
    // the usable space while leaving explicitly sized columns untouched.
    const flexible = automatic.reduce((sum,column) => sum + column.width - minColumnWidth,0);
    if (flexible > 0) {
      const scale = (options.width - naturalWidth + flexible) / flexible;
      for (const column of automatic) column.width = minColumnWidth + (column.width - minColumnWidth) * scale;
    }
  }
  const width = options.width ?? naturalWidth;
  for (const column of columns) column.heading = wrap(column.title,column.width-32,13);
  const headerHeight = Math.max(56,20+18*Math.max(...columns.map(column => column.heading.length)));
  let y = headerHeight;
  const rows = (relationships ? edges : nodes).map(item => {
    const cells = columns.map(({ key,width }) => {
      const value = item.attributes?.[key] ?? item[key];
      const plain = (key === 'source' || key === 'target') && value ? byId.get(value)?.title ?? value : format(value);
      return { value:plain, lines:wrap(String(plain),width-32,13) };
    });
    const height = 22 + 18 * Math.max(1,...cells.map(cell => cell.lines.length));
    const row = { id:item.id, cells, y, height };
    y += height;
    return row;
  });
  const emptyLines = rows.length ? [] : wrap(relationships?'No relationships':'No elements',width-32,13);
  const height = rows.length ? y : headerHeight + 54 + (emptyLines.length-1)*18;
  return { columns, rows, width, height, headerHeight, relationships, emptyLines };
}

export function drawTable(layout, dark) {
  const { columns, rows, relationships, width, height, headerHeight, emptyLines } = layout;
  const surface = dark?'#182336':'#fff', header = dark?'#25344c':'#edf2fa', stripe = dark?'#1e2b41':'#f6f8fc';
  const rule = dark?'#3b4d65':'#d9e2ef', text = dark?'#edf2fb':'#21324d', muted = dark?'#b2bfd5':'#506482', accent = dark?'#b7c7ff':'#4149a5';
  let offset = 0;
  const x = columns.map(column => { const left = offset; offset += column.width; return left; });
  const textLines = (lines,left,y,attrs='') => `<text x="${left}" y="${y}" font-size="13" ${attrs}>${lines.map((line,index) => `<tspan x="${left}" dy="${index?18:0}">${escape(line)}</tspan>`).join('')}</text>`;
  const body = rows.map(({id,y,height,cells},index) =>
    `<g ${relationships?'data-edge':'data-node'}="${escape(id)}"><rect y="${y}" width="${width}" height="${height}" fill="${index%2?stripe:surface}"/><path d="M0 ${y}H${width}" stroke="${rule}"/>${
      cells.map(({value,lines},column) => {
        const key = columns[column].key, color = key === 'type' ? accent : key === 'description' ? muted : text;
        return `<g data-field="${escape(key)}"><title>${escape(value)}</title>${textLines(lines,x[column]+16,y+24,`fill="${color}" font-weight="${key==='title'?650:400}"`)}</g>`;
      }).join('')}</g>`).join('');
  return `<rect width="${width}" height="${height}" rx="12" fill="${surface}"/><path d="M0 ${headerHeight}V12Q0 0 12 0H${width-12}Q${width} 0 ${width} 12V${headerHeight}Z" fill="${header}"/>${columns.map((column,index) =>
    textLines(column.heading,x[index]+16,25,`fill="${muted}" font-weight="700"`)).join('')}${body}${
    emptyLines.length?textLines(emptyLines,16,headerHeight+31,`fill="${muted}"`):''}<rect width="${width}" height="${height}" rx="12" fill="none" stroke="${rule}"/>`;
}
