import { ArchError } from './errors.js';
import { getIconPacks, getIconNames } from './icons.js';
import { getProfiles, registeredProfile, getProfileVersions, resolveProfile, concreteSubtypes, typeConnections, TEMPLATES, EDGE_STYLES, NODE_PROPERTIES, EDGE_PROPERTIES } from './profiles.js';
import { DIAGRAMS, DIAGRAM_OPTIONS } from './diagrams.js';
import { GRID_OPTIONS } from './diagram-types.js';
import { CSS3_COLORS } from './css3-colors.js';
import { escape } from './svg-values.js';
import { codePalette, sourceTokens } from './source-highlight.js';
import { throughDescription } from './connection-rules.js';

import { topics, syntax, request, parseHelpCommand, helpDocument, queryFor, helpHref } from './help-syntax.js';

const fail = message => { throw new ArchError(message, {}, 'ARCH_HELP'); };
const list = values => values?.length ? values.join(', ') : '(none)';
const pageSize = 100;
const typeCount = definitions => `${Object.values(definitions).filter(rule => !rule.aliasOf).length}${Object.values(definitions).some(rule => rule.aliasOf) ? ` (+${Object.values(definitions).filter(rule => rule.aliasOf).length} aliases)` : ''}`;
const lexical = (a,b) => {
  const left=a.toLowerCase(), right=b.toLowerCase();
  return left<right?-1:left>right?1:a<b?-1:a>b?1:0;
};
const sorted = values => [...values].sort(lexical);
const entriesByName = object => Object.entries(object).sort(([a],[b])=>lexical(a,b));
const definitionIndexes = new WeakMap();

function definitionIndex(definitions) {
  let index = definitionIndexes.get(definitions);
  if (!index) {
    const entries = entriesByName(definitions), aliases = new Map();
    for (const [name,rule] of entries) {
      if (!rule.aliasOf) continue;
      let names = aliases.get(rule.aliasOf);
      if (!names) aliases.set(rule.aliasOf,names = []);
      names.push(name);
    }
    index = {entries,aliases};
    // Compiled definitions are immutable. Offline export reuses this index
    // when it generates a separate help page for each referenced type.
    if (Object.isFrozen(definitions)) definitionIndexes.set(definitions,index);
  }
  return index;
}

function parseHelp(source, options = {}) {
  return { ...helpDocument(parseHelpCommand(source)), profile: resolveProfile({}, options) };
}

