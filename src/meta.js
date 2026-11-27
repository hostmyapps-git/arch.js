import { escape } from './svg-values.js';
import { singleLine } from './text-layout.js';
import { modelSource } from './source.js';
import { viewBackground } from './view-background.js';
import { codePalette, sourceTokens } from './source-highlight.js';

const cells = char => char.codePointAt(0)>255?2:1;

export function layoutMeta(model, profile, view) {
  const source = modelSource(model,view.meta), rows=[];
  let y=82;
  for(const [index,line] of source.trimEnd().split('\n').entries()) {
    let tokens=[],width=0,continuation=false;
    const flush=()=>{
      rows.push({line:index+1,text:tokens.map(token=>token.text).join(''),tokens,y,continuation});
      y+=19;tokens=[];width=0;continuation=true;
    };
    for(const {kind,text} of sourceTokens(line.replace(/\t/g,'  '),view.meta)) {
      let part='';
      for(const char of text) {
        if(width+cells(char)>110){if(part)tokens.push({kind,text:part});flush();part='';}
        part+=char;width+=cells(char);
      }
      if(part)tokens.push({kind,text:part});
    }
    flush();
  }
  return {kind:'meta',title:model.title,description:model.description,profile:{id:profile.id,version:profile.version},
    view,nodes:[],edges:[],format:view.meta,source,rows,bounds:{x:0,y:0,width:1040,height:y+26}};
}

export function metaSVG(graph,{theme,idPrefix}) {
  const canvas = viewBackground(graph.view.backgroundColor,theme);
  const dark=theme==='dark',card=dark?'#172033':'#fff',header=dark?'#233047':'#eef3fa',muted=dark?'#aebed3':'#52647b',border=dark?'#334155':'#dce4f0';
  const ink=codePalette(dark);
  const {width,height}=graph.bounds;
  const rows=graph.rows.map(row=>`<g class="arch-meta-row" data-source-line="${row.line}">${row.continuation?'':`<text x="62" y="${row.y}" fill="${muted}" text-anchor="end" aria-hidden="true">${row.line}</text>`}<text class="arch-meta-code" x="90" y="${row.y}" fill="${ink.plain}" xml:space="preserve">${row.tokens.map(token=>`<tspan class="token-${token.kind}" fill="${ink[token.kind]}">${escape(token.text)}</tspan>`).join('')}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${idPrefix}-diagram" data-arch-svg="${theme}" data-arch-meta="${graph.format}" data-diagram="meta" role="img" aria-labelledby="${idPrefix}-title ${idPrefix}-desc" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto;background:${canvas.color}"><title id="${idPrefix}-title">${escape(graph.title)} — ${escape(graph.view.title)}</title><desc id="${idPrefix}-desc">Architecture source as ${graph.format.toUpperCase()}</desc><rect width="${width}" height="${height}" fill="${canvas.fill}"/><rect x="16" y="16" width="${width-32}" height="${height-32}" rx="10" fill="${card}"/><path d="M16 57V26Q16 16 26 16H${width-26}Q${width-16} 16 ${width-16} 26V57Z" fill="${header}"/><path d="M16 57H${width-16} M74 57V${height-26}" fill="none" stroke="${border}"/><rect x="16" y="16" width="${width-32}" height="${height-32}" rx="10" fill="none" stroke="${border}"/><text x="34" y="42" fill="${ink.keyword}" font-family="ui-monospace,monospace" font-size="12" font-weight="700">${graph.format.toUpperCase()}</text><text x="90" y="42" fill="${ink.plain}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="15" font-weight="650">${escape(singleLine(graph.view.title,width-124,15))}</text><g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="12">${rows}</g></svg>`;
}
