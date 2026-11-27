import { boundsOf, solidPaint } from './scene.js';

const heads = {arrow:'arrow',triangle:'triangle_outline','filled-arrow':'triangle',diamond:'diamond','open-diamond':'diamond_outline',dot:'dot'};
const invisible = 'transparent';

export function excalidrawFile(scenes) {
  const elements = [], files = {};
  let pageY = 0;
  for (const [index,scene] of scenes.entries()) {
    const prefix = `page-${index+1}-`;
    const primary = new Map();
    const bound = new Map();
    const start = elements.length;
    const background = scene.background === 'none' ? '#ffffff' : scene.background;
    const elementId = item => prefix+item.id;
    for (const item of scene.items) {
      if (item.group?.startsWith('node:') && ['rectangle','ellipse'].includes(item.kind) && item.fill!=='none' && !primary.has(item.group))
        primary.set(item.group,item);
    }
    function base(item, kind, stroke = invisible, fill = invisible) {
      const seed = elements.length+1;
      return {id:elementId(item),type:kind,x:item.x,y:item.y+pageY,width:item.width,height:item.height,
        angle:item.angle??0,strokeColor:stroke,backgroundColor:fill,fillStyle:'solid',strokeWidth:item.strokeWidth??1,
        strokeStyle:item.dash?.length ? (item.dash[0]<=item.dash[1]/2?'dotted':'dashed') : 'solid',roughness:0,opacity:100,
        groupIds:item.group?[prefix+item.group]:[],frameId:null,roundness:null,seed,version:1,versionNonce:seed,
        isDeleted:false,boundElements:[],updated:1,link:null,locked:false,index:null};
    }
    function binding(key,[x,y], id) {
      const shape = primary.get(key);
      if (!shape) return null;
      const elementId = prefix+shape.id;
      if (!bound.has(elementId)) bound.set(elementId,new Set());
      bound.get(elementId).add(id);
      const fixedPoint = [(x-shape.x)/shape.width,(y-shape.y)/shape.height];
      return {elementId,fixedPoint,mode:'inside',focus:0,gap:1};
    }
    function add(item) {
      const fill = solidPaint(item.fill??'none',item.fillOpacity??1,background);
      const stroke = solidPaint(item.stroke??'none',item.strokeOpacity??1,background);
      const color = value => value === 'none' ? invisible : value;
      if (item.kind === 'image') {
        const fileId = elementId(item)+'-image';
        files[fileId] = {id:fileId,mimeType:'image/png',dataURL:item.data,created:1,lastRetrieved:1};
        elements.push({...base(item,'image'),fileId,status:'saved',scale:[1,1],crop:null});
      } else if (item.kind === 'text') {
        elements.push({...base(item,'text',item.color),text:item.text,originalText:item.text,
          fontSize:item.fontSize,fontFamily:2,baseFontSize:null,textAlign:item.align,verticalAlign:'top',
          containerId:null,autoResize:true,lineHeight:1.25});
      } else if (item.kind === 'line') {
        const origin = item.points[0], end = item.points.at(-1);
        const arrow = item.start || item.end || item.source || item.target;
        const box = boundsOf(item.points);
        const line = base({...item,...box,x:origin[0],y:origin[1]},arrow?'arrow':'line',color(stroke),color(fill));
        elements.push({...line,points:item.points.map(([x,y])=>[x-origin[0],y-origin[1]]),
          startArrowhead:heads[item.start]??null,endArrowhead:heads[item.end]??null,elbowed:false,
          polygon:!arrow && fill!=='none',
          startBinding:arrow?binding(item.source,origin,line.id):null,endBinding:arrow?binding(item.target,end,line.id):null});
      } else {
        const shape = base(item,item.kind,color(stroke),color(fill));
        if (item.radius) shape.roundness = {type:3,value:item.radius};
        elements.push(shape);
      }
    }
    if (scenes.length>1) {
      add({id:'paper',kind:'rectangle',x:0,y:0,width:scene.width,height:scene.height,fill:background});
      add({id:'title',kind:'text',text:scene.title,x:0,y:-27,width:scene.width,height:24,fontSize:18,align:'left',color:'#1e293b'});
    }
    for (const item of scene.items) add(item);
    for (let i=start;i<elements.length;i++) {
      const target = elements[i], arrows = bound.get(target.id);
      if (arrows) target.boundElements = [...arrows].map(id=>({type:'arrow',id}));
    }
    pageY += scene.height+72;
  }
  return JSON.stringify({type:'excalidraw',version:2,source:'https://excalidraw.com',elements,
    appState:{viewBackgroundColor:scenes.length===1 && scenes[0].background!=='none'?scenes[0].background:'#ffffff',gridSize:null},files},null,2);
}