export function helpContent(model, options = {}) {
  if (!model || model.kind !== 'help' || !model.help || typeof model.help.topic !== 'string' || !Array.isArray(model.help.parameters)) fail('Invalid help document; use parse("@help").');
  const { topic, parameters: args } = request(model.help?.topic, model.help?.parameters);
  const profile = resolveProfile(model, options), sections = [];
  const section = (title, ...lines) => sections.push({ title, lines: lines.flat() });
  const codeSection = (title, format, ...lines) => sections.push({title,lines,format});
  const jsonSection = (title, value) => sections.push({title,lines:JSON.stringify(value,null,2).split('\n'),format:'json'});
  const linked = (title, entries) => sections.push({title,lines:entries.map(({text})=>text),links:entries.map(({links})=>links)});
  const link = (text,query,length=[...text].length) => ({text,links:[{start:0,end:length,query}]});
  const namedList = (label, values, query) => {
    let text = label, position = [...label].length;
    const links = [];
    for (const [index,value] of sorted(values).entries()) {
      text += (index?', ':'')+value;
      if (index) position+=2;
      const end=position+[...value].length;
      if(value!=='*')links.push({start:position,end,query:query(value)});
      position=end;
    }
    return {text:!values?.length?label+'(none)':text,links};
  };
  const combine = (...entries) => {
    let text='';
    const links=[];
    for (const entry of entries) {
      if (typeof entry==='string') { text+=entry; continue; }
      const offset=[...text].length;
      for (const {start,end,query} of entry.links) links.push({start:start+offset,end:end+offset,query});
      text+=entry.text;
    }
    return {text,links};
  };
  const selectProfile = () => args[0] && args[0] !== '.' ? registeredProfile(args[0]) : profile;
  const definitions = (key, label) => {
    const p = selectProfile(), {entries,aliases} = definitionIndex(p[key]);
    const target = args[0] || '.';
    section(`Profile ${p.id} · ${p.version}`, `Usage: ${syntax(topic)}`, `Without PROFILE, use the selected document/API profile (default: default). ${entries.length} ${label}.`);
    if (args[1]) {
      const rule = p[key][args[1]];
      if (!Object.hasOwn(p[key], args[1])) fail(`Unknown name in ${label}: ${args[1]}. Use @help ${topic} ${target}.`);
      section(rule.title ?? args[1], rule.description ?? []);
      if (key === 'viewpoints') {
        const content = (nodes,relations) => [
          namedList('Element types: ',nodes,name=>queryFor('types',target,name)),
          namedList('Relationship types: ',relations,name=>queryFor('relations',target,name))
        ];
        linked('Required model contents',[
          ...content(rule.requiredNodes,rule.requiredRelations),
          ...(rule.requiredNodeGroups ?? []).map(types => namedList('At least one element: ',types,name=>queryFor('types',target,name))),
          ...(rule.requiredRelationGroups ?? []).map(group => {
            const types=Array.isArray(group)?group:group.types;
            const line=namedList('At least one relationship: ',types,name=>queryFor('relations',target,name));
            if (!Array.isArray(group)) line.text+=` · ${group.from.join(' or ')} → ${group.to.join(' or ')}`;
            return line;
          })
        ]);
        linked('Allowed model contents',content(rule.nodes,rule.relations));
        if (rule.connections?.length) section('Connection rules', rule.connections.map(check => {
          const limit = check.visibility ? `${check.visibility} show` : `${check.min}–${check.max ?? '∞'} ${check.direction}`;
          const counterpart = check.counterparts?.length ? ` · counterpart: ${list(check.counterparts)}` : '';
          const attributes = check.referenceAttributes ?? check.referencedByAttributes;
          const through = check.through ? ` · directly or through ${throughDescription(check.through)}` : '';
          return `${list(check.nodes)}  —  ${limit} · ${list(check.relations)}${counterpart}${attributes ? ` · reference: ${list(attributes)}` : ''}${through}`;
        }));
        if (rule.representations?.length) section('Representation', rule.representations);
        if (rule.objectifications?.length) section('Objectified relationships', rule.objectifications.map(check => {
          const legacy = check.allowLegacy ? ' · typed source and target references are also accepted' : '';
          const payload = check.payload ? ` · payload through ${check.payload.attribute} or ${list(check.payload.relations)}` : '';
          return `${list(check.relations)}  —  bind ${list(check.nodes)} with ${check.attribute}${legacy}${payload}`;
        }));
      } else {
        if (key === 'nodeTypes') section('Allowed relationships', `@help connections ${target} ${args[1]}`);
        else {
          const typeList = values => namedList('',values,name=>queryFor('types',target,name));
          const endpoints = (rule.pairs?.length?rule.pairs:[rule]).map(pair => combine(
            typeList(pair.from),' → ',typeList(pair.to),
            pair.fromExclude?.length?combine(' · exclude source ',typeList(pair.fromExclude)):'',
            pair.toExclude?.length?combine(' · exclude target ',typeList(pair.toExclude)):''
          ));
          linked('Endpoints and direction',[...endpoints,{text:`Directions: ${(rule.directions ?? ['forward']).join(', ')}`}]);
        }
        if (Object.keys(rule.attributes).length) section('Attributes', entriesByName(rule.attributes).map(([name, attr]) =>
          `${name}  —  ${attr.type}${attr.many ? ' list' : ''}${attr.required ? ' · required' : ''}${attr.targets?.length ? ` · ${list(attr.targets)}` : ''}${attr.enum?.length ? ` · ${list(attr.enum)}` : ''}`));
      }
      if (key !== 'viewpoints') {
        const canonical = rule.aliasOf ?? args[1];
        linked('Type identity', [
          namedList('Canonical type: ',[canonical],name=>queryFor(topic,target,name)),
          namedList('Aliases: ',aliases.get(canonical) ?? [],name=>queryFor(topic,target,name)),
          {text:'Aliases share semantic rules. Written type names remain in diagrams and source translations.'}
        ]);
        if (rule.aliasOf && typeof p.aliases?.[key]?.[args[1]] === 'object') jsonSection('Alias documentation', p.aliases[key][args[1]]);
      }
      if (key !== 'viewpoints' && rule.abstract) {
        const candidates = concreteSubtypes(args[1], p[key]);
        if (candidates.length) linked('Concrete subtypes', sorted(candidates).map(name => {
          const text=key==='nodeTypes'?`${name} ID "Title"  · template ${p[key][name].template}`:`relation ID SOURCE -> TARGET "Label" { type ${name} }`;
          const start=text.indexOf(name);
          return {text,links:[{start,end:start+name.length,query:queryFor(topic,target,name)}]};
        }));
        else section('Concrete subtypes','No concrete subtypes are defined in this profile.');
        section('Candidate details', `@help ${topic} ${target} NAME`, 'These candidates are concrete descendants. Attribute, container, endpoint and viewpoint rules still apply.');
      }
      if (rule.limitations?.length) section('Modeling notes', rule.limitations);
      if (rule.sources?.length) section('Sources', rule.sources);
      jsonSection('Profile definition (JSON)', rule);
      if (key !== 'viewpoints') section('Built-in attributes', key === 'nodeTypes' ? list(NODE_PROPERTIES) : list(EDGE_PROPERTIES), 'Additional attributes and constraints are listed above under attributes.');
    } else {
      if (entries.length) linked(label, entries.map(([name, rule]) => link(key === 'nodeTypes'
        ? `${name}${rule.aliasOf ? ` [alias of ${rule.aliasOf}]` : ''}${rule.abstract ? ' [abstract]' : ''} · template ${rule.template}${rule.container ? ' · container' : ''}`
        : key === 'relationTypes' ? `${name}${rule.aliasOf ? ` [alias of ${rule.aliasOf}]` : ''}${rule.abstract ? ' [abstract]' : ''} · style ${rule.style} · directions ${(rule.directions??['forward']).join(', ')}` : `${name}${rule.title ? ` · ${rule.title}` : ''}`,
        queryFor(topic,target,name),name.length)));
      else section(label,'(none)');
      section('Show details', `@help ${topic} ${target} NAME`, 'Use . as PROFILE to inspect the selected document/API profile, including inline definitions.', 'Abstract types support inheritance and cannot be instantiated directly.');
      if (key === 'relationTypes') section('Filter by node type', `@help connections ${target} NODE_TYPE`);
    }
  };

  if (!topic) {
    section('Getting started', 'Write one help command in an arch code block, either on its own or on a separate line inside architecture.',
      'Inside architecture, help replaces the diagram output. The model block is optional in help mode.',
      'Square brackets in this reference indicate optional parameters. Names are case-sensitive.', `Selected profile: ${profile.id} · ${profile.version}`);
    linked('Topics', entriesByName(topics).map(([key,[description]]) => link(`${syntax(key)}  —  ${description}`,key,[...syntax(key)].length)));
    section('Examples', '@help iconpacks', '@help iconpacks core', '@help profiles', '@help types default service', '@help connections default service', '@help diagrams sequence');
  } else if (topic === 'meta') {
    section('Architecture source views', 'Add view source "Architecture as JSON" { @meta json } or use @meta dsl.',
      'Equivalent JSON view: { "name": "Architecture as JSON", "@meta": "json" }. The meta keyword/field is also accepted.',
      'With config { views all }, diagram and source views render together in one SVG, in the selected order.',
      'An architecture-level @meta json or @meta dsl adds a selectable view named meta-json or meta-dsl.',
      'Source views show the entire normalized architecture, including their own directives exactly once. No recursive rendering.',
      'Source views support format, theme and backgroundColor. Filters, viewpoints, diagram settings and node/route styles do not apply.',
      'Model rules and other views are still validated. Meta views do not require domain viewpoints.',
      '@meta requires architecture source; a context-free standalone @meta command cannot translate an absent model.');
    section('Meta view', 'In the editor View menu, choose Meta view · JSON for DSL input or Meta view · DSL for JSON input.',
      'The translation updates while editing. Copy or download the translated source; SVG export is available in diagram views.',
      'Syntax errors show a source excerpt, original line/column, JSON pointer where available, and correction candidates.',
      'Use the line button to focus the source editor at the error. Corrections are suggestions and are never applied automatically.',
      'Syntactically readable models still show their translation when profile rules fail. Abstract-type candidates come from the selected profile.');
    section('JavaScript API', 'arch.translate(source, { format: "json" | "dsl" }) → source string',
      'format defaults to the other source notation. Translation checks syntax and structure, not profile completeness.',
      'arch.inspectSource(source, { profile, format }) → { sourceFormat, targetFormat, output, valid, diagnostics, ... }',
      'diagnostics[].candidates → { label, example, detail }[]; source line/column and path are retained.',
      'output is null for untranslatable syntax. Semantic issues can coexist with a translated output.',
      'Inspection validates the model but does not perform an SVG render; icon/path rendering errors can still occur later.');
    section('Boundaries', 'Conversion normalizes formatting and explicit defaults. Comments and original whitespace are not retained.',
      'Nested nodes, routes, reference connectors, profiles and all diagram settings retain their meaning.',
      'Unknown words are ranked by spelling; concrete candidates use the profile. Every proposed correction still requires review.',
      'The editor-only Meta view option is separate from declared @meta views. Only declared source views are included by config.views all.');
  } else if (topic === 'json') {
    section('Equivalent JSON input', 'Use a JSON string or an object with an architecture wrapper in parse, validate, layout, render or renderToString.',
      'The same profiles, model rules, views, layout and SVG renderers apply. JSON is a source format, not the internal parsed model.',
      'Use an arch Markdown fence or data-arch for JSON diagrams. Ordinary json fences remain code.');
    codeSection('Complete example', 'json', '{ "architecture": {', '  "name": "Portal",', '  "config": { "views": "all" },',
      '  "model": {', '    "elements": {', '      "user": { "type": "person", "name": "User" },', '      "api": { "type": "service", "name": "API" }', '    },',
      '    "relations": { "calls": { "from": "user", "to": "api", "name": "Calls" } }', '  },',
      '  "views": { "overview": { "name": "Overview", "routes": { "curve": "straight" } } }', '} }');
    section('Mapping', 'Architecture, element, relationship and view titles use name. Object keys are IDs.',
      'elements, relations and views may alternatively be arrays with an id in each entry; arrays define explicit order.',
      'Packages nest elements and relations inside the container element. All identifiers and model limits remain unchanged.',
      'Model properties such as description, technology and conveyed are direct fields. An attributes object handles custom names that collide with JSON structure.',
      'place: { ID: { at: [x,y], size: [width,height] } }; style: { ID: { ... } }.',
      'Coordinate expressions are strings in at, from/to, via and label pairs, for example "from": ["source.right", "target.centerY"]. The size pair uses numeric values.',
      'routes: { ... } defines shared defaults; route: { RELATION_ID: { ... } } overrides individual fields.',
      'Reference route key: "ELEMENT_ID -> RELATION_ID". via is [[x,y],[x,y]], label is [x,y] or "none".',
      'diagram: { type: "sequence", participants: ["user","api"] }; include/exclude use ID arrays.',
      'tree: { hierarchy: { nodes: ["phase","vision","goal"], direction: "up" } } defines named layout groups in a connected view.',
      'Inline config uses type, relation, viewpoint, styleGroup and attribute objects keyed by name, matching DSL keywords.',
      'Help: { "@help": "json" } or architecture-level "@help": "profiles". A help query omits the @help prefix.');
    section('Diagnostics and boundaries', 'Strict JSON: no comments, trailing commas, duplicate keys, null attribute values or executable values.',
      'JSON errors report a JSON pointer and source line/column. Object input locations refer to its compact JSON serialization.',
      'Field order follows the input; use arrays or config.views for explicit view order. Unknown settings are errors.',
      'Source JSON and parsed model JSON are different shapes. Use @help meta for translation, source downloads and correction candidates.');
  } else if (topic === 'syntax') {
    section('Basic rules', 'A diagram document contains architecture "Title" { ... } with exactly one model block.',
      'Identifiers: [A-Za-z_][A-Za-z0-9_.-]*. Use double-quoted text with JSON escapes.',
      'Comments start with # or //. Whitespace and semicolons separate statements.',
      'Attribute value lists: ["A", "B"]. include/exclude, tree nodes and propertyFields accept a, b or [a, b]; a single entry also becomes a list. Empty lists require []. Routing lists retain their own syntax.');
    codeSection('Complete starter example (default profile)', 'dsl', 'architecture "Portal" {', '  model {', '    person user "User"', '    application app "Portal"', '    relation uses user -> app "Uses" { type flow }', '  }', '  view overview "Overview" { direction right theme light }', '}');
    section('Bidirectional syntax', 'relation exchange a <-> b "Exchange"', 'The selected relationship type must allow direction both. Details: @help model and @help relations . TYPE.');
    section('Learn more', '@help model', '@help views', '@help config', '@help json');
  } else if (topic === 'model') {
    section('Elements and relationships', 'TYPE ID "Title" { ATTRIBUTE VALUE ... }', 'relation ID SOURCE -> TARGET "Label" { type RELATION ... }',
      `Selected profile: ${profile.id}. Node types: @help types. Relationship types: @help relations.`, `Default relationship type: ${profile.defaultRelation ?? '(none; set type explicitly)'}`);
    section('Bidirectional relationships', 'relation exchange a <-> b "Exchange" { type flow }',
      'One relationship ID, label and shared attributes/references, with arrowheads at both ends. JSON uses direction: "both"; direction: "forward" is the default.',
      'The relationship profile rule must allow directions [forward, both] (or [both] to require it). Custom rules default to [forward]; inherited rules retain their directions.',
      'from/to and pairs describe the written endpoint roles. Both endpoints count once as incoming and outgoing. A bidirectional link creates a directed cycle, so acyclic rules reject it.',
      'Connected/class views draw both arrowheads; matrices count the relationship in both directions. Sequence, state, activity and timeline views require separate directed relationships.',
      'Default flow, dependency, association and access types allow both; composition, generalization and realization remain forward-only. Inspect @help relations . TYPE.');
    section('Built-in attributes', `Nodes: ${list(NODE_PROPERTIES)}`, `Relationships: ${list(EDGE_PROPERTIES)}; also type to select the relationship type.`,
      'Built-in attributes are scalar strings; additional attributes must be defined in the profile.',
      'stereotype is a label; TYPE determines the semantic type.', 'icon uses PACK.NAME, for example core.service. tags is a string.');
    section('Carried information', 'Profiles can configure relationship referenceLabels, for example conveyed → Conveys.', 'Connected views support referenceDisplay labels | nodes | both. referenceOccurrences shared (default) reuses one card across edges; perEdge repeats cards with visible element IDs. Graphical cards point to the carrying edge and reuse the original node styles; these connectors are visual annotations, not model relationships.');
    section('Draft validation', 'config { validation draft }',
      'Default: validation strict. Draft mode renders incomplete profiles and appends validation notices below the diagram, including SVG exports.',
      'In the live diagram, click an element or relationship, or focus it and press Enter, to inspect model properties, final geometry, styles, route settings and source formulas. Validation notices for the element appear in the same popover. Press Escape to close it.',
      'Warnings: missing required attributes/viewpoints, missing required viewpoint types/relationships, and unmet minimum incoming/outgoing/connection counts.',
      'Abstract types, invalid values/references, maximum counts, cycles, and structural/renderer errors still block rendering. Unknown types block rendering when syntaxRecovery is off. API validation: "draft" | "strict" overrides config.',
      'validate() returns valid: true, conformant: false and warning diagnostics for an incomplete draft. Use validation: "strict" for a conformance check.');
    section('Partial preview', 'config { syntaxRecovery true }',
      'The Studio recovers from localized DSL errors while you type. A valid declaration before or after a broken one can still render. The red Syntax errors panel identifies the source line and column.',
      'Unknown element and relationship types are skipped in this preview and reported with spelling suggestions from the active profile.',
      'Relationship suggestions are filtered by the endpoint types and arrow direction. A misspelled prefix such as Conveyes can match a longer name.',
      'A relationship whose source or target types violate the profile is skipped in the partial preview, with an explanation in Type errors.',
      'A relationship that needs an explicit type is skipped until its type is provided. A profile default still applies when available.',
      'Relationships disallowed by a viewpoint are omitted from that view in this preview. The Viewpoint errors panel suggests a view-local exclusion.',
      'When model declarations are skipped, incomplete profile requirements appear as Draft notices while the preview is partial.',
      'Syntax recovery and draft validation are independent. See @help api.');
    section('Containers', 'package platform "Platform" { service api "API" }', 'Only container types in the selected profile support nesting.', 'IDs are document-wide. Relationships reference element IDs.');
  } else if (topic === 'profiles') {
    if (!args.length) linked('Registered profiles', sorted(getProfiles()).map(id => {
      const p = registeredProfile(id);
      return link(`${id} · ${p.version} · ${typeCount(p.nodeTypes)} node types · ${typeCount(p.relationTypes)} relationship types · ${Object.keys(p.viewpoints).length} viewpoints`,queryFor('profiles',id),id.length);
    }));
    else {
      const p = registeredProfile(args[0]);
      section(p.title, `ID: ${p.id}`, `Version: ${p.version}`, `Default relationship type: ${p.defaultRelation ?? '(none)'}`, `Viewpoint required: ${p.requireViewpoint ? 'yes' : 'no'}`,
        `Node types: ${typeCount(p.nodeTypes)}; relationship types: ${typeCount(p.relationTypes)}; viewpoints: ${Object.keys(p.viewpoints).length}.`);
      if (p.description) section('Scope', p.description);
      if (p.sources?.length) section('Sources', p.sources);
      if (p.limitations?.length) section('Limits of validation', p.limitations);
      linked('Available revisions',sorted(getProfileVersions(p.id)).map(version=>{
        const revision=`${p.id}@${version}`;
        return link(revision,queryFor('profiles',revision));
      }));
      section('Contents and rules', `@help types ${args[0]}`, `@help relations ${args[0]}`, `@help viewpoints ${args[0]}`, `@help aliases ${args[0]}`, `@help mappings ${args[0]}`);
      section('Style groups', Object.entries(p.styleGroups).map(([name, rule]) => `${name}: ${rule.backgroundColor ?? '(neutral)'}`));
    }
    section('Selection and registration', 'config { profile PROFILE }  // inside architecture', 'API options.profile takes precedence over the document profile.',
      'Use a quoted PROFILE@VERSION to pin a registered revision: config { profile "naf41-uaf@4.1.0-arch.16" }.',
      'Help lists registered profiles; it does not load files. Unqualified IDs select the most recently registered revision.', '@help config');
  } else if (topic === 'aliases') {
    const p = selectProfile();
    section(`Profile ${p.id} · ${p.version}`, 'Aliases resolve before semantic validation, including endpoints, references, inheritance and viewpoint selectors. Original names remain in model source and diagram labels.');
    for (const [kind, label] of [['nodeTypes', 'Node aliases'], ['relationTypes', 'Relationship aliases']]) {
      const lines = entriesByName(p.aliases?.[kind] ?? {}).flatMap(([name, raw]) => [
        `${name} -> ${p[kind][name].aliasOf}${typeof raw === 'object' && raw.target !== p[kind][name].aliasOf ? ` (via ${raw.target})` : ''}`,
        ...(typeof raw === 'object' ? [raw.description, ...(raw.sources ?? []), ...(raw.limitations ?? [])].filter(Boolean) : [])]);
      section(label, lines.length ? lines : ['(none)']);
    }
    section('Definition', 'External JSON profile: aliases: { nodeTypes: { Service: "ServiceSpecification" }, relationTypes: {} }',
      'A target may be another alias. Cycles, unknown targets and collisions with types are rejected. Aliases cannot override semantic or drawing rules.',
      'Inline DSL profile declarations do not define aliases; register an external JSON profile.');
  } else if (topic === 'mappings') {
    const p = selectProfile();
    section(`Profile ${p.id} · ${p.version}`, 'Mappings are descriptive, versioned metamodel correspondences. They do not convert models or equate types automatically. Only explicit aliases share semantic identity.');
    for (const mapping of p.mappings ?? []) section(`${mapping.kind} · ${mapping.relationship}`,
      `${mapping.source.framework}@${mapping.source.version}.${mapping.source.type} -> ${mapping.target.framework}@${mapping.target.version}.${mapping.target.type}`,
      mapping.description ?? '', ...(mapping.sources ?? []), ...(mapping.limitations ?? []));
    if (!p.mappings?.length) section('Mappings', '(none)');
    section('Relationship kinds', 'rename · equivalent · specialization · partial', 'A rename between metamodel versions does not establish equivalence of every inherited property, endpoint or constraint.');
  } else if (topic === 'types') definitions('nodeTypes', 'node types');
  else if (topic === 'relations') definitions('relationTypes', 'relationship types');
  else if (topic === 'viewpoints') definitions('viewpoints', 'viewpoints');
  else if (topic === 'connections') {
    const p = selectProfile(), target = args[0] || '.';
    section(`Profile ${p.id} · ${p.version}`, `Usage: ${syntax(topic)}`, 'Use . as PROFILE for the selected document/API profile, including inline definitions.');
    if (!args[1]) {
      section('Choose a node type', `@help connections ${target} NODE_TYPE`);
      linked('Available node types',[namedList('',Object.keys(p.nodeTypes),name=>queryFor('connections',target,name))]);
    }
    else {
      if (!Object.hasOwn(p.nodeTypes, args[1])) fail(`Unknown node type: ${args[1]}. Use @help types ${target}.`);
      const connections = typeConnections(args[1], p);
      section('Selected node type', `${connections.type}${connections.abstract ? ' [abstract; choose a concrete subtype to instantiate]' : ''}`,
        'The lists include concrete relationship types and concrete counterpart node types, accounting for inheritance and pair exclusions.',
        'Source/target lists describe the written from/to roles. A type allowing both also permits reverse flow on that same relationship.');
      linked('Relationship overview', ['outgoing','incoming'].map(direction=>
        namedList(direction[0].toUpperCase()+direction.slice(1)+': ',connections[direction].map(item=>item.type),name=>queryFor('relations',target,name))));
      for (const direction of ['outgoing', 'incoming']) {
        const lines = [...connections[direction]].sort((a,b)=>lexical(a.type,b.type)).flatMap(item => {
          const counterparts = list(sorted(item.counterparts));
          const text = direction === 'outgoing' ? `${item.type}: ${connections.type} -> ${counterparts}` : `${item.type}: ${counterparts} -> ${connections.type}`;
          return [
            link(text,queryFor('relations',target,item.type),item.type.length),
            {text:`  allowSelf: ${item.allowSelf}; acyclic: ${item.acyclic}; directions: ${item.directions.join(', ')}; details: @help relations ${target} ${item.type}`}
          ];
        });
        linked(direction === 'outgoing' ? 'Outgoing relationships (this type is the source)' : 'Incoming relationships (this type is the target)', lines.length ? lines : [{text:'(none)'}]);
      }
      section('Model example', 'relation LINK_ID SOURCE_ID -> TARGET_ID "Label" { type RELATION_TYPE }',
        'These lists describe endpoint type compatibility. Required attributes, self-links, cardinalities, cycles, containers and viewpoint rules still apply.',
        'An abstract selected type shows its inherited compatibility; query a concrete subtype for its exact rules.', `@help types ${target} ${connections.type}`);
    }
  }
  else if (topic === 'iconpacks') {
    const names = sorted(getIconPacks());
    if (!args.length) linked('Registered icon packs', names.map(name => link(`${name} · ${getIconNames(name).length} icons and aliases`,queryFor('iconpacks',name),name.length)));
    else {
      const [name, filter = '*', page = '1'] = args;
      if (!names.includes(name)) fail(`Unknown icon pack: ${name}. Registered: ${list(names)}.`);
      if (!/^[1-9][0-9]*$/.test(page) || !Number.isSafeInteger(Number(page))) fail('PAGE must be a positive integer.');
      const icons = sorted(getIconNames(name)).filter(id => filter === '*' || id.toLowerCase().includes(filter.toLowerCase()));
      const pages = Math.max(1, Math.ceil(icons.length / pageSize)), current = Number(page);
      if (current > pages) fail(`Page ${page} does not exist. Valid range: 1–${pages}.`);
      section(`Icon pack ${name}`, `${icons.length} matches · Filter: ${filter} · Page ${current}/${pages} · up to ${pageSize} names per page.`);
      section('Valid icon references', icons.length ? icons.slice((current - 1) * pageSize, current * pageSize).map(id => `${name}.${id}`) : ['(no matches)']);
      if (current < pages) section('Next page', `@help iconpacks ${name} ${JSON.stringify(filter)} ${current + 1}`);
      if (current > 1) section('Previous page', `@help iconpacks ${name} ${JSON.stringify(filter)} ${current - 1}`);
    }
    section('Usage and search', 'icon core.service  // in the model or a view style', '@help iconpacks PACK', '@help iconpacks PACK FILTER', '@help iconpacks PACK "*" 2',
      'FILTER performs a case-insensitive substring search. * lists all names.',
      'Only successfully registered packs are listed. Help does not download packs or access the preview configuration.');
  } else if (topic === 'diagrams') {
    const available = [...DIAGRAMS,...Object.keys(profile.diagrams ?? {})];
    const selected = args.length ? [args[0]] : sorted(available);
    if (selected.some(type => !available.includes(type))) fail(`Unknown diagram type. Valid types: ${list(available)}.`);
    const gridNotes = ['Select diagrams by ID in the grid view’s include list, for example include [l2, p2]. You can include model elements in the same list.',
      'show all (default) keeps empty and populated tiles visible. show selected displays only entries selected by include.',
      'show modeled displays only tiles with declared diagrams assigned to their viewpoint.',
      'show coverage keeps the full grid and colors every tile with a declared diagram. Tiles without a diagram are gray, including tiles with View products only. Include still controls the selection outline.',
      'Use viewpoints [L2, P2] to limit any display mode to those viewpoint codes. The list also accepts commas without brackets.',
      'With show modeled, include [] creates a diagram-only grid without marked selections. With show selected, include [] produces an empty grid.',
      'The NAF grid uses the same style-group colors and fill opacity as node cards. Selected tiles get a stronger outline. A gray overlay dims the fill and labels of unselected tiles. L2-L3 has a vertical label.',
      'Tiles show product and diagram counts by default. Use products list, diagrams list, or none on either option.',
      'Registered profiles can define named grids with diagrams.NAME.renderer viewpointGrid and an optional layout with rows, columns, cells and tile display options. A row can use styleGroup to share a node palette. A cell can set vertical: true.'];
    const notes = {
      connected: ['Default renderer. Use place, style and route to control the presentation.', 'propertyFields [expression, unit, value] adds actual property rows to cards; place and route remain available.', 'Named tree groups arrange selected sibling nodes automatically within this view. See @help views.'],
      tree: ['Automatic taxonomy/forest layout: parents centered across their ordered children. No place/route blocks in a whole-view tree.',
        'relations: optional relationship-type list (includes subtypes); other edges are omitted from this view.',
        'parentDirection: auto (default; generalization target is parent, otherwise source), source or target.',
        'direction: down (default), up, right or left; orientation is an alias. Choose only one. Direction describes parent-to-child layout, independently of arrow direction.',
        'levelGap/siblingGap: 16–800 pixels (defaults 96/48); level gaps grow for edge labels. Siblings pack by occupied ranks, so shallow branches reuse free space above/beside wider subtrees while cards and automatic labels remain separated.',
        'Use padding 24 for equal margins or padding [24, 56, 32, 16] for top, right, bottom and left. The brackets are optional for a comma-separated list. Values are 0–10000000 SVG units. The default is 48 on each side. The same option defines the bounds of named tree groups.',
        'showLabels controls the relationship text and defaults to true. showStereotype displays «TYPE» and inherits config.showRouteStereotypes. curve: rounded (default) or orthogonal.',
        'sharePath: none (default), stereotypes (same exact relationship type) or all (compatible types/styles). Shared paths preserve logical relationships and individual labels; incompatible styles or obstructed corridors remain separate.',
        'Node styles, icons, visibility and minimum sizes work as in connected views. Packages are flat cards; containment is not the hierarchy.',
        'A visible node has at most one hierarchy parent; cycles, self-links, parallel hierarchy links and bidirectional links are errors. Use relations/include/exclude/display none to select a tree, or diagram connected for multiple inheritance.',
        'For mixed layouts use tree ID { nodes [a, b, c] direction up } inside a connected view. External nodes remain visible and can be positioned separately; see @help views.'],
      sequence: ['participants/messages: ordered lists of node/edge IDs. Profiles may mark relation types with sequenceMessage true; automatic selection then uses those messages and their endpoint lifelines.',
        'With showContext true, a relationship type with sequenceContext above can draw its context card above the source lifeline. Shared context cards stay in the side area.',
        'asyncMessages/returns: subsets of messages; a message cannot be both async and return.',
        'Typed graphical references on messages draw object cards and attachments. Profile referenceConnectorLabels true captions the attachments. showContext true also draws other selected cards and context relationships (default false).',
        'orderAttribute FIELD sorts selected messages by unique positive integers in that attribute. Without it, explicit messages order or declaration order applies. Manual place/route is still Connected-only.'],
      state: ['initial accepts one node ID (solid dot). Use final [done, cancelled] or final done, cancelled for the final states (bullseyes). Model the transitions that connect these nodes. Initial has no incoming transitions; final states have no outgoing transitions.', 'Use initial virtual start -> waiting and final waiting -> virtual end { event shutdown } for view-only symbols and arrows. An optional quoted title follows the virtual ID.', 'Use place ID at (X, Y) for model states and place virtual ID at (X, Y) for virtual points. Coordinates may reference other visible states and points. The renderer routes transitions after placement.',
        'Use route EDGE_ID or route virtual POINT_ID in the view. Both accept from, to, via and curve. For example, route virtual start { from bottom to top 1/4 curve rounded via (start.centerX, waiting.y - 40) }. Formulas can reference visible states and virtual points.',
        'Use curve rounded (default), orthogonal, straight or bezier. With bezier, via specifies exactly two control points. Without via, the renderer derives them from the ports.',
        'When a profile defines stateTrigger, a short line attaches the event field to its transition arrow. Contextual elements can stay selected for validation. Return transitions and self-loops use separate paths.'],
      activity: ['lanes is a list of performer or role IDs. Use laneAttribute to select an explicit assignment field. Without that option, owner takes precedence over the performer inferred from PerformsOperationalActivity or IsCapableToPerform.',
        'Keep performer links in the selection for viewpoint validation. The swimlane omits those links and HoldsRole connectors between lanes. When several performers match, choose the lane through laneAttribute.',
        'initial accepts one node ID. Use final [done, cancelled] or final done, cancelled for the end nodes.',
        'layout auto (default) or flow orders activities by visible relationships whose profile rule sets activityFlow true. With no such relationships, activities follow declaration order. layout model always uses declaration order.',
        'Branches in different lanes may share a level. Joins follow all predecessors, and loops keep their members together in declaration order.',
        'decisions/forks require at least two outgoing edges; joins require at least two incoming edges.',
        'With lanes, use route EDGE_ID { from bottom 1/4 to top 3/4 } in the view block. Add via for intermediate waypoints. Port positions and coordinate pairs can reference visible activities and lanes.'],
      matrix: ['rows/columns: lists of node IDs (at most 100 each); relations: relationship types.', 'Without a selection, uses all visible elements/relationships. Cells count relationships in each direction; bidirectional links appear in both cells.'],
      heatmap: ['valueAttribute is required; numeric values between min and max (defaults 0 and 5).', 'parentAttribute is optional; otherwise uses the model hierarchy. colorLow/colorHigh: hex or CSS3 name.'],
      timeline: ['startAttribute/endAttribute select the date fields (defaults start/end).', 'Use startAttribute date endAttribute date to plot a single date as a milestone.', 'Set datedOnly true to draw only elements with a configured date field. Keep undated context in the selection for viewpoint validation. An element with a date still needs a valid start and end.'],
      table: ['mode elements (default) lists visible elements. mode relationships lists selected relationships and uses names for source and target.',
        'fields sets ordered columns. Use built-in fields or attributes declared by the selected profile types.',
        'width sets the total table width in SVG units. columnWidths sets widths by field name. Each column needs at least 64 units.',
        'Use either option on its own or both together. With width, the remaining space goes to columns without an explicit width. If every column has a width, their sum must match width.',
        'Without width, unspecified columns retain their default widths. Text wraps to fit, and row heights follow the wrapped text.'],
      sankey: ['relations limits the diagram to specified relationship types. Only endpoints of the selected flows are drawn.',
        'weightAttribute selects a positive numeric attribute on each selected relationship. Each link contributes one unit by default.',
        'Flows must be directed and acyclic. Use connected for feedback or bidirectional links.'],
      viewpointGrid: ['The default grid places the profile’s viewpoints automatically. It includes diagrams outside the grid in a separate tile.',...gridNotes],
      nafgrid: ['Profiles enable this renderer through viewpointGrid and define its entry viewpoint, rows, columns and cells. For naf41-uaf, use viewpoint A2.',
        'Products lists the selected model View elements. Use NafViewpoint with nafViewpoint, a Viewpoint ID matching a cell code, or a title beginning with a code such as L2 Logical Scenario.',
        'Diagrams lists declared view blocks by their viewpoint, independent of config.views. Grid views themselves are omitted. Use represents MODEL_ID to link a diagram to its product.',
        'Other viewpoints and unassigned products appear below the grid.',...gridNotes],
      class: ['attributes/methods/functions/interfaces/ports/parameters: lists of element IDs.', 'ownerAttribute/signatureAttribute: attribute names (defaults owner/signature).', 'Parameters belong to methods/functions; other details belong to classes.', 'propertyFields [FIELD, FIELD]: display actual attribute values/reference IDs on each class card; different from member element IDs.', 'place CLASS_ID at (X, Y) supports numeric or calculated absolute view coordinates. Optional size sets minimum dimensions (cards remain at least 380 wide and grow for contents). Unplaced cards keep their automatic row positions.', 'Ports move with their owner and can be coordinate anchors. Details cannot be placed individually. Packages are flat class cards here. Tree groups, route/routes, via and graphical reference connectors remain connected-only.'],
    };
    if(!args.length) linked('Diagram reference',selected.map(type=>link(type,queryFor('diagrams',type))));
    for (const type of selected) {
      const options = DIAGRAM_OPTIONS[type] ?? GRID_OPTIONS;
      section(type, `diagram ${type}${options.length ? ' { ... }' : ''}`, `Valid options: ${list(options)}`,
        Object.hasOwn(notes,type) ? notes[type] : gridNotes);
      if (type === 'table') codeSection('Set table and column widths', 'dsl', 'diagram table {',
        '  fields [title, type, description]', '  width 1000', '  columnWidths {', '    title 240', '    type 160', '  }', '}');
    }
    section('Lists and layout', 'Use square brackets for diagram lists such as participants [user, app]. final also accepts a comma-separated list without brackets.', 'All referenced elements must be visible.', 'place applies to connected, class and state. Connected views support all route options; activity views with lanes support from, to and via. style is also available in other diagrams.');
  } else if (topic === 'views') {
    section('Dashboard navigation', 'represents MODEL_ID', 'Links a modeled element to this view. The dashboard lets you open the view from that element or inspect the element from the view.');
    section('View reuse', 'extends SOURCE_VIEW', 'embed SOURCE_VIEW', 'embed SOURCE_VIEW as GROUP { frame true }', 'place GROUP at (0,0)', 'extends inherits selection and presentation; local include adds nodes, exclude removes nodes or relationships, styles/routes merge per field and place replaces the inherited placement. Each view has one base; forward references and chains are supported.', 'embed preserves the source layout as one movable group, without a frame by default. The source ID is the group ID unless as supplies an alias. frame true shows the source title and border. Connected hosts accept connected/tree sources, including nested embeds.', 'Overlapping groups may show multiple cards for one element. Use GROUP.NODE or GROUP.INNER.NODE in placement and routing expressions. A bare node ID works when it identifies one card. Use route EDGE { source GROUP.NODE } or target GROUP.NODE to choose an endpoint of a host relationship.', 'Extend the source view to customize its contents. Sources and the composed viewpoint are validated separately. Conflicting addresses and cycles are errors. Meta/help views cannot be reused.');
    section('View', 'view ID "Title" { ... }', 'direction right | down  (default right)', 'theme light | dark  (default light)', 'spacing NUMBER  (24–400; default 80)',
      'include ID, ID or include [ID, ID]  // without include: all elements; include [] selects none', 'exclude ID, ID or exclude [ID, ID]  // omit node or relationship IDs from this view. Excluding an edge keeps its endpoints', 'viewpoint NAME  // from the selected profile', 'referenceDisplay labels | nodes | both  // connected only; otherwise uses profile setting', 'referenceOccurrences shared | perEdge  // graphical references; default shared', 'routes { curve straight }  // defaults for all connected routes; individual route properties win', 'diagram TYPE { ... }  // default connected');
    section('Rendered views', 'config { views all }  // all views in declaration order', 'config { views detail, overview }  // selected IDs in this order', 'config { views [detail, overview] }  // same selection with brackets', 'config { views overview }  // one view', 'Without a selection, the first view is rendered. Multiple views are stacked with headings inside one standalone SVG.', 'API precedence: options.view, then options.views, then config.views, then the first view. The preview dropdown offers Configured views and individual views.');
    section('Named tree layout groups (connected only)', 'tree hierarchy { nodes [phase, vision, goalA, goalB] direction up }',
      'nodes phase, vision, goalA, goalB is equivalent. Single entries also become lists; nodes [] remains invalid.',
      'place hierarchy at (300, 0)  // optional group position', 'place capability at (0, 250)  // optional external card position',
      'Each group has its own direction: down (default), up, left or right. orientation is an alias. parentDirection auto/source/target selects hierarchy parents independently of arrow direction.',
      'Other options: relations, levelGap, siblingGap, curve rounded/orthogonal, showLabels, showStereotype, sharePath none/stereotypes/all. relations selects hierarchy edges; other visible relationships remain drawn and routable. sharePath applies to the selected hierarchy edges.',
      'Multiple groups are allowed. Members must be unique, visible non-container siblings; one node belongs to at most one group. Use include to select view contents and nodes to select group members.',
      'Compact packing uses occupied ranks, not full subtree rectangles; shallow siblings can sit beside a wide subtree without reserving its empty upper space.',
      'Groups are invisible layout regions, not model elements or packages. Group dimensions are automatic; place GROUP sets its bounding-box origin, relative to the parent package content if nested. Do not place individual members.',
      'External cards use normal connected layout; directly linked top-level cards are aligned beside the group when unplaced. Internal hierarchy edges use automatic tree paths; route overrides remain available.',
      'Route precedence: individual route properties, then group curve, showLabels, showStereotype and sharePath, then view routes defaults. showStereotype falls back to config.showRouteStereotypes. showLabels controls regular text. label none hides the entire label. See @help diagrams tree for hierarchy constraints.');
    section('Selection', 'Including a container includes its descendants. Required ancestor containers are added automatically.', 'Edges appear only when both endpoints are visible.', 'Without a view block, the default view is created automatically.', '@help routing', '@help styles', '@help diagrams');
    codeSection('Set a view background', 'dsl', 'view overview "Overview" {', '  backgroundColor transparent', '}');
    section('Background color', 'Accepts transparent, a CSS3 color name such as white, or a quoted hex color such as "#f4f6fa".',
      'A view uses its own color, then inherits from its base view and the architecture config. With no color configured, the view theme supplies the default.',
      'The color applies to the SVG canvas, behind any background image. The surrounding page shows through when the canvas is transparent.', '@help config', '@help colors');
    section('Background images', 'backgroundImage "/images/site-plan.png"  // visible behind the diagram',
      'showBackgroundImage true  // show element background images in this view; default false',
      'Use style NODE_ID { showBackgroundImage false } to override the view default on one element.', '@help styles');
  } else if (topic === 'routing') {
    section('Position and size (connected and class)', 'place ID at (X, Y)', 'place ID at (X, Y) size (WIDTH, HEIGHT)', 'Coordinates: ±10000000; minimum size (160, 96). Connected positions inside containers are relative to their content. Class cards are flat, use absolute coordinates, remain at least 380 wide and grow for contents; details move with their owner.');
    section('Align a row or column', 'row [a, b, c] { gap 32 align center }', 'column a, b, c { gap a.height / 2 align left }',
      'The first ID keeps its current placement. Each following element is placed relative to the preceding one. The default gap is the view spacing. Use top/center/bottom for rows and left/center/right for columns.');
    section('Relative placement', 'place card right of anchor gap anchor.height / 4',
      'place detail bottom of card gap 28 align left',
      'Choose right, top, left or bottom. gap measures edge-to-edge distance in SVG units and defaults to the effective view spacing. It accepts the same arithmetic and references as coordinates. A negative gap permits overlap.',
      'align defaults to center. For left and right, choose top, center or bottom. For top and bottom, choose left, center or right.',
      'place card right of treeGroup gap 32 align to member.centerY',
      'align to ID.FIELD aligns matching edges or centers to another visible card or group. For left/right use .y, .centerY or .bottom. For top/bottom use .x, .centerX or .right. The gap is still measured from the anchor after of.',
      'Use the same visible anchors as place at. Connected views can move whole tree groups or embeds. Class cards and modeled or virtual states support relative placement.',
      'JSON uses "relative": {"side":"bottom","of":"card","gap":28,"align":"left"} in place or virtualPlace. Use "align": {"to":"member.centerX"} to align to another box.');
    section('Coordinate references and offsets', 'place maritime at (coverage.x + 20, vision.y - 40)',
      'place maritime at (hierarchy.x - maritime.width - 80, vision.y)', 'place second at (first.right + 40, first.y)',
      'Reference fields: x, y (top-left corner), width, height, right, bottom, centerX, centerY. Use visible node or tree group IDs from the same view, including automatically positioned tree members.',
      'Each coordinate supports numbers, references and +, -, *, /. Multiplication/division precede addition/subtraction; equal-precedence operators evaluate left to right. Parentheses override precedence, unary + and - are supported. At most 32 operands and 16 nested parentheses. Expressions work in place at and in from/to, via and label pairs. The size pair uses numeric values.',
      'Subtraction between references also works without spaces: first.y-second.height. Dots/hyphens remain valid in IDs: the longest matching declared ID wins. If root.x-offset is a declared ID, root.x-offset.y means its y coordinate; root.x - offset.y forces subtraction. Hidden IDs still bind and produce visibility errors.',
      'place maritime at (hierarchy.x - maritime.width - 80, vision.centerY - maritime.height / 2)',
      'place second at ((first.x + first.right) / 2, first.y + 20 * 3)',
      'Division by zero and nonfinite calculations are errors. Constant zero divisors are rejected during validation; divisors depending on layout values are checked when positions resolve.',
      'References are evaluated in the target parent content coordinate space. At top level this is the view coordinate space. A single reference plus an offset aligns to the referenced absolute position even across containers; plain numeric coordinates retain their local meaning.',
      'Automatic layout runs once. Symbolic placements then resolve before edge/reference routing; they do not trigger collision avoidance or reflow. Coordinates and references are local to each view.',
      'Forward references work independently of declaration order. Circular coordinate chains are errors, also in draft mode; the error lists the chain. A tree member depends on its group, and package sizes depend on their contents. Anchor at least one coordinate independently.',
      'Package content may expand right/down after placement. A result outside the parent left/top content area is an error; move the parent or choose an inside position. A graphical reference card used as a coordinate anchor becomes a canonical card in normal layout.',
      'JSON: "at": ["coverage.x + 20", "vision.y - 40"]. Expressions remain symbolic in JSON/DSL/meta exports.');
    section('Tree groups', 'place TREE_GROUP_ID at (X, Y)', 'Positions the complete automatic tree; size and individual member placement are not supported. Outside nodes accept ordinary place. Internal edges accept route overrides, including label icons. @help views');
    section('Routing defaults (connected only)', 'routes {', '  curve straight', '  from auto', '}',
      'Defaults apply to every relationship and reference connector in this view, including routes without an individual block. Specific route properties override matching defaults, regardless of declaration order. Other defaults remain inherited.',
      'Available fields: from, to, via, curve, label, sideOffset, path, icon, iconPosition, showIcon, showLabel, showStereotype, sharePath, color, width, dasharray, crossings, crossingRadius, avoidObstacles. A target port/point in to applies to relationships; a fraction from 0 to 1 applies to reference connectors. Shared label defaults apply to relationship labels. Reference connector labels can be positioned in individual routes.',
      'On an individual host route, source GROUP.NODE and target GROUP.NODE select embedded cards for the model endpoints. from and to still select ports.',
      'Specific from/to/via/curve settings replace an inherited free path; an explicit path still controls the complete route. Empty routes {} keeps the existing automatic routing.');
    section('Multiple relationships',
      'route r1, r2 { curve straight from bottom to top }',
      'route [r1, r2] { from right }',
      'Use either list form with relationship IDs. The last setting for each property wins for each relationship. Other route properties retain their previous values.');
    section('Route geometry', 'route r1, r2 { via (routeSource.right + 40, routeTarget.centerY) }',
      'Use routeSource and routeTarget in individual connected route expressions. A model element or group with the same ID takes precedence.',
      'Set routes { avoidObstacles true } to try free channels for automatic rounded or orthogonal edges and free positions for their automatic captions.');
    section('Crossing bridges (connected only)', 'routes { crossings bridge crossingRadius 6 }',
      'route EDGE_ID { crossings none }',
      'bridge is the default. At a crossing, all coincident strokes on the jumping side follow the same arc. If a route or nearby junction prevents the shared jump, the renderer checks the crossing side.',
      'Set crossings none in routes to turn off bridges, or on a relationship to keep its own path straight. Individual routes can re-enable bridges. crossingRadius is 2–24 SVG units, default 6. The logical paths still determine labels and reference anchors.');
    section('Shared relationship paths', 'routes { sharePath stereotypes }', 'route EDGE_ID { sharePath none }',
      'Trees also accept diagram tree { sharePath stereotypes } and tree GROUP { nodes [a,b,c] sharePath stereotypes }. Named group precedence: route, then tree, then view routes defaults.',
      'sharePath: none (default), stereotypes (exact relationship type) or all (different types permitted). A specific route overrides the default.',
      'Bundles fan-in or fan-out relationships sharing a target or source, compatible line styles/directions, matching color/width/dasharray and facing ports. Applies to connected views, including named tree groups. Labels/icons and relationship IDs remain separate; reference connectors follow each complete logical path.',
      'Automatic sharing needs compatible ports and sufficient free space. With curve rounded, outside bends are rounded and both sides of the shared section curve into the common stem. Fan-in takes precedence in automatic sharing.',
      'Compatible solid routes with explicit via points can share an identical stroke at the source or target. The authored paths and their private branches retain their geometry.');
    section('Route line styles (connected only)', 'routes { color "#64748b" width 2 dasharray 8, 4 }', 'route EDGE_ID { color red width 3 dasharray none }', 'route NODE_ID -> EDGE_ID { color blue width 1.5 dasharray [2, 3] }',
      'color: a quoted #RGB/#RRGGBB value or a CSS3 color name. Applies to the line and arrowheads; label text, frames and icons retain their own theme colors. Without color, uses the theme edge color.',
      'width: stroke width from 0.1 to 64 SVG units (default 1.5). Arrowheads scale with line width. Export bounds grow conservatively for thick markers.',
      'Use dasharray none or dasharray [] for a solid line. Write comma-separated lengths as dasharray 8, 4 or dasharray [8, 4]. Specify 1–32 dash/gap lengths from 0 to 10000, including at least one positive value. Odd patterns repeat. SVG number strings such as "8 4" or "8,4" also work. Lengths are in SVG units.',
      'Without dasharray, dependency/realization edges remain dashed (6 5), other edges and reference connectors stay solid. Coincident straight sections of dashed relationships with matching color, width and pattern are painted once, including via routes. Each relationship retains its markers. Individual fields override routes defaults. Line styles also apply to reference connectors; style-only settings preserve automatic obstacle avoidance and do not replace an inherited path.');
    section('Edge routing (connected only)', 'route EDGE_ID {', '  from right', '  to left', '  via (270, 100), (270, 180)', '  curve rounded', '  label (300, 140)', '}',
      'from/to: auto | top | right | bottom | left, or an absolute point (X, Y).', 'curve: rounded (default) | orthogonal | straight | bezier. With via, bezier requires exactly two control points.', 'path "M 0 0 L 100 100" replaces the calculated path; label (X, Y) positions the edge label; label none hides its text, frame and icon.');
    section('Swimlane ports and waypoints', 'route EDGE_ID { from bottom 1/4 to top 3/4 }', 'route EDGE_ID { from (a.right, a.centerY) to left via (b.x - 24, b.centerY) }', 'Available in activity views with lanes. from/to accept auto, top, right, bottom, left, a side with a position from 0 to 1, or an absolute point. Omitted ports use the automatic endpoints. The path passes through via waypoints in order. Coordinate pairs and port positions can reference visible activity and lane geometry.');
    section('Calculated endpoints', 'route EDGE_ID { from (source.right, target.centerY) to left }', 'route EDGE_ID { from (source.right, source.y + 10) to (target.x, target.y + target.height / 2) }',
      'Coordinate pairs accept the same arithmetic and visible layout references as via. They resolve to absolute view coordinates after final placement and sizing. A reference connector accepts a calculated from pair and a fractional to position along its carrying relationship.');
    section('Calculated and relative labels', 'route EDGE_ID { label (source.centerX, source.y - 20) }', 'route EDGE_ID { label 0.3 }', 'route EDGE_ID { label 0.5 offset source.width / 2 }', 'routes { label 1/2 }', 'label (X,Y) accepts node/package/tree/embed coordinates with +, -, *, / and parentheses, resolved after final placement. Points are absolute view coordinates, including inside packages. Explicit path does not suppress calculated label coordinates.', 'label 0..1 places the center along the full logical route: 0 at source, 1 at target. Fractions such as 1/3 are accepted. Bends, rounded corners, curves, self-loops and free SVG paths are included; curved path lengths use sampled geometry. Shared routes use the entire logical edge, not just the drawn branch.', 'Optional offset EXPR shifts along the path in SVG units after the fractional position: positive toward target, negative toward source, clamped to endpoints. label 0 offset 80 is 80 units from source; label 1 offset -40 is 40 units before target. Offset accepts the same visible geometry references and arithmetic as via, resolved after layout; its result must be finite within ±10000000; a zero-length route stays at its point. JSON: label {"position":0.5,"offset":"source.width / 2"}.', 'These positions override automatic caption offsets/collision-side selection. Local label overrides routes defaults; label none still hides the entire label. Individual reference connector routes accept the same label forms. JSON: label 0.3, label "1/3", or label ["source.centerX", "source.y - 20"].');
    section('Side offset for labels', 'route EDGE_ID { sideOffset -12 }', 'A standalone sideOffset shifts the existing label position, including any automatic spacing.', 'route EDGE_ID { label 0.5 offset 20 sideOffset 24 }', 'route NODE_ID -> EDGE_ID { label 1/3 sideOffset -24 }', 'With a path fraction, sideOffset moves the caption perpendicular to the local path direction after offset. Positive values go left; negative values go right. A bidirectional path follows the written source-to-target order. At a corner the tangent is the incoming segment. Expressions, units and limits match offset. JSON: use sideOffset on the route or inside label {"position":0.5,"sideOffset":24}.' );
    section('Positions along node sides', 'route EDGE_ID { from bottom 1/2 to left 0.25 curve rounded }',
      'route EDGE_ID { from right (target.centerY - source.y) / source.height to left 1/2 }',
      'top, right, bottom and left accept a value from 0 to 1, as a number or an expression. top/bottom run left to right; left/right run top to bottom. 0 and 1 select the corners. Omitted positions use the side center (0.5). auto does not accept a position.',
      'Calculate a fixed distance with from right 10 / source.height or from bottom 10 / source.width. Use the actual node IDs. Expressions use the same arithmetic and final layout fields as via. Results outside 0 to 1 are rejected.',
      'Positions follow the final node size and placement, including packages and named tree groups in connected views. A specific endpoint replaces the entire default endpoint; from left resets an inherited from bottom 0.25 to the left center. Explicit path overrides endpoints.',
      'Reference connectors accept the same positioned from port: route NODE_ID -> EDGE_ID { from right 1/4 to 1/2 }. Their to sets the fraction along the relationship. Fractions cannot divide by zero. Evaluated positions must be between 0 and 1.',
      'JSON: "from": {"side":"right","position":"10 / source.height"}, "to": {"side":"left","position":0.25}. Reference targets accept "to":"1/2" or an expression string. Constant expressions normalize to numbers in JSON/DSL/meta exports.');
    section('Calculated via points', 'route EDGE_ID { via (source.right + 40, source.centerY), (target.x - 40, target.centerY) }',
      'route information -> EDGE_ID { via [(information.centerX, information.y - 40), (target.x - 40, target.centerY)] curve bezier }',
      'routes { via ((source.x + target.x) / 2, source.y - 60) }',
      'Use via (X1, Y1), (X2, Y2) or via [(X1, Y1), (X2, Y2)]. Both forms require at least one waypoint. Coordinates accept the same node/group fields, +, -, *, /, parentheses and numeric limits as place. A local via replaces the whole default point list.',
      'All routing pairs use absolute view coordinates, including inside packages. Nodes, package sizes and tree groups resolve before route coordinates. Explicit path replaces endpoints and via. Label points can still place a caption on a free path.',
      'Only visible nodes and groups in this view can be used; relationship IDs and other routes are not coordinate anchors. Graphical reference cards used as anchors become canonical cards in normal layout, also with perEdge occurrences. Other reference cards retain automatic placement.',
      'A hidden carrying edge or a hidden reference card does not evaluate its unused via. Unknown IDs and invalid arithmetic are still rejected in stored routes. Constant zero divisors fail validation; layout-dependent zero divisors fail during rendering.',
      'JSON: "via": [["source.right + 40", "target.y - 20"], ["target.x - 40", "target.centerY"]]. Source/meta exports preserve expressions.');
    section('Independent label fields', 'routes { showStereotype true }', 'route EDGE_ID { showLabel false showIcon false showStereotype true }',
      'showStereotype displays the relationship type as «TYPE» above any label text. It inherits config.showRouteStereotypes when omitted. showLabel controls the title and reference text. showIcon controls the configured icon. Both default to true.',
      'A label with no visible content has no frame. label none hides the entire label.');
    section('Stereotypes in tree views', 'diagram tree { showStereotype true }',
      'tree hierarchy { nodes [a, b, c] showStereotype true }', 'Use showLabels false to show the type without the regular label text.');
    section('Hide relationship labels', 'routes { label none }', 'route EDGE_ID { label none }', 'A local label (X, Y) overrides a global label none and shows the label again, including any inherited icon. Hidden labels occupy no layout space; relationship titles and references remain in the model and edge tooltip.');
    section('Hide entire relationships', 'style EDGE_ID { display none }', 'style EDGE_ID { display standard }',
      'View-local presentation only: hide the path, label/icon and carried reference connectors. Hidden relationships still count for profile/model constraints. Matrices omit their cells; explicit sequence message lists skip hidden messages.',
      'Relationship styles accept only display none or standard. Other presentation fields belong in route EDGE_ID.');
    section('Icons on relationship labels', 'routes { icon core.cloud iconPosition left }', 'route EDGE_ID { icon core.shield iconPosition top }',
      'icon: PACK.NAME from a registered pack, or none to disable an inherited icon. iconPosition: top | left | bottom | right (default left).',
      'Icons appear inside the label frame relative to its text. Layout reserves space for the icon, multiline text and export bounds. An icon also works without label text.',
      'Local route settings override view defaults per property. Label icons do not apply to reference connectors or change node icon positions.');
    section('Reference connector routing (connected only)', 'route NODE_ID -> EDGE_ID {', '  from bottom', '  to 0.5', '  via (400, -80), (400, 100)', '  curve rounded', '  label 0.2', '}',
      'An automatic relationship label stays in place until a reference connector crosses its box. In that case, the renderer compares both sides and the original position. It minimizes total overlaps, then connector crossings, and keeps the original position on a tie.',
      'NODE_ID must be a graphical reference of EDGE_ID, configured by the profile referenceLabels. Works with shared and perEdge cards.',
      'from: a card port (auto, top, right, bottom, left) or an absolute point. to: fraction from 0 (relationship source) to 1 (target), measured along the rendered relationship path. Default: automatic attachment position.',
      'route data -> EDGE_ID { from top to (data.centerX-a.x)/(b.right-a.x) }',
      'Calculate to from visible geometry using the same arithmetic as via. The value is resolved after layout and must be between 0 and 1.',
      'via and curve work like ordinary edge routes. Automatic reference connectors round their bends where there is room. Manual ports and waypoints replace automatic obstacle avoidance. Coordinates are absolute, including inside containers.',
      'path "M 0 0 L 100 100" overrides the whole connector, including its endpoints. With profile referenceConnectorLabels enabled, label sets the caption position along the connector (default 0.5). Use a fraction, a fraction with offset, a coordinate pair, or none.',
      'Hidden references, hidden carrying relationships and labels-only presentation do not draw connectors; their stored routes remain available.');
  } else if (topic === 'styles') {
    section('Property fields on cards', 'propertyFields [expression, unit, value]  // view-wide', 'style criterion { propertyFields [expression] }', 'style measure { propertyFields [unit, value] }',
      'Available in connected, tree and class views. diagram connected/tree/class { propertyFields [...] } supplies diagram defaults. Precedence: node style, view, diagram. propertyFields expression, unit is equivalent to propertyFields [expression, unit] at every supported location. A single field also becomes a list; [] clears a selection.',
      'Names are declared attributes or public properties (id, type, title, description, technology, stereotype, tags). Each card shows only values it has, including 0, false and lists. Unknown names are errors. Text wraps and cards grow before placement/routing; packages reserve header space for their rows.',
      'Connected cards retain templates, icons, place, routes, tree groups and reference cards. Logo display hides all text including properties. Property visibility is independent of showLabel/showDescription. Class details cannot have their own propertyFields style; configure the owner card.',
      'Class cards retain compartments and accept place with calculated coordinates. Routes remain automatic; route/routes/via are not supported in class views.');
    section('Hide nodes, packages or relationships', 'style ELEMENT_ID { display none }', 'style ELEMENT_ID { display standard }',
      'Use style [a, b] { display none } or style a, b { display none } to hide several targets. For each target and field, the last setting wins. Omitted fields keep their previous values.',
      'Node hiding removes the card and all incident relationships. Packages also hide their descendants, even when explicitly included. Hidden reference cards/connectors are omitted.',
      'Relationship hiding removes the line, label/icon and carried reference connectors. It does not remove the relationship from model/profile validation.',
      'Presentation only, local to the view; structural renderer and profile requirements still apply. Node display none works in all diagram renderers. Other relationship styles belong in route EDGE_ID.');
    section('View style', 'style NODE_ID {', '  template component', '  icon core.service', '  accent SlateBlue', '  backgroundColor Gold', '  opacity 0.45', '}',
      'Valid fields: template, icon, iconPosition, accent, backgroundColor, opacity, display, fontSize, width, height, showIcon, showLabel, showStereotype, showDescription, showTechnology, propertyFields.', 'fontSize: title size from 6 to 64 (default 15); other node texts scale proportionally. width/height: minimum dimensions (at least 160/96). These overrides require a connected view and take precedence over place size; content may increase height.', 'The type/stereotype badge stays on one line with an ellipsis when needed; its tooltip keeps the complete text.', 'display logo: connected view, non-container elements; show only a rectangle and an aspect-preserving icon. Centered by default; iconPosition aligns it inside the padded rectangle. display standard restores the usual card. Accessible title/type remain present.', 'Containers use template package; other elements use a non-container template.', 'opacity: number from 0 to 1, applied to fills only. Text, icons and borders remain opaque.', 'Default: 0.2 with an explicit background, otherwise 1.');
    section('Node icon placement and visible fields', 'style NODE_ID { iconPosition right showStereotype false showDescription false }', 'iconPosition: top | left | bottom | right. Default: existing template placement; logo display stays centered unless a side is chosen. Package icons stay inside the header. Text and card/header sizes adapt to the placement.', 'showIcon, showLabel, showStereotype, showDescription, showTechnology: true | false (default true). showLabel controls the node title. Hidden fields reserve no text space; model values and accessible tooltips remain present.', 'Use standard display for independent text/icon visibility. Logo display still hides all text; showIcon false leaves its rectangle. These options require connected views and also apply to graphical reference cards.');
    section('Element background images', 'service api "API" { icon core.service backgroundImage "/images/server.jpg" }',
      'style api { showBackgroundImage true }  // display the element image in this view',
      'style api { backgroundImage "/images/server-alt.jpg" showBackgroundImage true }  // use a view-specific image',
      'The element image is behind the icon and text. It is independent of icon and showIcon. Node style overrides the view visibility default, which is false.',
      'Use a quoted path, HTTP(S) URL or base64 raster data URI. View images cover the canvas. Element images cover and are clipped to cards.');
    section('Calculated node styles', 'style source { width 240 height 100 fontSize 15 }', 'style target { width source.width + 80 height 2 * source.height fontSize source.style.fontSize * 1.2 }',
      'width, height and fontSize accept numbers or arithmetic with +, -, *, /, unary signs and parentheses. Available in connected and tree views; JSON uses expression strings.',
      'ID.width/height are measured card dimensions before placement; height includes visible content. ID.fontSize is the effective title size (default 15). ID.style.width/height/fontSize use explicitly configured values in this view and fail when missing. A configured height remains a minimum.',
      'References must name visible nodes in the same view. Forward references are allowed. Final package and tree-group dimensions are unavailable here; packages can supply explicit .style values. Position fields and route styling cannot use these expressions.',
      'Cycles, division by zero and invalid results are errors. Resolved width/height must be at least 160/96 and at most 10000000; fontSize must be 6–64. Expressions allow at most 32 terms, 16 nested parentheses and 2048 characters. Source expressions are preserved in JSON/DSL/meta output.',
      'IDs may contain dots and hyphens; the longest declared matching ID wins. Spaces around subtraction make the intended calculation clear. Example: examples/style-expressions.arch.');
    section('Tree projection', 'Tree views also accept node fontSize, width/height, iconPosition, showIcon/showLabel/showStereotype/showDescription/showTechnology and logo display. Placement and routing are automatic. See @help diagrams tree.');
    section('Precedence', 'View style overrides type presentation. Background: view, then type color, then style group, then theme.', 'A model icon overrides the type icon; a view icon has the highest priority.', 'Colors: hex (3/6 digits, quoted) or a CSS3 color name.', '@help colors', '@help templates');
  } else if (topic === 'colors') {
    const filter = (args[0] ?? '').toLowerCase(), colors = Object.entries(CSS3_COLORS).sort(([a], [b]) => a.localeCompare(b)).filter(([name]) => name.includes(filter));
    section('Colors', '147 CSS3 color names, case-insensitive. Alternatively use "#abc" or "#aabbcc".',
      'Valid for accent, backgroundColor and heatmap colorLow/colorHigh.', 'Quote hex colors: an unquoted # starts a comment.', `${colors.length} matches${filter ? ` for ${filter}` : ''}.`);
    section('Name → Hex', colors.length ? colors.map(([name, hex]) => `${name}  ${hex}`) : ['(no matches)']);
  } else if (topic === 'templates') {
    section('Node templates', TEMPLATES);
    section('Edge styles', EDGE_STYLES);
    section('Semantic types', 'Templates and edge styles control presentation. The profile defines the allowed model types.', '@help types', '@help relations');
  } else if (topic === 'config') {
    section('Browser presentation', 'presentation accepts two values.',
      'diagram  —  Default. Shows the configured SVG views.',
      'dashboard  —  Opens the interactive catalog of all views, elements and relationships.',
      'Dashboard presentation is available in Studio and when calling arch.render() or arch.renderAll() from arch.min.js.',
      'With arch.core.min.js, choose diagram for DOM rendering. Validation and SVG export also work with documents configured for dashboard presentation.');
    codeSection('Dashboard example', 'dsl', 'config {', '  presentation dashboard', '  views [overview, detail]', '}');
    section('View source in the dashboard', 'Source  —  Shows the active view definition, its model declarations and any required source views.',
      'DSL and JSON  —  Switch between syntax-highlighted formats. Copy source copies the current format.',
      'Both formats are generated from the model and available in the standalone HTML export.');
    section('View selection', 'views  —  Chooses the SVG output and the dashboard’s starting view.',
      'all  —  Selects all declared views in declaration order.',
      'overview  —  Selects one view by ID.',
      '[overview, detail]  —  Selects unique view IDs in the listed order. Commas also work without brackets.',
      'Omitting views selects the first declared view. Multiple selected views stack in one SVG. The dashboard opens the first selected view and its catalog includes every declared view.');
    codeSection('Default view background', 'dsl', 'config {', '  backgroundColor "#f4f6fa"', '}');
    section('View canvas', 'Set backgroundColor to a quoted hex value, a CSS3 color name, or transparent. Individual views can override this default.', '@help views');
    section('Relationship stereotypes', 'config { showRouteStereotypes true }',
      'Sets the default for connected views, standalone tree views and named tree groups. The default is false. Override it with showStereotype in a route, view routes, diagram tree or named tree group.');
    section('Select a registered profile', 'architecture "Title" {', '  config { profile PROFILE }', '  model { ... }', '}', 'options.profile overrides this selection. Register external profiles before rendering.');
    section('Custom inline profile', 'config {', '  type actor { template person }', '  type product {', '    template application', '    attribute owner { type string required true }', '  }', '  relation uses { from actor to product style flow }', '  defaultRelation uses', '}',
      'Choose either config profile or an inline definition. Inline profiles are not registered globally.');
    section('Inline rule fields', 'Profile: id, title, version, extends, defaultRelation, requireViewpoint.', 'type: extends, template, container, abstract, contains, icon, accent, backgroundColor, styleGroup, attribute/attributes.',
      'relation: extends, style, abstract, from, to, directions [forward, both], allowSelf, acyclic, incoming/outgoing { min ... max ... }, attribute/attributes.',
      'attribute: type, required, enum, min, max, minLength, maxLength, format, many, minItems, maxItems, uniqueItems, targets.',
      'Attribute types: string, number, integer, boolean, reference. Formats: date, date-time, uri.',
      'viewpoint: nodes, relations, requiredNodes, requiredRelations. styleGroup: backgroundColor.',
      'Multiple inheritance: extends A, B. Profile extends has exactly one registered parent.',
      'JSON profiles also support comparisons, pairs, connections and objectifications. A connection rule may use referenceAttributes to count selected typed counterpart references as alternative evidence; the same explicit edge endpoint is not counted twice.',
      'connections[].through accepts one {relations, direction} object or a list of these objects. Each step follows the specified incoming or outgoing relationship types through selected nodes. Subtypes match and each evidence edge counts once. No implicit model edges are created. Details: @help types/relations/viewpoints PROFILE NAME.');
    section('Objectified relationships', 'External JSON/API profiles may define node and relationship types with the same name in separate namespaces.',
      'A typed reference attribute on an edge binds its object node. referenceLabels plus referenceDisplay nodes draw the attachment; referenceConnectorLabels true also draws its caption. route OBJECT_ID -> EDGE_ID controls the connector.',
      'connections[].referencedByAttributes counts selected matching relationships whose named reference attributes point to the selected node. Use direction either and explicit relation/attribute names, without counterparts, through or referenceAttributes. An edge counts once. min/max can enforce exactly one binding.',
      'JSON viewpoint objectifications rules select nodes and relations, name the scalar binding attribute, and optionally map legacy endpoints {source: "source", target: "target"}. allowLegacy accepts a complete visible endpoint pair; required demands an edge or legacy representation in the view. Duplicate model bindings and conflicting endpoint references are errors. Object cards can be omitted while the compact relationship remains.',
      '@help types naf41-uaf ServiceStateTransition', '@help relations naf41-uaf ServiceStateTransition', '@help viewpoints naf41-uaf S5');
    section('Mapping review markers', 'config { validation draft showValidation true }', 'Connected/tree cards show ? for a mapping not modeled, and ! for a known required mapping hidden by filtering or display none. Tooltips and the notice footer explain each issue. Other renderers retain the footer without card markers.', 'A missing mapping is a non-blocking completeness review, not a proven cardinality violation. A hidden shall-show mapping blocks strict rendering and becomes a warning in draft. may-show mappings may be omitted.', 'config { showValidation false } or API {showValidation:false} hides markers and the footer together without changing validation or bypassing strict errors. validate() still returns diagnostics; reviewRequired:true signals open mapping reviews without claiming conformant:false for that review alone.');
    section('Validation mode', 'config { profile naf41-uaf validation draft }', 'validation strict is the default. Draft renders safely incomplete models and lists remaining requirements below the diagram. See @help model.');
  } else if (topic === 'api') {
    section('Browser bundles', 'arch.core.min.js  —  DSL and JSON, profiles, validation, layout and SVG rendering.',
      'arch.min.js  —  All core APIs plus help, dashboard, reports, source inspection and draft popovers.',
      'Load one bundle per page. Both expose window.arch. Load profile and icon scripts afterwards.');
    section('Queries and rendering', 'arch.help("types default service", options) → help text', 'arch.parse(source, options) → architecture or help document', 'arch.validate(sourceOrModel, options) → { valid, profile, diagnostics }',
      'arch.layout(sourceOrModel, options) → layout with bounds', 'arch.renderToString(sourceOrModel, options) → SVG string', 'arch.renderDiagram(sourceOrModel, options) → { graph, svg } from one layout', 'arch.render(target, sourceOrModel, options) → SVG or dashboard DOM element', 'arch.renderAll({ root, selector, ...options }) → rendered DOM elements', 'arch.renderMarkdown(markdown, options) → HTML with inline SVG',
      'presentation: "diagram" | "dashboard" overrides config.presentation for render and renderAll.');
    section('Live preview', 'arch.renderDiagram(source, { syntaxRecovery: true })',
      'Render valid DSL declarations around localized syntax errors. Read graph.syntaxDiagnostics for line and column details. API syntaxRecovery overrides config.syntaxRecovery.',
      'arch.parsePreview(source, options) enables this by default. arch.parse(), arch.validate(), and arch.translate() use strict syntax.',
      'In Studio, arch.render() and arch.renderAll() connect diagnostic links to the built-in help.',
      'For your own DOM insertion, call arch.attachDiagnosticHelp(container, graph, options). Pass helpBaseURL to link exported SVGs to a Studio URL.');
    section('Registration', 'arch.registerProfile(name, definition)', 'arch.getProfiles() → registered IDs', 'arch.getProfile(name) → independent profile copy; name may be PROFILE@VERSION', 'arch.getProfileVersions(name) → registered revision strings for an ID', 'arch.registerIconPack(name, data)  // Iconify or converted paths', 'arch.getIconPacks() → registered pack names', 'arch.renderIconToString("PACK.NAME", { size, title, idPrefix })');
    section('Mapping visibility rules', 'connections[].visibility: may | shall with min 0 and no max/through/referencedByAttributes. shall inspects known model relationships and referenceAttributes, requires their rendered counterparts/links to be visible, and reports absent model mappings for review. may permits omission. Cardinality rules without visibility keep their existing behavior.');
    section('Options', 'profile: registered profile ID or profile object; also applies to @help types/relations/viewpoints without an explicit ID.', 'validation: strict | draft; overrides config.validation. Incomplete drafts have warning diagnostics and conformant: false; layout returns kind notices with content and enlarged bounds.', 'view: one view ID; views: all, a view ID or an array of IDs. Precedence: view > views > config.views > first view.', 'theme: light | dark (overrides all selected views); idPrefix: unique SVG ID prefix. Multiple views return one SVG. layout returns kind views with layouts/sections and overall bounds; single-view layout stays unchanged.', 'Help uses the help view. Registration does not load URLs. renderAll isolates errors per block.');
  }
  return { topic, parameters:args, profile, title: topic ? `Help · ${topic}` : 'arch.js · Help', sections };
}

