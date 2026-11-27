import { escape } from './svg-values.js';
import {ArchError} from './errors.js';
import { isTypeRecoveryDiagnostic } from './syntax-recovery.js';
import { diagnosticHelpLink } from './diagnostic-help.js';
import { normalizeViewBackgroundColor, viewBackground } from './view-background.js';

export function validationMode(model,options={}) {
  const show=options.showValidation??model.config?.showValidation;if(show!==undefined&&typeof show!=='boolean')throw new ArchError('showValidation must be true or false',model.config?.loc,'ARCH_VALIDATION');
  const mode=options.validation??model.validation??model.config?.validation??'strict';
  if(!['strict','draft'].includes(mode))throw new ArchError('validation must be strict or draft',model.config?.loc,'ARCH_VALIDATION');
  return mode;
}
export function validationDiagnostics(diagnostics,mode) {
  return diagnostics.map(d=>mode==='draft'&&d.incomplete?{...d,severity:'warning'}:d);
}

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
export function withValidationNotices(graph,diagnostics,options={}) {
  if(options.showValidation===false)return graph;
  const decorate=g=>{if(g.kind==='views'){const layouts=g.layouts.map(decorate);return {...g,layouts,sections:g.sections.map((s,i)=>({...s,graph:layouts[i]}))};}return {...g,validationMarkers:diagnostics.filter(d=>d.mappingStatus&&d.viewId===g.view.id)};};
  graph=decorate(graph);
  const notices=diagnostics.filter(d=>d.severity==='warning');
  if(!notices.length)return graph;
  return withNotices(graph, notices, {kind:'notices', validationMode:options.validation??'draft', diagnostics:notices});
}
export function withSyntaxNotices(graph, diagnostics) {
  if (!diagnostics.length) return graph;
  return withNotices(graph, diagnostics, {kind:'syntax-notices', syntaxDiagnostics:diagnostics});
}
function withNotices(graph, notices, fields) {
  const width=Math.max(420,graph.bounds.width),columns=Math.max(20,Math.floor((width-56)/7));
  const visible = fields.kind === 'syntax-notices' ? notices.slice(0, 20) : notices;
  const rows=[], noticeHelp=Object.create(null);
  const legend = [];
  if (notices.some(d=>d.mappingStatus==='review')) legend.push('? = mapping not modeled');
  if (notices.some(d=>d.mappingStatus==='hidden')) legend.push('! = required mapping hidden');
  if (legend.length) rows.push(...wrap(legend.join('; ')+'.',columns));
  visible.forEach((d,index)=>{
    const lines = wrap(`${index+1}. ${d.message}${d.path?` [${d.path}]`:d.line?` (line ${d.line}, column ${d.column})`:''}`,columns);
    if (d.kind === 'relationship' && d.candidates?.length) {
      lines.push('   Suggested relationship types');
      for (const type of d.candidates) lines.push(...wrap(`     type ${type}`, columns));
    }
    rows.push(...lines);
    noticeHelp[rows.length] = d;
    rows.push('Open help');
  });
  if (visible.length < notices.length) rows.push(`… ${notices.length - visible.length} more errors`);
  const noticeHeight=62+rows.length*18;
  return {...graph,...fields,content:graph,noticeRows:rows,noticeHelp,
    bounds:{x:0,y:0,width,height:graph.bounds.height+24+noticeHeight}};
}
function sourceErrorLabel(diagnostics) {
  const kinds = [];
  if (diagnostics.some(d => d.code === 'ARCH_SYNTAX')) kinds.push('syntax');
  if (diagnostics.some(isTypeRecoveryDiagnostic)) kinds.push('type');
  if (diagnostics.some(d => d.code === 'ARCH_VIEWPOINT_RELATION')) kinds.push('viewpoint');
  const first = kinds[0];
  kinds[0] = first[0].toUpperCase() + first.slice(1);
  return `${kinds.length === 1 ? kinds[0] : kinds.slice(0, -1).join(', ') + ' and ' + kinds.at(-1)} errors`;
}
export function noticesSVG(graph,renderContent,options={}) {
  const theme=options.theme??graph.view.theme,dark=theme==='dark';
  const background = graph.sections
    ? graph.sections.some(({graph: child}) => normalizeViewBackgroundColor(child.view.backgroundColor) === 'transparent')
      ? 'transparent' : graph.backgroundColor
    : graph.view.backgroundColor;
  const canvas = viewBackground(background,theme);
  const syntax = graph.kind === 'syntax-notices', mode = graph.validationMode ?? 'draft';
  const [fill, stroke, fg] = syntax
    ? dark ? ['#450a0a','#f87171','#fecaca'] : ['#fef2f2','#dc2626','#7f1d1d']
    : dark ? ['#422006','#a16207','#fde68a'] : ['#fffbeb','#f59e0b','#78350f'];
  const mappingReview = !syntax && graph.diagnostics.every(issue => issue.mappingStatus==='review');
  const groupLabel = syntax ? sourceErrorLabel(graph.syntaxDiagnostics) : mappingReview ? 'Mapping review' : 'Validation notices';
  const heading = syntax ? `${groupLabel} — partial preview (${graph.syntaxDiagnostics.length})`
    : mappingReview ? `Mapping review — ${graph.diagnostics.length} ${graph.diagnostics.length===1?'item':'items'}`
    : `${mode==='draft'?'Draft':'Review'} — ${graph.diagnostics.length} validation notices`;
  const marker = syntax ? 'data-arch-syntax="true"' : `data-arch-validation="${mode}"`;
  const className = syntax ? 'arch-syntax-notice' : 'arch-validation-notice';
  const {width,height}=graph.bounds,y=graph.content.bounds.height+24;
  const content=renderContent(graph.content,options).replace(/^<svg\b/,'<svg x="0" y="0"');
  const rows=graph.noticeRows.map((text,index)=>{
    const attrs=`class="${className}" y="${round(y+52+index*18)}" font-size="12" xml:space="preserve"`;
    const diagnostic=graph.noticeHelp[index];
    if (!diagnostic) return `<text ${attrs} x="24">${escape(text)}</text>`;
    const {query,href,label}=diagnosticHelpLink(diagnostic,options);
    return `<a href="${escape(href)}" data-arch-diagnostic-help="${escape(query)}" aria-label="${escape(label)}"><title>${escape(label)}</title><text ${attrs} x="40" text-decoration="underline">${escape(text)}</text></a>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" data-arch-svg="${escape(theme)}" ${marker} role="group" aria-label="${escape(graph.title)} — ${heading}" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}" style="max-width:100%;height:auto;background:${canvas.color}"><rect width="${round(width)}" height="${round(height)}" fill="${canvas.fill}"/>${content}<g class="${className}s" role="group" aria-label="${groupLabel}"><rect x="8" y="${round(y)}" width="${round(width-16)}" height="${round(height-y-8)}" rx="8" fill="${fill}" stroke="${stroke}"/><g fill="${fg}" font-family="ui-monospace,Consolas,monospace"><text x="24" y="${round(y+28)}" font-size="14" font-weight="700">${heading}</text>${rows}</g></g></svg>`;
}

export function validationMarkersSVG(svg,graph) {
 if(!['connected','tree'].includes(graph.view.diagram?.type??'connected'))return svg;
 const diagnostics=graph.validationMarkers??[];if(!diagnostics.length)return svg;
 const marks=[];
 for(const n of graph.nodes??[]) {
  if(n.referenceOnly)continue;
  const items=diagnostics.filter(d=>d.elementId===(n.modelId??n.id));if(!items.length||![n.x,n.y,n.width,n.height].every(Number.isFinite))continue;
  const hidden=items.some(d=>d.mappingStatus==='hidden'),status=hidden?'hidden':'review',x=n.x+n.width+10,y=n.y+10;
  const title=escape(items.map(d=>d.message).join('\n'));
  marks.push(`<g class="arch-validation-marker" data-validation-node="${escape(n.id)}" data-validation-status="${status}" tabindex="0" role="img" aria-label="${title}"><title>${title}</title>${hidden?`<path d="M ${x} ${y-9} L ${x+9} ${y+8} L ${x-9} ${y+8} Z" fill="#fbbf24" stroke="#92400e"/>`:`<circle cx="${x}" cy="${y}" r="8" fill="#fef3c7" stroke="#92400e" stroke-dasharray="2 2"/>`}<text x="${x}" y="${y+4}" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#78350f">${hidden?'!':'?'}</text></g>`);
 }
 const index=svg.lastIndexOf('</svg>');return svg.slice(0,index)+marks.join('')+svg.slice(index);
}
