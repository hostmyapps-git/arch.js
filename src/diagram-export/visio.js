import { escape } from '../svg-values.js';
import { boundsOf } from './scene.js';
import { groupedShapes } from './group.js';
import { decodePNG } from './images.js';
import { zipEntries } from './archive.js';

const main = 'http://schemas.microsoft.com/office/visio/2011/1/core';
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const visioRel = 'http://schemas.microsoft.com/visio/2010/relationships';
const opc = 'http://schemas.openxmlformats.org/package/2006';
const xml = '<?xml version="1.0" encoding="UTF-8"?>';
const ns = `xmlns="${main}" xmlns:r="${rel}" xml:space="preserve"`;
const units = value => +(value/96).toFixed(8);
const cell = (name,value,formula) => `<Cell N="${name}" V="${escape(value)}"${formula?` F="${escape(formula)}"`:''}/>`;
const cells = data => Object.entries(data).map(([name,value])=>cell(name,value)).join('');
const section = (name,body) => `<Section N="${name}">${body}</Section>`;
const row = (type,index,body) => `<Row IX="${index}"${type?` T="${type}"`:''}>${body}</Row>`;
const colors = value => /^#[a-f\d]{3}$/i.test(value) ? '#'+[...value.slice(1)].map(c=>c.repeat(2)).join('') : value;
const arrow = {arrow:1,triangle:22,'filled-arrow':4,diamond:11,'open-diamond':10,dot:20};
const links = entries => `${xml}<Relationships xmlns="${opc}/relationships">${entries.map(([type,target],index)=>
  `<Relationship Id="rId${index+1}" Type="${type}" Target="${target}"/>`).join('')}</Relationships>`;
const override = (part,type) => `<Override PartName="/${part}" ContentType="application/vnd.ms-visio.${type}+xml"/>`;
const fullBox = [[0,0],[1,0],[1,1],[0,1],[0,0]];

function geometry(points,{outline = true, fill = true}={}) {
  return `<Section N="Geometry" IX="0">${cells({NoFill:fill?0:1,NoLine:outline?0:1})}${
    points.map(([x,y],index)=>row(index?'RelLineTo':'RelMoveTo',index+1,cells({X:x,Y:y}))).join('')}</Section>`;
}
function styling(item) {
  const filled = item.fill && item.fill!=='none' && item.fillOpacity;
  const stroked = item.stroke && item.stroke!=='none' && item.strokeOpacity;
  return cells({FillPattern:filled?1:0,FillForegnd:filled?colors(item.fill):'#FFFFFF',
    FillForegndTrans:filled?1-item.fillOpacity:0,LinePattern:stroked?(item.dash?.length?2:1):0,
    LineColor:stroked?colors(item.stroke):'#000000',LineColorTrans:stroked?1-item.strokeOpacity:0,
    LineWeight:units(item.strokeWidth??1),Rounding:units(item.radius??0),
    BeginArrow:arrow[item.start]??0,EndArrow:arrow[item.end]??0});
}
function xform(item,frame) {
  const width = Math.max(item.width,0.01), height = Math.max(item.height,0.01);
  return cells({PinX:units(item.x-frame.x+width/2),PinY:units(frame.y+frame.height-item.y-height/2),
    Width:units(width),Height:units(height),LocPinX:units(width/2),LocPinY:units(height/2),Angle:-(item.angle??0)});
}

