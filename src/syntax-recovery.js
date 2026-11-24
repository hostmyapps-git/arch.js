import { ArchError } from './errors.js';
import { coordinateTerms } from './placement.js';
import { styleReferences } from './style-expressions.js';
import { routingReferences } from './via.js';
import { similarNames } from './spelling.js';
import { matches, matchesPair } from './profiles.js';
import { relationshipEndpointIssues } from './profile-validation.js';
import { profileHelp } from './diagnostic-help.js';
import { indexGraph } from './graph-index.js';

const architectureMembers = new Set(['model','view','config','description']);
const viewMembers = new Set(['embed','tree','route','style','place','row','column','extends','meta','diagram','routes','include','exclude','represents',
  'spacing','backgroundImage','showBackgroundImage','propertyFields','direction','theme','viewpoint','referenceDisplay','referenceOccurrences']);

export function startsMember(tokens, index, scope, complete = false) {
  const token = tokens[index];
  const next = tokens[index+1];
  if (scope === 'model' || scope === 'container') {
    const title = tokens[index+2];
    return token.type === 'word' && (token.value === 'relation' && (!complete || next?.type === 'word') ||
      next?.type === 'word' && (title?.type === 'string' ||
        !complete && next.line === token.line && (title?.type === 'invalid' || title?.line > token.line || title?.type === '}')));
  }
  if (token.type === 'directive') return true;
  if (token.type !== 'word' || !(scope === 'view' ? viewMembers : architectureMembers).has(token.value)) return false;
  return !complete || next?.line === token.line && !['eof', '}'].includes(next.type);
}

// Start from the original declaration, since the failed read may already have
// consumed part of the next declaration. Preserve the enclosing closing brace.
export function matchingBraces(tokens) {
  const pairs = new Map(), stack = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === '{') stack.push(i);
    if (tokens[i].type === '}' && stack.length) pairs.set(stack.pop(), i);
  }
  return pairs;
}

export function resumeAt(tokens, start, scope, parent, pairs) {
  const first=tokens[start];
  let depth=Number(first.type==='{'), closedBlock=false;
  const parentClose = token => token.line > first.line && token.column <= parent.column && token.column < first.column;
  for (let i=start+1; i<tokens.length; i++) {
    const token=tokens[i], newLine=token.line>first.line;
    if (token.type==='eof') return i;
    if (token.type==='}') {
      if (!depth || parentClose(token)) return i;
      if (--depth===0) closedBlock=true;
      continue;
    }
    if ((newLine || token.separator || closedBlock || first.type==='invalid') &&
      (!depth || token.column<=first.column) && startsMember(tokens,i,scope,Boolean(depth))) return i;
    if (token.type === '{') {
      const close = pairs.get(i);
      // A balanced declaration owns its contents. Indentation is a recovery
      // hint only when a broken block would otherwise consume its parent's }.
      if (close !== undefined && !parentClose(tokens[close])) {
        i = close;
        closedBlock = !depth;
      } else depth++;
    }
  }
  return tokens.length-1;
}

const statementsHelp = Object.freeze({
  route:'routing', routes:'routing', place:'routing', style:'styles',
  tree:'diagrams tree', diagram:'diagrams', relation:'model', config:'config',
});
const scopeHelp = {view:'views', model:'model', container:'model'};
export function recoveryDiagnostic(error, start, next, scope) {
  // A token at the next declaration or enclosing brace only revealed the
  // error. Point to the incomplete statement instead of that valid token.
  const beforeNext = error.line < next.line || error.line === next.line && error.column < next.column;
  const loc = beforeNext ? error : start;
  const topic = Object.hasOwn(statementsHelp, start.value) ? statementsHelp[start.value] : scopeHelp[scope] ?? 'syntax';
  return {severity:'error',code:'ARCH_SYNTAX',message:error.message.replace(/ \(line \d+, column \d+\)$/,''),
    line:loc.line,column:loc.column, help:error.help ?? `@help ${topic}`};
}

export function isTypeRecoveryDiagnostic({code}) {
  return code === 'ARCH_UNKNOWN_TYPE' || code === 'ARCH_MISSING_TYPE' || code === 'ARCH_RELATION_ENDPOINT_TYPE';
}

function relationshipCandidates(edge, nodes, profile, viewpoints) {
  const {nodeTypes, relationTypes} = profile;
  const source = nodes.get(edge.source)?.type;
  const target = nodes.get(edge.target)?.type;
  const direction = edge.direction ?? 'forward';
  const names = Object.keys(relationTypes).filter(name => {
    const rule = relationTypes[name];
    return !rule.abstract && (rule.directions ?? ['forward']).includes(direction) &&
      (rule.allowSelf || edge.source !== edge.target) &&
      (!source || matches(source, rule.from, nodeTypes)) &&
      (!target || matches(target, rule.to, nodeTypes)) &&
      (!rule.pairs || !source || !target || rule.pairs.some(pair => matchesPair(source, target, pair, nodeTypes))) &&
      viewpoints.every(viewpoint => matches(name, viewpoint.relations, relationTypes));
  });
  const spelling = edge.type ?? '';
  const close = spelling ? similarNames(spelling, names, 4, spelling.length < 5 ? 1 : 2,
    {allowPrefix: spelling.length >= 5}) : [];
  if (close.length) return close;
  return source && target ? names.sort().slice(0, 4) : [];
}

