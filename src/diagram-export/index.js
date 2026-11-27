import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { ArchError } from '../errors.js';
import { drawioFile } from './drawio.js';
import { excalidrawFile } from './excalidraw.js';
import { imageBaker } from './images.js';
import { exportScene } from './scene.js';
import { visioFile } from './visio.js';

const formats = {
  svg:{extension:'svg',mimeType:'image/svg+xml;charset=utf-8'},
  drawio:{extension:'drawio',mimeType:'application/vnd.jgraph.mxfile',write:drawioFile},
  vsdx:{extension:'vsdx',mimeType:'application/vnd.ms-visio.drawing',write:visioFile},
  excalidraw:{extension:'excalidraw',mimeType:'application/json;charset=utf-8',write:excalidrawFile}
};
const parse = svg => new DOMParser().parseFromString(svg,'image/svg+xml');

export function svgImageEmbedder(options) {
  const {bake} = imageBaker(options);
  return async svg => {
    if (!svg.includes('<image')) return svg;
    const doc = parse(svg);
    await bake(doc.documentElement,false);
    return new XMLSerializer().serializeToString(doc);
  };
}

export async function diagramFile(graph, format, renderGraph, options) {
  if (!Object.hasOwn(formats,format)) throw new ArchError(`Unknown export format: ${format}`,{},'ARCH_DIAGRAM_EXPORT');
  const {extension,mimeType,write} = formats[format];
  let content = graph;
  while (content.content) content = content.content;
  const graphs = content.layouts ?? [content];
  const name = [graph.title,graphs.length===1 && graphs[0].view.id].filter(Boolean).join(' ')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'architecture';
  if (format==='svg') {
    const data = await svgImageEmbedder(options)(renderGraph(graph,options));
    return {name:`${name}.${extension}`,mimeType,data};
  }
  if (content.kind==='help') throw new ArchError('Choose a diagram view to export',{},'ARCH_DIAGRAM_EXPORT');
  const {bake} = imageBaker(options);
  const scenes = [];
  for (const view of graphs) {
    const root = parse(renderGraph(view,options)).documentElement;
    await bake(root,true);
    scenes.push(exportScene(view,root,{nativeOrthogonal:format==='drawio'}));
  }
  return {name:`${name}.${extension}`,mimeType,data:write(scenes)};
}
