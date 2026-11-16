import { modelSource } from './source.js';

const escape = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const cells = char => char.codePointAt(0)>255?2:1;

export function layoutMeta(model, profile, view) {
  const source = modelSource(model,view.meta), rows=[];
  let y=82;
  for(const [index,line] of source.trimEnd().split('\n').entries()) {
    let part='',width=0,continuation=false;
    for(const char of line.replace(/\t/g,'  ')) {
      if(width+cells(char)>112){rows.push({line:index+1,text:part,y,continuation});y+=19;part='';width=0;continuation=true;}
      part+=char;width+=cells(char);
    }
    rows.push({line:index+1,text:part,y,continuation});y+=19;
  }
  return {kind:'meta',title:model.title,description:model.description,profile:{id:profile.id,version:profile.version},
    view,nodes:[],edges:[],format:view.meta,source,rows,bounds:{x:0,y:0,width:1040,height:y+26}};
}

export function metaSVG(graph,{theme,idPrefix}) {
  const dark=theme==='dark',bg=dark?'#111827':'#fafbfe',card=dark?'#172033':'#fff',text=dark?'#e2e8f0':'#334155',muted=dark?'#94a3b8':'#64748b',border=dark?'#334155':'#e2e8f0';
  const {width,height}=graph.bounds;
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${idPrefix}-diagram" data-arch-svg="${theme}" data-arch-meta="${graph.format}" data-diagram="meta" role="img" aria-labelledby="${idPrefix}-title ${idPrefix}-desc" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto;background:${bg}"><title id="${idPrefix}-title">${escape(graph.title)} — ${escape(graph.view.title)}</title><desc id="${idPrefix}-desc">Architecture source as ${graph.format.toUpperCase()}</desc><rect width="${width}" height="${height}" fill="${bg}"/><rect x="16" y="16" width="${width-32}" height="${height-32}" rx="10" fill="${card}" stroke="${border}"/><text x="34" y="44" fill="${text}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" font-weight="650">${graph.format.toUpperCase()} · ${escape(graph.view.title)}</text><path d="M16 57 H${width-16}" stroke="${border}"/><g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="12">${graph.rows.map(row=>`<g class="arch-meta-row" data-source-line="${row.line}">${row.continuation?'':`<text x="66" y="${row.y}" fill="${muted}" text-anchor="end">${row.line}</text>`}<text class="arch-meta-code" x="86" y="${row.y}" fill="${text}" xml:space="preserve">${escape(row.text)}</text></g>`).join('')}</g></svg>`;
}