export function omitInvalidTypes(model, recovery) {
  const {profile} = model;
  const unknownNode = node => !Object.hasOwn(profile.nodeTypes, node.type);
  // Nodes are stored in declaration order, so an omitted container precedes
  // its descendants. Keep their IDs for the same dependency cleanup used by
  // parser recovery.
  if (model.nodes.some(unknownNode)) {
    const omitted = new Set(), messages = new Map();
    const nodeNames = Object.keys(profile.nodeTypes).filter(name => !profile.nodeTypes[name].abstract);
    model.nodes = model.nodes.filter(node => {
      if (!omitted.has(node.parent)) {
        if (!unknownNode(node)) return true;
        if (!messages.has(node.type)) {
          const candidates = similarNames(node.type, nodeNames, 3, node.type.length < 5 ? 1 : 2);
          const suggestion = candidates.length ? `. Did you mean ${candidates.join(' or ')}?` : '';
          messages.set(node.type, {candidates, message:`Unknown element type in profile ${profile.id}: ${node.type}${suggestion}`});
        }
        recovery.diagnostics.push({severity:'error', code:'ARCH_UNKNOWN_TYPE', ...messages.get(node.type),
          line:node.loc.line, column:node.loc.column, elementId:node.id, help:profileHelp(profile, 'types')});
      }
      omitted.add(node.id);
      recovery.droppedNodes.add(node.id);
      return false;
    });
  }
  if (!model.edges.length) return;
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  let candidateViews;
  const candidateViewpoints = id => {
    if (!candidateViews) {
      const graph = indexGraph(model);
      candidateViews = new Map();
      for (const view of model.views) {
        const viewpoint = profile.viewpoints[view.viewpoint];
        if (!viewpoint || view.extends || view.embeds || view.meta!==undefined) continue;
        for (const edge of graph.project(view,false).edges) {
          if (!candidateViews.has(edge.id)) candidateViews.set(edge.id,[]);
          candidateViews.get(edge.id).push(viewpoint);
        }
      }
    }
    return candidateViews.get(id) ?? [];
  };
  const edges = model.edges.filter(edge => {
    // A profile default has already been applied by bindModel.
    const type = edge.type, rule = profile.relationTypes[type];
    const source = nodes.get(edge.source), target = nodes.get(edge.target);
    const issues = rule && source && target
      ? relationshipEndpointIssues(edge.id, type, rule, source.type, target.type, profile.nodeTypes) : undefined;
    if (rule && !issues) return true;
    const loc = issues ? edge.loc : edge.attributeLocs?.type ?? edge.loc;
    const lacksType = type === undefined || type === '';
    const code = issues ? 'ARCH_RELATION_ENDPOINT_TYPE' : lacksType ? 'ARCH_MISSING_TYPE' : 'ARCH_UNKNOWN_TYPE';
    const message = issues ? issues.map(issue =>
      `${issue.message}.${issue.allowed?.length ? ` Allowed ${issue.side} types: ${issue.allowed.join(', ')}.` : ''}`).join(' ')
      : lacksType ? `Relationship ${edge.id} requires an explicit type. Set type in its relationship block using profile ${profile.id}.`
      : `Unknown relationship type in profile ${profile.id}: ${type}`;
    recovery.diagnostics.push({
      severity:'error', code, kind:'relationship', elementId:edge.id, message,
      line:loc.line, column:loc.column, candidates:relationshipCandidates(edge, nodes, profile,candidateViewpoints(edge.id)),
      help:profileHelp(profile, 'relations', issues ? type : undefined)
    });
    recovery.droppedEdges.add(edge.id);
    return false;
  });
  if (edges.length !== model.edges.length) model.edges = edges;
}