export function help(query = '', options = {}) {
  if (typeof query !== 'string') fail('Help query must be a string.');
  const model = parseHelp(`@help${query ? ` ${query}` : ''}`, options), content = helpContent(model, options);
  return [content.title, ...content.sections.flatMap(s => ['', s.title, ...s.lines])].join('\n');
}

const helpBlockStart = /^(?:(?:config|model)|architecture\s+"(?:[^"\\]|\\.)*")\s*\{\s*$/;
const helpCommand = /^\s*(?:@(?:help|meta)\b|architecture\s+"|(?:config|model)\s*\{|view\s+\S+\s+(?:"|\{)|(?:diagram|relation|place|route|style|embed|include|icon)\s+\S+(?:\s|$))/;

// Share the distinction between syntax and definitions with the dashboard.
// A partial example can also appear at the start of a prose section.
export function helpLineStyles(section) {
  let blockEnd = -1;
  return section.lines.map((line,index) => {
    if (!section.format && index>blockEnd && helpBlockStart.test(line)) {
      blockEnd = section.lines.findIndex((candidate,i)=>i>index && candidate==='}');
    }
    const block = Boolean(section.format) || index<=blockEnd;
    const format = section.format ?? (block || helpCommand.test(line) && !line.includes('  —  ') ? 'dsl' : undefined);
    if (format) return {format,block};
    const term = /^(\S.{0,90}?)(?: {2}— {2}| · )/u.exec(line) ?? /^([@\w./-]+(?: [\w/-]+){0,3}): /u.exec(line);
    return term ? {termLength:[...term[1]].length} : null;
  });
}