function page(scene, images) {
  const native = groupedShapes(scene.items), {groups} = native;
  const identifiers = new Map(), connects = [], relationships = [], pageImages = new Map();
  const ports = new Map();
  const bounds = {x:0,y:0,width:scene.width,height:scene.height};
  let serial=4;
  for (const item of native.items) {
    identifiers.set(item.id,serial++);
    for (const shape of item.items ?? []) identifiers.set(shape.id,serial++);
  }
  // Pre-compute exact connection-point rows so connectors can precede their
  // nodes in the drawing order while still having native Visio glue.
  const ends = new Map();
  for (const item of scene.items) if (item.source || item.target) {
    const connector = ['source','target'].map((end,index) => {
      const group = groups.get(item[end]);
      if (!group) return undefined;
      if (!ports.has(group.id)) ports.set(group.id,[]);
      const list = ports.get(group.id);
      const [x,y] = index ? item.points.at(-1) : item.points[0];
      const port = {id:identifiers.get(group.id),index:list.length};
      list.push({x:units(x-group.x),y:units(group.y+group.height-y)});
      return port;
    });
    ends.set(item.id,connector);
  }

  function shape(id,type,body) {
    return `<Shape ID="${id}" Type="${type}" LineStyle="0" FillStyle="0" TextStyle="0">${body}</Shape>`;
  }
  function render(item,frame) {
    const id = identifiers.get(item.id);
    if (item.kind==='group') {
      const pointRows = ports.get(item.id);
      if (item.items.length===1 && !item.key.startsWith('node:')) return render(item.items[0],frame);
      const connection = pointRows ? section('Connection',pointRows.map(({x,y},index)=>row('Connection',index,cells({X:x,Y:y,DirX:0,DirY:0,Type:0}))).join('')) : '';
      return shape(id,'Group',xform(item,frame)+connection+`<Shapes>${item.items.map(child=>render(child,item)).join('')}</Shapes>`);
    }
    if (item.kind==='image') {
      if (!images.has(item.data)) images.set(item.data,images.size+1);
      const key = images.get(item.data);
      if (!pageImages.has(key)) {
        relationships.push([`${rel}/image`,`../media/image${key}.png`]);
        pageImages.set(key,relationships.length);
      }
      return shape(id,'Foreign',xform(item,frame)+cells({ImgOffsetX:0,ImgOffsetY:0,ImgWidth:units(item.width),ImgHeight:units(item.height)})+
        `<ForeignData ForeignType="Bitmap" CompressionType="PNG"><Rel r:id="rId${pageImages.get(key)}"/></ForeignData>`);
    }
    if (item.kind==='text') {
      // Leave a small margin for Visio's native font metrics.
      const width=item.width*1.2+4;
      const x=item.x-(width-item.width)*(item.align==='center'?.5:item.align==='right'?1:0);
      const textStyle=cells({FillPattern:0,LinePattern:0,VerticalAlign:1,LeftMargin:0,RightMargin:0,TopMargin:0,BottomMargin:0})+
        section('Character',row(null,0,cells({Font:'Arial',Color:colors(item.color),Size:units(item.fontSize),Style:item.bold?1:0})))+
        section('Paragraph',row(null,0,cells({HorzAlign:{left:0,center:1,right:2}[item.align]})));
      return shape(id,'Shape',xform({...item,x,width},frame)+textStyle+`<Text><cp IX="0"/><pp IX="0"/>${escape(item.text)}</Text>`);
    }
    if (item.kind==='line') {
      if (ends.has(item.id)) {
        const start=item.points[0], finish=item.points.at(-1);
        const [begin,next] = ends.get(item.id);
        function endpoint(point,port,index) {
          const stem=index?'End':'Begin', target = port && `Connections.X${port.index+1}`;
          if (port) connects.push(`<Connect FromSheet="${id}" FromCell="${stem}X" FromPart="${index?12:9}" ToSheet="${port.id}" ToCell="${target}" ToPart="${100+port.index}"/>`);
          const ref = port && `Sheet.${port.id}!Connections.`;
          const formula = port && `PAR(PNT(${ref}X${port.index+1},${ref}Y${port.index+1}))`;
          return cell(stem+'X',units(point[0]-frame.x),formula)+cell(stem+'Y',units(frame.y+frame.height-point[1]),formula);
        }
        const dx=finish[0]-start[0], dy=start[1]-finish[1], length=Math.hypot(dx,dy);
        if (length>0) {
          const angle=Math.atan2(dy,dx), cos=Math.cos(angle), sin=Math.sin(angle);
          const connector = endpoint(start,begin,0)+endpoint(finish,next,1)+
            cell('PinX',units(start[0]-frame.x),'BeginX')+cell('PinY',units(frame.y+frame.height-start[1]),'BeginY')+
            cell('Width',units(length),'SQRT((EndX-BeginX)^2+(EndY-BeginY)^2)')+cell('Height',1)+cell('LocPinX',0)+cell('LocPinY',0)+
            cell('Angle',angle,'ATAN2(EndY-BeginY,EndX-BeginX)');
          const points=item.points.map(([x,y])=>[(cos*(x-start[0])+sin*(start[1]-y))/length,units(cos*(start[1]-y)-sin*(x-start[0]))]);
          return shape(id,'Shape',connector+styling(item)+geometry(points,{fill:false}));
        }
      }
      const box=boundsOf(item.points);
      const points=item.points.map(([x,y])=>[(x-box.x)/(box.width||1),(box.y+box.height-y)/(box.height||1)]);
      return shape(id,'Shape',xform(box,frame)+styling(item)+geometry(points));
    }
    const path = item.kind==='ellipse'
      ? `<Section N="Geometry" IX="0">${row('Ellipse',1,cells({X:units(item.width/2),Y:units(item.height/2),
          A:units(item.width),B:units(item.height/2),C:units(item.width/2),D:units(item.height)}))}</Section>`
      : geometry(fullBox);
    return shape(id,'Shape',xform(item,frame)+styling(item)+path);
  }
  const background = scene.background==='none'?'':shape(serial,'Shape',xform(bounds,bounds)+
    styling({fill:scene.background,fillOpacity:1})+geometry(fullBox,{outline:false}));
  const shapes = background+native.items.map(item=>render(item,bounds)).join('');
  return {content:`${xml}<PageContents ${ns}><Shapes>${shapes}</Shapes>${connects.length?'<Connects>'+connects.join('')+'</Connects>':''}</PageContents>`,
    relationships};
}

