import { ArchError, errorDiagnostic } from './errors.js';
import { indexGraph } from './graph-index.js';
import { layoutView } from './geometry.js';
import { diagramMembership } from './diagrams.js';
import { isGridDiagram } from './diagram-types.js';
import { validatePreviewModel } from './model-validation.js';
import { bindPreviewModel } from './parser.js';
import { enablePreviewRecovery, isPreviewRecoveryEnabled, syntaxDiagnostics } from './syntax-recovery.js';
import { viewSourceProvider } from './view-source.js';

const location = loc => loc && {line:loc.line, column:loc.column, path:loc.path};
const diagnosticsFor = error => error.diagnostics ?? [errorDiagnostic(error)];

function synopsis(item, type, referenceAttributes) {
  const references = [];
  for (const attribute of referenceAttributes) {
    const value = item.attributes?.[attribute] ?? item[attribute];
    if (typeof value === 'string') references.push({attribute,id:value});
    else if (Array.isArray(value)) {
      for (const id of value) if (typeof id === 'string') references.push({attribute,id});
    }
  }
  return {
    id:item.id, title:item.title, type, description:item.description, attributes:item.attributes,
    parent:item.parent, source:item.source, target:item.target, direction:item.direction,
    stereotype:item.stereotype, technology:item.technology, references, location:location(item.loc)
  };
}

// Keep dependent views available if a different view prevents full-document
// validation. A malformed view must not prevent a presenter opening its peers.
function singleView(model, root, byId, order) {
  const selected = new Map(), pending = [root];
  while (pending.length) {
    const view = pending.pop();
    if (!view || selected.has(view.id)) continue;
    selected.set(view.id,view);
    if (view.extends) pending.push(byId.get(view.extends));
    for (const embed of Object.values(view.embeds ?? {})) pending.push(byId.get(embed.view));
  }
  // Most dependency closures are small. Sort only their members in authored
  // order instead of scanning the complete view catalogue for every retry.
  const views = order ? [...selected.values()].sort((a,b)=>order.get(a.id)-order.get(b.id)) :
    model.views.filter(view=>selected.has(view.id));
  const local = {...model, _viewCatalogue:byId, config:{...model.config, views:[root.id]},views};
  if (isPreviewRecoveryEnabled(model)) enablePreviewRecovery(local);
  return local;
}