export function layoutHelp(model, options = {}) {
  const content = helpContent(model, options);
  if (options.view !== undefined && options.view !== 'help') fail(`Unknown view: ${options.view}`);
  const rows = [], panels = []; let y = 142;
  const clean = text => String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu, '\ufffd');
  for (const section of content.sections.filter(section => section.lines.length)) {
    y += 24;
    for (const line of wrapLine(clean(section.title), 78)) { rows.push({ kind: 'heading', text: line, y }); y += 25; }
    y += 6;
    const styles = helpLineStyles(section);
    let panelStart;
    function finishPanel() {
      if (panelStart===undefined) return;
      panels.push({y:panelStart-17,height:y-panelStart+5});
      panelStart = undefined;
    }
    for (const [index,sourceLine] of section.lines.entries()) {
      const line = clean(sourceLine);
      const {format,block=false,termLength=0} = styles[index] ?? {};
      if (block) panelStart ??= y;
      else finishPanel();
      const characters = [...line];
      const links = section.links?.[index] ?? [];
      // Help commands documented as examples can be followed directly.
      // Placeholder forms still display as copyable syntax.
      if (!links.length && /^@help(?:\s|$)/.test(line) &&
        !/\b(?:PROFILE|TYPE|NODE_TYPE|RELATION|VIEWPOINT|NAME|PACK|FILTER|PAGE)\b| {2}— {2}|;|\.$/.test(line)) {
        try {
          parseHelpCommand(line);
          links.push({start:0,end:characters.length,query:line.slice(5).trim()});
        } catch { /* Keep syntactic examples as ordinary reference text. */ }
      }
      let consumed = 0;
      for (const part of wrapLine(line, 104)) {
        const termsRemaining = Math.max(0, termLength - consumed), length = [...part].length;
        const visibleLinks = links.filter(link=>link.start<consumed+length && link.end>consumed)
          .map(link=>({...link,start:Math.max(0,link.start-consumed),end:Math.min(length,link.end-consumed)}));
        rows.push({ kind:'body', text:part, y, format, termsRemaining, links:visibleLinks, inset:block });
        consumed += length + Number(characters[consumed + length] === ' ');
        y += 21;
      }
    }
    finishPanel();
    y += 2;
  }
  const history = options.helpHistory ?? { back:[],forward:[] };
  const query = content.topic ? queryFor(content.topic,...content.parameters) : '';
  return { ...content, kind: 'help', nodes: [], edges: [], view: model.views?.[0] ?? { id: 'help', theme: 'light' }, history, query,
    rows, panels, bounds: { x: 0, y: 0, width: 960, height: y + 35 } };
}

