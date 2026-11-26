import { matches } from './profiles.js';
import { cardShadowFilter, escape } from './svg-values.js';
import { textLength, wrap } from './text-layout.js';
import { gridDefinition, isGridDiagram } from './diagram-types.js';
import { composite, contrast, foreground, DEFAULT_BACKGROUND_OPACITY } from './colors.js';

const left = 136;
const TILE_OVERLAY_OPACITY = 0.9;

function defaultLayout(profile) {
  const ids=Object.keys(profile.viewpoints), columns=Array(Math.max(1,Math.min(4,ids.length))).fill('');
  const rows=Array.from({length:Math.ceil(ids.length/columns.length)},()=>({title:'',color:'#3657cf',darkColor:'#a8bbff'}));
  return {title:'Architecture · Viewpoint grid',columns,rows,
    cells:ids.map((id,index)=>({id,row:Math.floor(index/columns.length),col:index%columns.length}))};
}

export function gridProjection(nodes, edges, profile, views, diagram, selectedViews = []) {
  const configured = gridDefinition(diagram.type,profile);
  const layout = configured ?? defaultLayout(profile);
  const {title,columns} = layout;
  const rows = layout.rows.map(row => {
    if (!row.styleGroup) return row;
    const color = profile.styleGroups[row.styleGroup].backgroundColor;
    return {...row,color,darkColor:color};
  });
  const show = diagram.show ?? layout.show ?? 'all';
  const selectedOnly = show==='selected', modeledOnly = show==='modeled', coverage = show==='coverage';
  const selected = new Set(selectedViews);
  const selectedProducts = new Set();
  const codes = new Map(layout.cells.map(({id}) => [id.toLowerCase(),id]));
  const cellCode = value => typeof value==='string' ? codes.get(value.toLowerCase()) : undefined;
  const requiredCodes = diagram.viewpoints && new Set(diagram.viewpoints.map(cellCode));
  const filtered = selectedOnly || modeledOnly || requiredCodes!==undefined;
  const showExtras = !coverage && !modeledOnly && requiredCodes===undefined;
  const allowedCode = code => requiredCodes ? requiredCodes.has(code) : code!==undefined || showExtras;
  const viewpoints = new Map(), bindings = new Map(), groups = new Map();
  const custom = new Map(), unassigned = [], otherDiagrams = [], represented = new Map();
  const bucket = id => {
    if (!groups.has(id)) groups.set(id,{products:[],diagrams:[]});
    return groups.get(id);
  };
  for (const node of nodes) {
    if (matches(node.type,['Viewpoint'],profile.nodeTypes)) {
      const code = cellCode(node.attributes?.nafViewpoint) ?? cellCode(node.id) ??
        cellCode(node.title.trim().match(/^[^\s:·—–]+/u)?.[0]);
      viewpoints.set(node.id,code);
      if (!code) custom.set(node.id,{key:`viewpoint:${node.id}`,title:node.title,products:[],diagrams:[]});
    }
    if (matches(node.type,['View'],profile.nodeTypes) && node.attributes?.viewpoint)
      bindings.set(node.id,node.attributes.viewpoint);
  }
  for (const edge of edges) {
    if (matches(edge.type,['GovernsView'],profile.relationTypes) && !bindings.has(edge.target))
      bindings.set(edge.target,edge.source);
    if (matches(edge.type,['ConformsToViewpoint'],profile.relationTypes) && !bindings.has(edge.source))
      bindings.set(edge.source,edge.target);
  }
  for (const view of views) {
    const code = cellCode(view.viewpoint);
    if (view.meta!==undefined || isGridDiagram(view.diagram?.type,profile)) continue;
    if (code && view.represents) {
      if (!represented.has(view.represents)) represented.set(view.represents,new Set());
      represented.get(view.represents).add(code);
    }
    if (!allowedCode(code)) continue;
    if (view.represents && selected.has(view.id)) selectedProducts.add(view.represents);
    if (selectedOnly && !selected.has(view.id)) continue;
    if (code) bucket(code).diagrams.push(view);
    else otherDiagrams.push(view);
  }
  for (const node of nodes) {
    if (!matches(node.type,['View'],profile.nodeTypes)) continue;
    if (selected.has(node.id)) selectedProducts.add(node.id);
    if (selectedOnly && !selectedProducts.has(node.id)) continue;
    const binding = bindings.get(node.id), linked = represented.get(node.id);
    const code = viewpoints.get(binding) ?? (linked?.size===1 ? linked.values().next().value : undefined);
    if (!allowedCode(code)) continue;
    if (code) bucket(code).products.push(node);
    else if (custom.has(binding)) custom.get(binding).products.push(node);
    else unassigned.push(node);
  }

  const cells = layout.cells.filter(({id})=>allowedCode(id) &&
    (!selectedOnly || groups.has(id)) &&
    (!modeledOnly || groups.get(id)?.diagrams.length));
  const visibleColumns = new Set(cells.map(cell=>cell.col));
  const widths = columns.map((column,col) => {
    if (filtered && !visibleColumns.has(col)) return 0;
    return !configured || column || cells.some(cell=>cell.col===col && !cell.vertical && groups.has(cell.id)) ? 154 : 56;
  });
  let width = left;
  const offsets = widths.map(size => { const x=width; width+=size; return x; });
  width=Math.max(width,380);
  const titles = wrap(title,width-28,17);
  const legend = wrap(coverage ? 'Color · diagram declared     Gray · no diagram declared     Outline · selected' :
    'Products · modeled View elements     Diagrams · declared views     Outline · selected',width-28,12);
  const columnLines = columns.map((column,i)=>widths[i] ? wrap(column,widths[i]-16,12) : []);
  const legendY = 29+titles.length*20, columnsY = legendY+legend.length*15+5;
  const planned = cells.map(cell => {
    const {id,col,bridge,vertical} = cell;
    const content = groups.get(id);
    const w = vertical ? 50 : widths[col]-6;
    const compact = vertical || !content && (bridge || w<100);
    const headerHeight = vertical ? Math.max(52,Math.ceil(textLength(id)*12)+16) : undefined;
    const heading = profile.viewpoints[id].title ?? id;
    return {...cell,key:`cell:${id}`,x:offsets[col]+(widths[col]-w)/2,w,heading,headerHeight,
      ...cardContent(heading,content,w,displayModes(cell),selected,selectedProducts,compact,headerHeight)};
  });
  const cardsByRow = rows.map(()=>[]);
  for (const card of planned) cardsByRow[card.row].push(card);
  const rowTops = [];
  let y = columnsY+Math.max(0,...columnLines.map(lines=>lines.length))*15+5;
  cardsByRow.forEach((current,index) => {
    if (filtered && !current.length) return;
    const regular = current.filter(cell=>!cell.bridge), bridges = current.filter(cell=>cell.bridge);
    rowTops[index]=y;
    const height = Math.max(92,...regular.map(cell=>cell.h));
    for (const cell of regular) Object.assign(cell,{y,h:height});
    y += height+6;
    for (const cell of bridges) cell.y=y;
    if (bridges.length) y += Math.max(...bridges.map(cell=>cell.h))+6;
  });

  const extras = showExtras ? [...custom.values()].filter(group=>!selectedOnly || group.products.length) : [];
  if (unassigned.length) extras.push({key:'unassigned:products',title:'Products without a grid assignment',products:unassigned,diagrams:[]});
  if (otherDiagrams.length) extras.push({key:'unassigned:diagrams',title:'Diagrams outside the grid',products:[],diagrams:otherDiagrams});
  const extraStart = y;
  if (extras.length) y += 34;
  const extraCards = extras.map(group => {
    const card = {key:group.key,heading:group.title,x:14,y,w:width-28,
      ...cardContent(group.title,group,width-28,displayModes(),selected,selectedProducts)};
    y+=card.h+6;
    return card;
  });
  const empty = (filtered || coverage) && !planned.length && !extraCards.length;
  const emptyMessage = selectedOnly ? 'No products or diagrams selected.' :
    modeledOnly ? 'No modeled diagrams match the grid viewpoints.' : 'No viewpoints selected.';
  const muteUnselected = !coverage && (!modeledOnly || planned.some(cell=>cell.state==='selected'));
  return {titles,legend,legendY,columnLines,columnsY,rows,width,height:y+(empty?40:8),offsets,rowTops,cells:planned,
    extras:extraCards,extraStart,emptyMessage:empty ? emptyMessage : undefined,muteUnselected,coverage};

  function displayModes(cell) {
    return Object.fromEntries(['products','diagrams'].map(kind => [kind,diagram[kind] ?? cell?.[kind] ?? layout[kind] ?? 'count']));
  }
}