export function prepareArchitecture(source, options = {}) {
  const settings = {...options,validation:options.validation ?? 'draft',
    syntaxRecovery:options.syntaxRecovery ?? (options.validation!=='strict')};
  const model = typeof source === 'string' || !Array.isArray(source?.views)
    ? bindPreviewModel(source,settings) : source;
  if (model.kind === 'help') throw new ArchError('The dashboard requires an architecture model');
  // Recovery subsets preserve the same nodes and relationships. Only
  // reuse model-wide checks within this report and for the same profile.
  const sharedChecks = new Map();
  let shared, sharedErrors = [];
  try { shared = validatePreviewModel(model,settings,model.profile,sharedChecks); }
  catch (error) {
    if (!(error instanceof ArchError)) throw error;
    sharedErrors = diagnosticsFor(error);
  }
  const authored = shared ? undefined : new Map(model.views.map(view => [view.id,view]));
  const order = authored?.size===model.views.length ? new Map(model.views.map((view,index) => [view.id,index])) : undefined;
  const documents = new Map();
  let rawGraph;
  const faults = new Map();
  const diagnostics = new Map();
  const identity = issue => [issue.code,issue.elementId,issue.line,issue.column,issue.path,issue.message];
  function add(issues) {
    for (const issue of issues) diagnostics.set(JSON.stringify([issue.viewId,...identity(issue)]),issue);
  }
  function addDocumentDiagnostics(document) {
    add(document.diagnostics);
    for (const issues of document.omittedByView?.values() ?? []) add(issues.map(issue => ({...issue,omitted:true})));
  }
  add(syntaxDiagnostics(model).map(issue => ({...issue,omitted:true})));
  if (shared) addDocumentDiagnostics(shared);
  const views = model.views.map(raw => {
    let document = shared;
    if (!document) {
      const local = singleView(model,raw,authored,order);
      try { document = validatePreviewModel(local,settings,model.profile,sharedChecks); }
      catch (error) {
        if (!(error instanceof ArchError)) throw error;
        const issues = diagnosticsFor(error).map(issue =>
          issue.viewId || issue.elementId ? issue : {...issue,viewId:raw.id});
        faults.set(raw.id,{message:error.message, diagnostics:issues});
        add(issues);
      }
      if (document) {
        documents.set(raw.id,document);
        addDocumentDiagnostics(document);
      }
    }
    const view = document?.views.get(raw.id) ?? raw;
    const graph = document?.graph ?? (rawGraph ??= indexGraph(model));
    const semantic = view.meta === undefined ? graph.project(view,false) : {nodes:[],edges:[]};
    const projected = view.meta === undefined ? graph.project(view) : {nodes:[],edges:[]};
    const display = document ? diagramMembership(document.profile,view,projected,semantic) : projected;
    return {
      id:view.id, title:view.title, viewpoint:view.viewpoint, diagram:view.meta === undefined ? view.diagram?.type ?? 'connected' : 'source',
      ...(isGridDiagram(view.diagram?.type,document?.profile ?? model.profile) ? {grid:true} : {}),
      represents:view.represents, extends:raw.extends, embeds:Object.values(view.embeds ?? {}).map(embed => embed.view),
      elements:semantic.nodes.map(node => node.id), relationships:semantic.edges.map(edge => edge.id),
      visibleElements:display.nodes.map(node => node.id), visibleRelationships:display.edges.map(edge => edge.id),
      location:location(raw.loc), ...(faults.has(raw.id) ? {error:faults.get(raw.id).message} : {})
    };
  });
  if (sharedErrors.length) {
    const explained = new Set([...diagnostics.values()].map(issue => JSON.stringify(identity(issue))));
    add(sharedErrors.filter(issue => !explained.has(JSON.stringify(identity(issue)))));
  }
  const profile = shared?.profile ?? documents.values().next().value?.profile ?? model.profile;
  const relationType = edge => edge.type ?? profile?.defaultRelation;
  const configured = model.config?.views;
  const viewCatalogue = shared ? undefined : model.views.map(view => documents.get(view.id)?.views.get(view.id) ?? view);
  const referenceAttributes = new Map();
  function attributesOf(rule) {
    let attributes = referenceAttributes.get(rule);
    if (!attributes) {
      attributes = Object.entries(rule?.attributes ?? {}).filter(([,schema])=>schema.type==='reference').map(([name])=>name);
      referenceAttributes.set(rule,attributes);
    }
    return attributes;
  }
  const report = {
    title:model.title, description:model.description, profile:profile && {id:profile.id,version:profile.version},
    initialView: Array.isArray(configured) ? configured[0] : configured==='all' ? undefined : configured,
    views, diagnostics:[...diagnostics.values()],
    elements:model.nodes.map(node => synopsis(node,node.type,attributesOf(profile?.nodeTypes[node.type]))),
    relationships:model.edges.map(edge => {
      const type = relationType(edge);
      return synopsis(edge,type,attributesOf(profile?.relationTypes[type]));
    })
  };
  let getSource;
  return {
    report, profile, model,
    viewSource(id, format) {
      getSource ??= viewSourceProvider(model,report);
      return getSource(id,format);
    },
    layout(id) {
      const document = shared?.views.has(id) ? shared : documents.get(id);
      if (!document) {
        const fault = faults.get(id);
        throw new ArchError(fault?.message ?? `Unknown view: ${id}`);
      }
      return layoutView(viewCatalogue ? {...document,viewCatalogue} : document,id);
    }
  };
}
