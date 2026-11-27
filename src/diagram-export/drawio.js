import { escape, num } from '../svg-values.js';
import { drawioStencil } from './archive.js';
import { boundsOf } from './scene.js';
import { groupedShapes } from './group.js';

const arrow = {arrow:'open',triangle:'block', 'filled-arrow':'block', diamond:'diamond','open-diamond':'diamond',dot:'oval'};
const percentage = value => num(value*100);
const degrees = angle => num(angle*180/Math.PI);
const xml = value => escape(value).replace(/\r?\n/g,'&#10;');

function pageXML(scene,index) {
  const {items,groups} = groupedShapes(scene.items);
  const point = ([x,y],offset,role) => `<mxPoint x="${num(x-offset.x)}" y="${num(y-offset.y)}"${role?' as="'+role+'"':''}/>`;
  const styled = item => `fillColor=${item.fill};strokeColor=${item.stroke};fillOpacity=${percentage(item.fillOpacity)};strokeOpacity=${percentage(item.strokeOpacity)};strokeWidth=${num(item.strokeWidth)};`+
    (item.dash?.length ? `dashed=1;fixDash=1;dashPattern=${item.dash.map(num).join(' ')};` : '');
  function vertex(item,offset,kind,style,value='') {
    return `<mxCell id="${item.id}" value="${xml(value)}" style="${escape(kind+';'+style)}" vertex="1" parent="${offset.id}"><mxGeometry x="${num(item.x-offset.x)}" y="${num(item.y-offset.y)}" width="${num(item.width)}" height="${num(item.height)}" as="geometry"/></mxCell>`;
  }
  function connector(item,offset) {
    const source = groups.get(item.source), target = groups.get(item.target);
    const begin = item.points[0], end = item.points.at(-1);
    // Calculate the port from the coordinates written to XML. Rounding the
    // fraction itself can move the endpoint off an otherwise horizontal leg.
    const fraction = (coordinate,origin,size) => (Number(num(coordinate))-Number(num(origin)))/(Number(num(size))||1);
    const port = (shape,[x,y],key) => shape
      ? `${key}X=${fraction(x,shape.x,shape.width)};${key}Y=${fraction(y,shape.y,shape.height)};${key}Perimeter=0;` : '';
    const head = (marker,end) => `${end}Arrow=${arrow[marker]??'none'};${end}Fill=${['triangle','open-diamond'].includes(marker)?0:1};`;
    // Treat exported points as geometry rather than hints for draw.io's router.
    const route = item.rounded ? 'noEdgeStyle=1;rounded=1;arcSize=20;' : 'noEdgeStyle=1;rounded=0;';
    const style = route+styled(item)+head(item.start,'start')+head(item.end,'end')+port(source,begin,'exit')+port(target,end,'entry');
    const via = item.points.slice(1,-1);
    return `<mxCell id="${item.id}" style="${escape(style)}" edge="1" parent="${offset.id}"${source?' source="'+source.id+'"':''}${target?' target="'+target.id+'"':''}>`+
      `<mxGeometry relative="1" as="geometry">${source?'':point(begin,offset,'sourcePoint')}${target?'':point(end,offset,'targetPoint')}`+
      (via.length?`<Array as="points">${via.map(p=>point(p,offset)).join('')}</Array>`:'')+'</mxGeometry></mxCell>';
  }
  function render(item,offset) {
    if (item.kind === 'group') {
      // Keep one native connector per route. Node groups give it a stable terminal.
      if (item.items.length===1 && !item.key.startsWith('node:')) return render(item.items[0],offset);
      return vertex(item,offset,'group','connectable=1;')+item.items.map(shape=>render(shape,item)).join('');
    }
    if (item.kind === 'text') {
      const value = {...item,x:item.x-2,width:item.width+4};
      return vertex(value,offset,'text',`html=0;spacing=0;overflow=visible;fillColor=none;strokeColor=none;fontFamily=Helvetica;fontColor=${item.color};fontStyle=${item.bold?1:0};fontSize=${num(item.fontSize)};align=${item.align};verticalAlign=middle;rotation=${degrees(item.angle)};`,item.text);
    }
    if (item.kind === 'image') {
      // mxGraph's semicolon-delimited style stores image data without the
      // optional ;base64 token. The image shape adds it when resolving the URI.
      return vertex(item,offset,'shape=image',`aspect=fixed;imageAspect=0;rotation=${degrees(item.angle)};image=${item.data.replace(';base64','')};`);
    }
    if (item.kind === 'line') {
      if (item.fill === 'none' || !item.fillOpacity) return connector(item,offset);
      const box = boundsOf(item.points);
      if (!box.width || !box.height) return item.stroke==='none'?'':connector(item,offset);
      const path = item.points.map(([x,y],i)=>`<${i?'line':'move'} x="${num(x-box.x)}" y="${num(y-box.y)}"/>`).join('');
      const stencil = drawioStencil(`<shape name="Freeform" w="${num(box.width)}" h="${num(box.height)}" aspect="variable" strokewidth="inherit"><foreground><path>${path}<close/></path><fillstroke/></foreground></shape>`);
      return vertex({...item,...box},offset,`shape=stencil(${stencil})`,styled(item));
    }
    const rounded = item.radius ? `rounded=1;absoluteArcSize=1;arcSize=${num(item.radius*2)};` : '';
    return vertex(item,offset,item.kind,`${styled(item)}${rounded}rotation=${degrees(item.angle)};`);
  }
  const content = items.map(item=>render(item,{id:1,x:0,y:0})).join('');
  const background = scene.background === 'none' ? '' : ` background="${scene.background}"`;
  return `<diagram id="page-${index+1}" name="${xml(scene.title)}"><mxGraphModel grid="0" page="1" pageWidth="${num(scene.width)}" pageHeight="${num(scene.height)}"${background}><root><mxCell id="0"/><mxCell id="1" parent="0"/>${content}</root></mxGraphModel></diagram>`;
}

export const drawioFile = scenes => `<?xml version="1.0" encoding="UTF-8"?><mxfile host="arch.js">${scenes.map(pageXML).join('')}</mxfile>`;