function cardContent(title, group, width, modes, selected, selectedProducts, compact, headerHeight) {
  const lines = compact ? [] : wrap(title,width-16,12);
  let h = headerHeight ?? (lines.length ? 36+lines.length*15 : 28);
  const sections = [];
  for (const kind of ['products','diagrams']) {
    const items = group?.[kind] ?? [], mode = modes[kind];
    if (!items.length || mode==='none') continue;
    const start = h;
    h += 18;
    const entries = mode==='list' ? items.map(item => {
      const text = wrap(item.title || item.id,width-24,11);
      const y = h;
      h += text.length*14+5;
      const selection = kind==='diagrams' ? selected : selectedProducts;
      return {id:item.id,title:item.title || item.id,text,y,h:h-y,selected:selection.has(item.id)};
    }) : [];
    sections.push({kind,count:items.length,y:start,entries});
  }
  const products = group?.products ?? [], diagrams = group?.diagrams ?? [];
  const currentViews=diagrams.filter(view=>selected.has(view.id));
  const currentProducts=products.filter(product=>selectedProducts.has(product.id));
  const state = currentViews.length || currentProducts.length ? 'selected' : products.length || diagrams.length ? 'available' : 'empty';
  return {lines,sections,products,diagrams,currentViews,currentProducts,state,h:h+(sections.length?6:0)};
}

