import { escape } from './svg-values.js';
import { wrap } from './text-layout.js';

const labels = { id:'ID', title:'Name', type:'Type', source:'Source', target:'Target' };
const format = value => Array.isArray(value) ? value.join(', ') : (value ?? '—');
export const tableDefaults = mode => mode === 'relationships' ? ['source','title','target','type'] : ['title','type','description'];
export function tableFieldNames(mode, items, profile) {
  const types = mode === 'relationships' ? profile.relationTypes : profile.nodeTypes;
  const keys = new Set([...Object.keys(labels).filter(key => mode === 'relationships' || !['source','target'].includes(key)),
    'description','technology','tags', ...(mode === 'relationships' ? ['direction'] : ['stereotype','icon','parent'])]);
  for (const type of new Set(items.map(item => item.type))) for (const key of Object.keys(types[type]?.attributes ?? {})) keys.add(key);
  return keys;
}

export function tableLayout(nodes, edges, options) {
  const byId = new Map(nodes.map(node => [node.id,node]));
  const relationships = options.mode === 'relationships';
  const fields = options.fields ?? tableDefaults(options.mode);
  const columns = fields.map(key => ({
    key, title:labels[key] ?? key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase()),
    width:key === 'description' ? 280 : key === 'title' ? 240 : key === 'type' ? 226 : 182
  }));
  let y = 56;
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
  return { columns, rows, relationships, width:columns.reduce((sum,column) => sum + column.width,0), height:rows.length ? y : 110 };
}

export function drawTable(layout, dark) {
  const { columns, rows, relationships, width, height } = layout;
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
  return `<rect width="${width}" height="${height}" rx="12" fill="${surface}"/><path d="M0 56V12Q0 0 12 0H${width-12}Q${width} 0 ${width} 12V56Z" fill="${header}"/>${columns.map((column,index) =>
    textLines(wrap(column.title,column.width-32,13).slice(0,2),x[index]+16,25,`fill="${muted}" font-weight="700"`)).join('')}${body}${
    rows.length?'':textLines([relationships?'No relationships':'No elements'],16,87,`fill="${muted}"`)}<rect width="${width}" height="${height}" rx="12" fill="none" stroke="${rule}"/>`;
}