function wrapLine(text, length) {
  const chars = [...text];
  if (!chars.length) return [''];
  const result = []; let start = 0;
  while (start < chars.length) {
    let end = start, cells = 0;
    // CJK and fallback glyphs can occupy a full em; reserve two ASCII cells.
    while (end < chars.length && cells + (chars[end].codePointAt(0) > 255 ? 2 : 1) <= length) cells += chars[end++].codePointAt(0) > 255 ? 2 : 1;
    let cut = end;
    if (end < chars.length) {
      while (cut > start + (end - start) / 2 && !/\s/.test(chars[cut])) cut--;
      if (cut <= start + (end - start) / 2) cut = end;
    }
    result.push(chars.slice(start, cut).join('')); start = cut;
    if (chars[start] === ' ') start++;
  }
  return result;
}

let serial = 0;
export function helpSVG(graph, options = {}) {
  const theme = options.theme ?? graph.view.theme;
  if (!['light', 'dark'].includes(theme)) fail('theme must be light or dark');
  const prefix = options.idPrefix ?? `arch-help-${++serial}`;
  if (typeof prefix !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) fail('Invalid idPrefix');
  const dark = theme === 'dark', bg = dark ? '#111827' : '#fafbfe', card = dark ? '#1e293b' : '#ffffff',
    text = dark ? '#e2e8f0' : '#334155', muted = dark ? '#a4b2c7' : '#64748b', accent = dark ? '#a5b4fc' : '#4338ca';
  const { width, height } = graph.bounds;
  const syntaxColors = codePalette(dark);
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const anchor = (query,content,action='follow') => `<a href="${escape(helpHref(query,options.helpBaseURL))}" data-arch-help-query="${escape(query)}" data-arch-help-action="${action}">${content}</a>`;
  const navItem = (label,x,query,action) => {
    const t = `<text x="${x}" y="122" font-size="13" font-weight="650" fill="${query===undefined?muted:accent}">${label}</text>`;
    return query===undefined?t:anchor(query,t,action);
  };
  const parent = graph.parameters.length ? queryFor(graph.topic,...graph.parameters.slice(0,-1)) : undefined;
  const navigation = navItem('← Back',40,graph.history.back.at(-1),'back')+
    navItem('Forward →',115,graph.history.forward.at(-1),'forward')+
    navItem('Reference',218,graph.topic?'':undefined)+
    (parent ? navItem('↑ Up',316,parent) : '');
  const rowSVG = row => {
    const chars = [...row.text];
    const chunk = (start,end) => {
      const value = chars.slice(start,end).join('');
      if (row.format) return sourceTokens(value,row.format).map(token =>
        `<tspan fill="${syntaxColors[token.kind]}">${escape(token.text)}</tspan>`).join('');
      if (row.termsRemaining>start) {
        const next=Math.min(end,row.termsRemaining);
        return `<tspan font-family="${mono}" font-weight="600" fill="${accent}">${escape(chars.slice(start,next).join(''))}</tspan>${escape(chars.slice(next,end).join(''))}`;
      }
      return escape(value);
    };
    let content='',cursor=0;
    for (const {start,end,query} of row.links??[]) {
      content += chunk(cursor,start)+anchor(query,`<tspan fill="${accent}" font-weight="650" text-decoration="underline">${escape(chars.slice(start,end).join(''))}</tspan>`);
      cursor=end;
    }
    content+=chunk(cursor,chars.length);
    const heading = row.kind === 'heading';
    return `<text x="${row.inset?54:40}" y="${row.y}" style="white-space:pre" font-family="${row.format?mono:'system-ui, sans-serif'}" font-size="${heading?18:13}" font-weight="${heading?700:400}" fill="${heading?accent:text}">${content}</text>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="region" tabindex="-1" aria-labelledby="${prefix}-title ${prefix}-desc" data-arch-svg="${theme}" data-arch-help="${escape(graph.topic || 'overview')}">
<title id="${prefix}-title">${escape(graph.title)}</title><desc id="${prefix}-desc">arch.js language reference and registered extensions. Text can be selected and copied.</desc>
<style>[data-arch-help] a{cursor:pointer}[data-arch-help] a:is(:hover,:focus-visible) :is(text,tspan){text-decoration:underline}[data-arch-help] a:focus-visible{outline:2px solid ${accent}}</style>
<rect width="${width}" height="${height}" rx="18" fill="${bg}"/>
<rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14" fill="${card}" stroke="${dark ? '#3b4960' : '#d8dfec'}"/>
<g font-family="system-ui, sans-serif" xml:space="preserve">
<text x="40" y="49" font-size="11" font-weight="700" letter-spacing="1.5" fill="${muted}">ARCH.JS / REFERENCE</text>
<text x="40" y="85" font-size="26" font-weight="700" fill="${accent}">${escape(graph.title)}</text>
${navigation}
<path d="M40 136H920" stroke="${dark ? '#3b4960' : '#e2e8f0'}"/>
${graph.panels.map(panel => `<rect x="40" y="${panel.y}" width="880" height="${panel.height}" rx="8" fill="${bg}"/>`).join('')}
${graph.rows.map(rowSVG).join('\n')}
</g></svg>`;
}