export function drawNafGrid(plan, dark, prefix, diagramBackground) {
  const sharedPalette = plan.rows.some(row => row.styleGroup);
  const surface = sharedPalette ? diagramBackground : dark?'#1a2538':'#fff';
  const overlayColor = dark ? '#2b313c' : '#e3e6ec';
  const shadowId = `${prefix}-grid-card-shadow`;
  const ink = dark?'#edf4ff':'#253550', muted = dark?'#b5c4db':'#586d88', line=dark?'#3b4c66':'#d7e1ef';
  const heading = (text,x,y,size=13,color=muted,weight=650) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${escape(text)}</text>`;
  const selector = `#${prefix}-diagram [data-grid-tile]`;
  const muteLabels = plan.muteUnselected ? `${selector}[data-grid-state="empty"] text,${selector}[data-grid-state="available"] text,${selector} [data-grid-entry-state="available"] text{fill:var(--grid-muted)}` : '';
  const styles = `<style>${muteLabels}
    ${selector} [data-grid-entry-state="selected"] rect{fill:var(--grid-ink);fill-opacity:.15}
  </style>`;
  const shadow = sharedPalette ? `<defs>${cardShadowFilter(shadowId)}</defs>` : '';
  const base = styles+shadow+`<rect width="${plan.width}" height="${plan.height}" rx="14" fill="${surface}" stroke="${line}"/>`+
    plan.titles.map((title,i)=>heading(title,14,28+20*i,17,ink,750)).join('')+
    plan.legend.map((text,i)=>heading(text,14,plan.legendY+15*i,12)).join('')+
    plan.columnLines.flatMap((names,col)=>names.map((name,i)=>heading(name,plan.offsets[col]+8,plan.columnsY+15*i,12))).join('');
  const rowLabels = plan.rows.map(({title,color,darkColor,styleGroup},row) => {
    const top = plan.rowTops[row];
    if (top===undefined) return '';
    const labelColor = styleGroup ? ink : dark ? darkColor : color;
    return wrap(title,left-23,13).map((text,index) => heading(text,14,top+27+17*index,13,labelColor,750)).join('');
  }).join('');
  // All tiles in a row use the same paint in a given theme. Calculate
  // channel blends and contrast once per row, not once per SVG tile.
  const rowPaint = plan.rows.map(paint);
  const extraPaint = paint();
  const grayInk = dark ? '#bac4d4' : '#505c70';
  const unmodeledPaint = {background:overlayColor,opacity:1,color:grayInk,mutedText:grayInk,
    frameStroke:line,selectedStroke:ink,filter:''};
  function paint(palette) {
    const background = palette ? dark ? palette.darkColor : palette.color : surface;
    const opacity = palette ? DEFAULT_BACKGROUND_OPACITY : 1;
    const cardFill = composite(background,surface,opacity);
    const color = foreground(cardFill), soft = composite(color,cardFill,0.76);
    const mutedText = contrast(soft,cardFill)>=4.5 ? soft : color;
    return {background,opacity,color,mutedText,
      frameStroke:palette?.styleGroup ? composite(background,dark ? cardFill : color,0.6) : line,
      selectedStroke:palette?.styleGroup ? color : line,
      filter:palette?.styleGroup ? ` filter="url(#${shadowId})"` : ''};
  }
  function drawCard(card) {
    const {id,key,row,x,y,w,h,heading:caption,lines,sections,state,products,diagrams,currentViews,currentProducts,vertical,headerHeight} = card;
    const selected = state==='selected';
    const unmodeled = plan.coverage && diagrams.length===0;
    const {background,opacity,color,mutedText,frameStroke,selectedStroke,filter} =
      unmodeled ? unmodeledPaint : rowPaint[row] ?? extraPaint;
    const code = id===undefined?'':` data-naf-cell="${escape(id)}"`;
    const metadata = `${code} data-product-count="${products.length}" data-diagram-count="${diagrams.length}" data-grid-tile="${escape(key)}" data-grid-state="${state}" data-grid-title="${escape(caption)}" data-grid-products="${escape(products.map(item=>item.id).join(' '))}" data-grid-views="${escape(diagrams.map(item=>item.id).join(' '))}"`;
    const tip = [id && id+' '+caption || caption,`${products.length} products · ${diagrams.length} diagrams`].join('\n');
    const selection = ` data-selected-views="${escape(currentViews.map(view=>view.id).join(' '))}" data-selected-products="${escape(currentProducts.map(product=>product.id).join(' '))}"`;
    const coverage = plan.coverage ? ` data-grid-coverage="${unmodeled ? 'unmodeled' : 'modeled'}"` : '';
    const overlay = !selected && plan.muteUnselected ? `<g aria-hidden="true" pointer-events="none"><rect class="arch-grid-tile-overlay" x="${x+0.5}" y="${y+0.5}" width="${w-1}" height="${h-1}" rx="6.5" fill="${overlayColor}" fill-opacity="${TILE_OVERLAY_OPACITY}"/></g>` : '';
    const outline = selected ? `<g aria-hidden="true" pointer-events="none"><rect x="${x+3}" y="${y+3}" width="${w-6}" height="${h-6}" rx="4" fill="none" stroke="${color}" stroke-width="2"/></g>` : '';
    const stroke = selected ? selectedStroke : frameStroke;
    const cx = x+w/2, cy = y+(vertical && sections.length ? headerHeight : h)/2;
    const codeLabel = vertical
      ? `<text x="${cx}" y="${cy}" fill="${color}" font-size="12" font-weight="750" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${cx} ${cy})">${escape(id)}</text>`
      : id ? heading(id,x+8,y+19,w<100?9:12,color,750) : '';
    return `<g${metadata}${selection}${coverage} style="--grid-ink:${color};--grid-muted:${mutedText}"><title>${escape(tip)}</title><rect class="arch-grid-tile-frame" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${background}" fill-opacity="${opacity}" stroke="${stroke}"${filter}/>`+
      outline+codeLabel+
      lines.map((text,index)=>heading(text,x+8,y+33+15*index,12,color,630)).join('')+
      sections.map(({kind,y:sectionY,count,entries}) => {
        const product = kind==='products';
        const label = vertical ? (product?'P':'D') : product?'Products':'Diagrams';
        return heading(`${label} · ${count}`,x+8,y+sectionY+11,11,color,750)+
          entries.map(entry => {
            const rowY=y+entry.y;
            const attrs=product?`data-node="${escape(entry.id)}"`:`data-view-link="${escape(entry.id)}"`;
            return `<g ${attrs} data-grid-entry-state="${entry.selected?'selected':'available'}"><title>${escape(entry.title)}</title><rect x="${x+4}" y="${rowY}" width="${w-8}" height="${entry.h}" rx="3" fill="transparent"/>`+
              entry.text.map((text,i)=>heading(text,x+8,rowY+11+i*14,11,color,500)).join('')+'</g>';
          }).join('');
      }).join('')+overlay+'</g>';
  }
  const extras = plan.extras.length ? heading('Additional products and viewpoints',14,plan.extraStart+20,13,ink,750)+plan.extras.map(drawCard).join('') : '';
  const empty=plan.emptyMessage ? heading(plan.emptyMessage,14,plan.extraStart+19) : '';
  return base+rowLabels+plan.cells.map(drawCard).join('')+extras+empty;
}