export function pruneDroppedDeclarations(model, {droppedNodes,droppedEdges,droppedViews}) {
  const removed = (dropped, complete) => {
    const kept=new Set(complete.map(item=>item.id));
    return new Set([...dropped].filter(id=>!kept.has(id)));
  };
  const missingNodes=removed(droppedNodes,model.nodes);
  const missingEdges=removed(droppedEdges,model.edges);
  if (!missingNodes.size && !missingEdges.size && !droppedViews.size) return;
  model.edges=model.edges.filter(edge=>{
    if (!missingNodes.has(edge.source)&&!missingNodes.has(edge.target)) return true;
    missingEdges.add(edge.id);
    return false;
  });
  if (missingNodes.size) {
    // Only profile-declared reference attributes can name omitted nodes.
    // A textual attribute may legitimately have the same value as an ID.
    for (const [items, types] of [[model.nodes, model.profile.nodeTypes], [model.edges, model.profile.relationTypes]]) {
      for (const item of items) {
        const attrs = types[item.type]?.attributes;
        for (const [key, value] of Object.entries(item.attributes ?? {})) {
          if (attrs?.[key]?.type !== 'reference') continue;
          if (Array.isArray(value)) {
            if (!value.some(id => missingNodes.has(id))) continue;
            const kept = value.filter(id => !missingNodes.has(id));
            if (kept.length) { item.attributes[key] = kept; continue; }
          } else if (!missingNodes.has(value)) continue;
          delete item.attributes[key];
          delete item.attributeLocs[key];
        }
      }
    }
  }
  const missingViews=removed(droppedViews,model.views);
  const keptNodes=new Set(model.nodes.map(node=>node.id));
  const nodeNames = [...model.nodes.map(({id}) => id), ...missingNodes];
  for (const view of model.views) {
    const unavailable = new Set(missingNodes);
    if (view.include && missingViews.size)
      view.include=view.include.filter(id=>!missingViews.has(id)||keptNodes.has(id));
    if (missingNodes.has(view.represents)) delete view.represents;
    if (missingViews.has(view.extends)) delete view.extends;
    for (const [id, spec] of Object.entries(view.embeds ?? {})) if (missingViews.has(spec.view)) {
      delete view.embeds[id];
      unavailable.add(id);
    }
    for (const [id, tree] of Object.entries(view.trees ?? {})) if (tree.nodes?.some(node => missingNodes.has(node))) {
      tree.nodes = tree.nodes.filter(node => !missingNodes.has(node));
      if (!tree.nodes.length) { delete view.trees[id]; unavailable.add(id); }
    }
    if (!unavailable.size && !missingEdges.size) continue;
    const missing=id=>unavailable.has(id)||missingEdges.has(id);
    const names = new Set([...nodeNames, ...Object.keys(view.trees ?? {}), ...Object.keys(view.embeds ?? {}), ...unavailable]);
    const refersToMissing = terms => terms.some(({ref}) => unavailable.has(ref));
    const routeUnavailable = route => unavailable.has(route.source) || unavailable.has(route.target) ||
      refersToMissing(routingReferences(route, names));
    for (const key of ['include','exclude']) if (view[key]) view[key]=view[key].filter(id=>!missing(id));
    for (const placements of [view.places, view.virtualPlaces ?? {}]) for (const [id, place] of Object.entries(placements)) {
      const inputs = place.relative ? [place.relative.gap, place.relative.align?.to] : [place.at.x, place.at.y];
      if (missing(id) || unavailable.has(place.relative?.of) ||
          inputs.some(value => typeof value === 'string' && refersToMissing(coordinateTerms(value, place.loc, names))))
        delete placements[id];
    }
    for (const [id, style] of Object.entries(view.styles)) if (missing(id) || refersToMissing(styleReferences(style, names))) delete view.styles[id];
    for (const [id, route] of Object.entries(view.routes)) if (missing(id) || routeUnavailable(route)) delete view.routes[id];
    if (view.routeDefaults && routeUnavailable(view.routeDefaults)) delete view.routeDefaults;
    if (view.referenceRoutes) view.referenceRoutes=view.referenceRoutes.filter(route=>!missing(route.nodeId)&&!missing(route.edgeId)&&!routeUnavailable(route));
  }
  const selection=model.config?.views;
  if (selection && selection!=='all') {
    const ids=(Array.isArray(selection)?selection:[selection]).filter(id=>!missingViews.has(id));
    if (!ids.length) delete model.config.views;
    else if (ids.length !== (Array.isArray(selection)?selection.length:1)) model.config.views=ids;
  }
}

const previewDiagnostics = new WeakMap();
const recoveryEnabled = new WeakSet();
export function enablePreviewRecovery(model) { recoveryEnabled.add(model); }
export function isPreviewRecoveryEnabled(model) { return recoveryEnabled.has(model); }
export function rememberSyntaxDiagnostics(model, {diagnostics, droppedNodes, droppedEdges}) {
  previewDiagnostics.set(model, {diagnostics, partialModel: Boolean(droppedNodes.size || droppedEdges.size)});
}
export function syntaxDiagnostics(model) { return previewDiagnostics.get(model)?.diagnostics ?? []; }
export function hasOmittedModelDeclarations(model) { return previewDiagnostics.get(model)?.partialModel ?? false; }

export function checkSyntaxRecovery(value, loc) {
  if (value !== undefined && typeof value !== 'boolean') throw new ArchError('syntaxRecovery must be true or false',loc,'ARCH_VALIDATION');
}