export function visioFile(scenes) {
  const pages = [], overrides = [], pageLinks = [], images = new Map();
  const document = `${xml}<VisioDocument ${ns}><FaceNames><FaceName NameU="Arial"/></FaceNames><StyleSheets><StyleSheet ID="0" NameU="No Style" Name="No Style">${cells({EnableLineProps:1,EnableFillProps:1,EnableTextProps:1})}</StyleSheet></StyleSheets><DocumentSheet LineStyle="0" FillStyle="0" TextStyle="0"/></VisioDocument>`;
  const entries = [['_rels/.rels',links([[`${visioRel}/document`,'visio/document.xml']])],
    ['visio/document.xml',document],['visio/_rels/document.xml.rels', links([[`${visioRel}/pages`,'pages/pages.xml']])]];
  for (const [index,scene] of scenes.entries()) {
    const name = `page${index+1}.xml`, part=`visio/pages/${name}`;
    const current = page(scene,images);
    entries.push([part,current.content]);
    if (current.relationships.length) entries.push([`visio/pages/_rels/${name}.rels`,links(current.relationships)]);
    overrides.push(override(part,'page'));
    pageLinks.push([`${visioRel}/page`,name]);
    pages.push(`<Page ID="${index}" Name="${escape(scene.title)}" NameU="Page-${index+1}"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">${cells({
      PageWidth:units(scene.width),PageHeight:units(scene.height),PageScale:1,DrawingScale:1})}</PageSheet><Rel r:id="rId${index+1}"/></Page>`);
  }
  entries.push(['visio/pages/pages.xml',`${xml}<Pages ${ns}>${pages.join('')}</Pages>`],
    ['visio/pages/_rels/pages.xml.rels',links(pageLinks)],
    ['[Content_Types].xml',`${xml}<Types xmlns="${opc}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/>${override('visio/document.xml','drawing.main')}${override('visio/pages/pages.xml','pages')}${overrides.join('')}</Types>`]);
  for (const [data,key] of images) entries.push([`visio/media/image${key}.png`,decodePNG(data)]);
  return zipEntries(entries);
}
