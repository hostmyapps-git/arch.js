import {ArchError} from './errors.js';

export function validationMode(model,options={}) {
  const mode=options.validation??model.validation??model.config?.validation??'strict';
  if(!['strict','draft'].includes(mode))throw new ArchError('validation must be strict or draft',model.config?.loc,'ARCH_VALIDATION');
  return mode;
}
export function validationDiagnostics(diagnostics,mode) {
  return diagnostics.map(d=>mode==='draft'&&d.incomplete?{...d,severity:'warning'}:d);
}

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const round=n=>Math.round(n*1000)/1000;
function wrap(text,columns) {
  const lines=[];let line='',width=0;
  const measure=s=>[...s].reduce((sum,ch)=>sum+(ch.codePointAt(0)>0x2fff?2:1),0);
  for(const ch of text) {
    const cells=ch.codePointAt(0)>0x2fff?2:1;
    if(ch==='\n'){lines.push(line);line='';width=0;continue;}
    if(width+cells>columns){
      const space=line.lastIndexOf(' ');
      lines.push(space>0?line.slice(0,space):line);line=space>0?line.slice(space+1):'';width=measure(line);
    }
    if(ch!=='\n'){line+=ch;width+=cells;}
  }
  lines.push(line);return lines;
}
export function withValidationNotices(graph,diagnostics) {
  const notices=diagnostics.filter(d=>d.severity==='warning');
  if(!notices.length)return graph;
  const width=Math.max(420,graph.bounds.width),columns=Math.max(20,Math.floor((width-56)/7));
  const rows=notices.flatMap((d,index)=>wrap(`${index+1}. ${d.message}${d.path?` [${d.path}]`:d.line?` (line ${d.line}, column ${d.column})`:''}`,columns));
  const noticeHeight=62+rows.length*18;
  return {...graph,kind:'notices',content:graph,diagnostics:notices,noticeRows:rows,
    bounds:{x:0,y:0,width,height:graph.bounds.height+24+noticeHeight}};
}
export function noticesSVG(graph,renderContent,options={}) {
  const theme=options.theme??graph.view.theme,dark=theme==='dark',bg=dark?'#111827':'#fafbfe',fg=dark?'#fde68a':'#78350f';
  const {width,height}=graph.bounds,y=graph.content.bounds.height+24;
  const content=renderContent(graph.content,options).replace(/^<svg\b/,'<svg x="0" y="0"');
  return `<svg xmlns="http://www.w3.org/2000/svg" data-arch-svg="${escape(theme)}" data-arch-validation="draft" role="img" aria-label="${escape(graph.title)} — draft with ${graph.diagnostics.length} validation notices" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}" style="max-width:100%;height:auto;background:${bg}"><rect width="${round(width)}" height="${round(height)}" fill="${bg}"/>${content}<g class="arch-validation-notices" role="group" aria-label="Validation notices"><rect x="8" y="${round(y)}" width="${round(width-16)}" height="${round(height-y-8)}" rx="8" fill="${dark?'#422006':'#fffbeb'}" stroke="${dark?'#a16207':'#f59e0b'}"/><g fill="${fg}" font-family="ui-monospace,Consolas,monospace"><text x="24" y="${round(y+28)}" font-size="14" font-weight="700">Draft — ${graph.diagnostics.length} validation notices</text>${graph.noticeRows.map((text,index)=>`<text class="arch-validation-notice" x="24" y="${round(y+52+index*18)}" font-size="12" xml:space="preserve">${escape(text)}</text>`).join('')}</g></g></svg>`;
}
