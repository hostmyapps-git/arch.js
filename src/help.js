import { ArchError } from './errors.js';
import { getIconPacks, getIconNames } from './icons.js';
import { getProfiles, getProfile, resolveProfile, concreteSubtypes, typeConnections, TEMPLATES, EDGE_STYLES, NODE_PROPERTIES, EDGE_PROPERTIES } from './profiles.js';
import { DIAGRAMS, DIAGRAM_OPTIONS } from './diagrams.js';
import { CSS3_COLORS } from './css3-colors.js';
import { escape } from './svg.js';

import { topics, syntax, request, parseHelpCommand, helpDocument } from './help-syntax.js';

const fail = message => { throw new ArchError(message, {}, 'ARCH_HELP'); };
const list = values => values?.length ? values.join(', ') : '(none)';
const pageSize = 100;

function parseHelp(source, options = {}) {
  return { ...helpDocument(parseHelpCommand(source)), profile: resolveProfile({}, options) };
}

function profileFor(model, options, id) {
  const profile = resolveProfile(model, options);
  return id && id !== '.' ? getProfile(id) : profile;
}

export function helpContent(model, options = {}) {
  if (!model || model.kind !== 'help' || !model.help || typeof model.help.topic !== 'string' || !Array.isArray(model.help.parameters)) fail('Invalid help document; use parse("@help").');
  const { topic, parameters: args } = request(model.help?.topic, model.help?.parameters);
  const profile = profileFor(model, options), sections = [];
  const section = (title, ...lines) => sections.push({ title, lines: lines.flat() });
  const selectProfile = () => profileFor(model, options, args[0]);
  const definitions = (key, label) => {
    const p = selectProfile(), entries = Object.entries(p[key]);
    const target = args[0] || '.';
    section(`Profile ${p.id} · ${p.version}`, `Usage: ${syntax(topic)}`, `Without PROFILE, use the selected document/API profile (default: default). ${entries.length} ${label}.`);
    if (args[1]) {
      const rule = p[key][args[1]];
      if (!Object.hasOwn(p[key], args[1])) fail(`Unknown name in ${label}: ${args[1]}. Use @help ${topic} ${target}.`);
      if (key === 'nodeTypes') section('Allowed relationships', `@help connections ${target} ${args[1]}`);
      if (key !== 'viewpoints' && rule.abstract) {
        const candidates = concreteSubtypes(args[1], p[key]);
        section('Concrete subtypes', candidates.length ? candidates.map(name => key === 'nodeTypes'
          ? `${name} ID "Title"  · template ${p[key][name].template}`
          : `relation ID SOURCE -> TARGET "Label" { type ${name} }`) : ['No concrete subtypes are defined in this profile.']);
        section('Candidate details', `@help ${topic} ${target} NAME`, 'These candidates are concrete descendants. Attribute, container, endpoint and viewpoint rules still apply.');
      }
      section(args[1], JSON.stringify(rule, null, 2).split('\n'));
      if (key !== 'viewpoints') section('Built-in attributes', key === 'nodeTypes' ? list(NODE_PROPERTIES) : list(EDGE_PROPERTIES), 'Additional attributes and constraints are listed above under attributes.');
    } else {
      section(label, entries.length ? entries.map(([name, rule]) => key === 'nodeTypes'
        ? `${name}${rule.abstract ? ' [abstract]' : ''} · template ${rule.template}${rule.container ? ' · container' : ''}`
        : key === 'relationTypes' ? `${name}${rule.abstract ? ' [abstract]' : ''} · style ${rule.style} · directions ${(rule.directions??['forward']).join(', ')}` : `${name}${rule.title ? ` · ${rule.title}` : ''}`) : ['(none)']);
      section('Show details', `@help ${topic} ${target} NAME`, 'Use . as PROFILE to inspect the selected document/API profile, including inline definitions.', 'Abstract types support inheritance and cannot be instantiated directly.');
      if (key === 'relationTypes') section('Filter by node type', `@help connections ${target} NODE_TYPE`);
    }
  };

  if (!topic) {
    section('Getting started', 'Write one help command in an arch code block, either on its own or on a separate line inside architecture.',
      'Inside architecture, help replaces the diagram output. The model block is optional in help mode.',
      'Square brackets in this reference indicate optional parameters. Names are case-sensitive.', `Selected profile: ${profile.id} · ${profile.version}`);
    section('Topics', Object.entries(topics).map(([key, [description]]) => `${syntax(key)}  —  ${description}`));
    section('Examples', '@help iconpacks', '@help iconpacks core', '@help profiles', '@help types default service', '@help connections default service', '@help diagrams sequence');
  } else if (topic === 'meta') {
    section('Architecture source views', 'Add view source "Architecture as JSON" { @meta json } or use @meta dsl.',
      'Equivalent JSON view: { "name": "Architecture as JSON", "@meta": "json" }. The meta keyword/field is also accepted.',
      'With config { views all }, diagram and source views render together in one SVG, in the selected order.',
      'An architecture-level @meta json or @meta dsl adds a selectable view named meta-json or meta-dsl.',
      'Source views show the entire normalized architecture, including their own directives exactly once. No recursive rendering.',
      'Only format and theme apply. Filters, viewpoints, diagram settings and node/route styles do not apply.',
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
    section('Complete example', '{ "architecture": {', '  "name": "Portal",', '  "config": { "views": "all" },',
      '  "model": {', '    "elements": {', '      "user": { "type": "person", "name": "User" },', '      "api": { "type": "service", "name": "API" }', '    },',
      '    "relations": { "calls": { "from": "user", "to": "api", "name": "Calls" } }', '  },',
      '  "views": { "overview": { "name": "Overview", "routes": { "curve": "straight" } } }', '} }');
    section('Mapping', 'Architecture, element, relationship and view titles use name. Object keys are IDs.',
      'elements, relations and views may alternatively be arrays with an id in each entry; arrays define explicit order.',
      'Packages nest elements and relations inside the container element. All identifiers and model limits remain unchanged.',
      'Model properties such as description, technology and conveyed are direct fields. An attributes object handles custom names that collide with JSON structure.',
      'place: { ID: { at: [x,y], size: [width,height] } }; style: { ID: { ... } }.',
      'Coordinate expressions are strings: at: ["coverage.x + 20", "vision.y - 40"], via: [["source.right + 40", "target.centerY"]]. size, endpoint and label points remain numeric.',
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
      'Attribute value lists: ["A", "B"]. Include/exclude and routing lists: a, b.');
    section('Complete starter example (default profile)', 'architecture "Portal" {', '  model {', '    person user "User"', '    application app "Portal"', '    relation uses user -> app "Uses" { type flow }', '  }', '  view overview "Overview" { direction right theme light }', '}');
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
      'Warnings: missing required attributes/viewpoints, missing required viewpoint types/relationships, and unmet minimum incoming/outgoing/connection counts.',
      'Unknown/abstract types, invalid values/references, maximum counts, cycles, syntax and structural/renderer errors still block rendering. API validation: "draft" | "strict" overrides config.',
      'validate() returns valid: true, conformant: false and warning diagnostics for an incomplete draft. Use validation: "strict" for a conformance check.');
    section('Containers', 'package platform "Platform" { service api "API" }', 'Only container types in the selected profile support nesting.', 'IDs are document-wide. Relationships reference element IDs.');
  } else if (topic === 'profiles') {
    if (!args.length) section('Registered profiles', getProfiles().map(id => {
      const p = getProfile(id);
      return `${id} · ${p.version} · ${Object.keys(p.nodeTypes).length} node types · ${Object.keys(p.relationTypes).length} relationship types · ${Object.keys(p.viewpoints).length} viewpoints`;
    }));
    else {
      const p = getProfile(args[0]);
      section(p.title, `ID: ${p.id}`, `Version: ${p.version}`, `Default relationship type: ${p.defaultRelation ?? '(none)'}`, `Viewpoint required: ${p.requireViewpoint ? 'yes' : 'no'}`,
        `Node types: ${Object.keys(p.nodeTypes).length}; relationship types: ${Object.keys(p.relationTypes).length}; viewpoints: ${Object.keys(p.viewpoints).length}.`);
      if (p.description) section('Scope', p.description);
      if (p.sources?.length) section('Sources', p.sources);
      if (p.limitations?.length) section('Limits of validation', p.limitations);
      section('Contents and rules', `@help types ${p.id}`, `@help relations ${p.id}`, `@help viewpoints ${p.id}`);
      section('Style groups', Object.entries(p.styleGroups).map(([name, rule]) => `${name}: ${rule.backgroundColor ?? '(neutral)'}`));
    }
    section('Selection and registration', 'config { profile PROFILE }  // inside architecture', 'API options.profile takes precedence over the document profile.',
      'Help lists registered profiles; it does not load files.', '@help config');
  } else if (topic === 'types') definitions('nodeTypes', 'node types');
  else if (topic === 'relations') definitions('relationTypes', 'relationship types');
  else if (topic === 'viewpoints') definitions('viewpoints', 'viewpoints');
  else if (topic === 'connections') {
    const p = selectProfile(), target = args[0] || '.';
    section(`Profile ${p.id} · ${p.version}`, `Usage: ${syntax(topic)}`, 'Use . as PROFILE for the selected document/API profile, including inline definitions.');
    if (!args[1]) section('Choose a node type', `@help connections ${target} NODE_TYPE`, `Available node types: ${list(Object.keys(p.nodeTypes).sort())}`);
    else {
      if (!Object.hasOwn(p.nodeTypes, args[1])) fail(`Unknown node type: ${args[1]}. Use @help types ${target}.`);
      const connections = typeConnections(args[1], p);
      section('Selected node type', `${connections.type}${connections.abstract ? ' [abstract; choose a concrete subtype to instantiate]' : ''}`,
        'The lists include concrete relationship types and concrete counterpart node types, accounting for inheritance and pair exclusions.',
        'Source/target lists describe the written from/to roles. A type allowing both also permits reverse flow on that same relationship.');
      section('Relationship overview', `Outgoing: ${list(connections.outgoing.map(item => item.type))}`,
        `Incoming: ${list(connections.incoming.map(item => item.type))}`);
      for (const direction of ['outgoing', 'incoming']) {
        const lines = connections[direction].flatMap(item => [
          direction === 'outgoing' ? `${item.type}: ${connections.type} -> ${list(item.counterparts)}` : `${item.type}: ${list(item.counterparts)} -> ${connections.type}`,
          `  allowSelf: ${item.allowSelf}; acyclic: ${item.acyclic}; directions: ${item.directions.join(', ')}; details: @help relations ${target} ${item.type}`,
        ]);
        section(direction === 'outgoing' ? 'Outgoing relationships (this type is the source)' : 'Incoming relationships (this type is the target)', lines.length ? lines : ['(none)']);
      }
      section('Model example', 'relation LINK_ID SOURCE_ID -> TARGET_ID "Label" { type RELATION_TYPE }',
        'These lists describe endpoint type compatibility. Required attributes, self-links, cardinalities, cycles, containers and viewpoint rules still apply.',
        'An abstract selected type shows its inherited compatibility; query a concrete subtype for its exact rules.', `@help types ${target} ${connections.type}`);
    }
  }
  else if (topic === 'iconpacks') {
    const names = getIconPacks();
    if (!args.length) section('Registered icon packs', names.map(name => `${name} · ${getIconNames(name).length} icons and aliases`));
    else {
      const [name, filter = '*', page = '1'] = args;
      if (!names.includes(name)) fail(`Unknown icon pack: ${name}. Registered: ${list(names)}.`);
      if (!/^[1-9][0-9]*$/.test(page) || !Number.isSafeInteger(Number(page))) fail('PAGE must be a positive integer.');
      const icons = getIconNames(name).filter(id => filter === '*' || id.toLowerCase().includes(filter.toLowerCase()));
      const pages = Math.max(1, Math.ceil(icons.length / pageSize)), current = Number(page);
      if (current > pages) fail(`Page ${page} does not exist. Valid range: 1–${pages}.`);
      section(`Icon pack ${name}`, `${icons.length} matches · Filter: ${filter} · Page ${current}/${pages} · up to ${pageSize} names per page.`);
      section('Valid icon references', icons.length ? icons.slice((current - 1) * pageSize, current * pageSize).map(id => `${name}.${id}`) : ['(no matches)']);
      if (current < pages) section('Next page', `@help iconpacks ${name} ${JSON.stringify(filter)} ${current + 1}`);
    }
    section('Usage and search', 'icon core.service  // in the model or a view style', '@help iconpacks PACK', '@help iconpacks PACK FILTER', '@help iconpacks PACK "*" 2',
      'FILTER performs a case-insensitive substring search. * lists all names.',
      'Only successfully registered packs are listed. Help does not download packs or access the preview configuration.');
  } else if (topic === 'diagrams') {
    const selected = args.length ? [args[0]] : DIAGRAMS;
    if (selected.some(type => !DIAGRAMS.includes(type))) fail(`Unknown diagram type. Valid types: ${list(DIAGRAMS)}.`);
    const notes = {
      connected: ['Default renderer. Use place, style and route to control the presentation.', 'propertyFields [expression, unit, value] adds actual property rows to cards; place and route remain available.', 'Named tree groups arrange selected sibling nodes automatically within this view. See @help views.'],
      tree: ['Automatic taxonomy/forest layout: parents centered across their ordered children. No place/route blocks in a whole-view tree.',
        'relations: optional relationship-type list (includes subtypes); other edges are omitted from this view.',
        'parentDirection: auto (default; generalization target is parent, otherwise source), source or target.',
        'direction: down (default), up, right or left; orientation is an alias. Choose only one. Direction describes parent-to-child layout, independently of arrow direction.',
        'levelGap/siblingGap: 16–800 pixels (defaults 96/48); level gaps grow for edge labels.',
        'showLabels: true (default) or false. curve: rounded (default) or orthogonal.',
        'Node styles, icons, visibility and minimum sizes work as in connected views. Packages are flat cards; containment is not the hierarchy.',
        'A visible node has at most one hierarchy parent; cycles, self-links, parallel hierarchy links and bidirectional links are errors. Use relations/include/exclude/display none to select a tree, or diagram connected for multiple inheritance.',
        'For mixed layouts use tree ID { nodes [a, b, c] direction up } inside a connected view. External nodes remain visible and can be positioned separately; see @help views.'],
      sequence: ['participants/messages: ordered lists of node/edge IDs.', 'asyncMessages/returns: subsets of messages; a message cannot be both async and return.'],
      state: ['initial: node ID; finals: list of node IDs. Initial has no incoming edges; finals have no outgoing edges.'],
      activity: ['lanes: list of node IDs; laneAttribute: assignment attribute (default owner).', 'decisions/forks require at least two outgoing edges; joins require at least two incoming edges.'],
      matrix: ['rows/columns: lists of node IDs (at most 100 each); relations: relationship types.', 'Without a selection, uses all visible elements/relationships. Cells count relationships in each direction; bidirectional links appear in both cells.'],
      heatmap: ['valueAttribute is required; numeric values between min and max (defaults 0 and 5).', 'parentAttribute is optional; otherwise uses the model hierarchy. colorLow/colorHigh: hex or CSS3 name.'],
      timeline: ['startAttribute/endAttribute: attribute names (defaults start/end).', 'Both ISO date values are required; start must not be after end.'],
      class: ['attributes/methods/functions/interfaces/ports/parameters: lists of element IDs.', 'ownerAttribute/signatureAttribute: attribute names (defaults owner/signature).', 'Parameters belong to methods/functions; other details belong to classes.', 'propertyFields [FIELD, FIELD]: display actual attribute values/reference IDs on each class card; different from member element IDs.', 'place CLASS_ID at (X, Y) supports numeric or calculated absolute view coordinates. Optional size sets minimum dimensions (cards remain at least 380 wide and grow for contents). Unplaced cards keep their automatic row positions.', 'Ports move with their owner and can be coordinate anchors. Details cannot be placed individually. Packages are flat class cards here. Tree groups, route/routes, via and graphical reference connectors remain connected-only.'],
    };
    for (const type of selected) section(type, `diagram ${type}${DIAGRAM_OPTIONS[type].length ? ' { ... }' : ''}`, `Valid options: ${list(DIAGRAM_OPTIONS[type])}`, notes[type]);
    section('Lists and layout', 'Diagram lists use square brackets: participants [user, app].', 'All referenced elements must be visible.', 'place applies to connected and class; route applies to connected only. style is also available in other diagrams.');
  } else if (topic === 'views') {
    section('View', 'view ID "Title" { ... }', 'direction right | down  (default right)', 'theme light | dark  (default light)', 'spacing NUMBER  (24–400; default 80)',
      'include ID, ID  // without include: all elements', 'exclude ID, ID  // exclusions always win, including descendants', 'viewpoint NAME  // from the selected profile', 'referenceDisplay labels | nodes | both  // connected only; otherwise uses profile setting', 'referenceOccurrences shared | perEdge  // graphical references; default shared', 'routes { curve straight }  // defaults for all connected routes; individual route properties win', 'diagram TYPE { ... }  // default connected');
    section('Rendered views', 'config { views all }  // all views in declaration order', 'config { views [detail, overview] }  // selected IDs in this order', 'config { views overview }  // one view', 'Without a selection, the first view is rendered. Multiple views are stacked with headings inside one standalone SVG.', 'API precedence: options.view, then options.views, then config.views, then the first view. The preview dropdown offers Configured views and individual views.');
    section('Named tree layout groups (connected only)', 'tree hierarchy { nodes [phase, vision, goalA, goalB] direction up }',
      'place hierarchy at (300, 0)  // optional group position', 'place capability at (0, 250)  // optional external card position',
      'Each group has its own direction: down (default), up, left or right. orientation is an alias. parentDirection auto/source/target selects hierarchy parents independently of arrow direction.',
      'Other options: relations, levelGap, siblingGap, curve rounded/orthogonal, showLabels. relations selects hierarchy edges; other visible relationships remain drawn and routable.',
      'Multiple groups are allowed. Members must be unique, visible non-container siblings; one node belongs to at most one group. Use include to select view contents and nodes to select group members.',
      'Groups are invisible layout regions, not model elements or packages. Group dimensions are automatic; place GROUP sets its bounding-box origin, relative to the parent package content if nested. Do not place individual members.',
      'External cards use normal connected layout; directly linked top-level cards are aligned beside the group when unplaced. Internal hierarchy edges use automatic tree paths; route overrides remain available.',
      'Route precedence: individual route properties, then group curve/showLabels, then view routes defaults. showLabels controls text; label none hides the entire label. See @help diagrams tree for hierarchy constraints.');
    section('Selection', 'Including a container includes its descendants. Required ancestor containers are added automatically.', 'Edges appear only when both endpoints are visible.', 'Without a view block, the default view is created automatically.', '@help routing', '@help styles', '@help diagrams');
  } else if (topic === 'routing') {
    section('Position and size (connected and class)', 'place ID at (X, Y)', 'place ID at (X, Y) size (WIDTH, HEIGHT)', 'Coordinates: ±10000000; minimum size (160, 96). Connected positions inside containers are relative to their content. Class cards are flat, use absolute coordinates, remain at least 380 wide and grow for contents; details move with their owner.');
    section('Coordinate references and offsets', 'place maritime at (coverage.x + 20, vision.y - 40)',
      'place maritime at (hierarchy.x - maritime.width - 80, vision.y)', 'place second at (first.right + 40, first.y)',
      'Reference fields: x, y (top-left corner), width, height, right, bottom, centerX, centerY. Use visible node or tree group IDs from the same view, including automatically positioned tree members.',
      'Each coordinate supports numbers, references and +, -, *, /. Multiplication/division precede addition/subtraction; equal-precedence operators evaluate left to right. Parentheses override precedence, unary + and - are supported. At most 32 operands and 16 nested parentheses; no executable code. Expressions work in place at and route via; size, endpoint and label points stay numeric.',
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
      'Available fields: from, to, via, curve, label, path, icon, iconPosition, showIcon, showLabel. A target port/point in to applies to relationships; a fraction from 0 to 1 applies to reference connectors. label, icon, iconPosition, showIcon and showLabel apply only to relationship labels.',
      'Specific from/to/via/curve settings replace an inherited free path; an explicit path still controls the complete route. Empty routes {} keeps the existing automatic routing.');
    section('Edge routing (connected only)', 'route EDGE_ID {', '  from right', '  to left', '  via (270, 100), (270, 180)', '  curve rounded', '  label (300, 140)', '}',
      'from/to: auto | top | right | bottom | left, or an absolute point (X, Y).', 'curve: orthogonal | straight | rounded | bezier. With via, bezier requires exactly two control points.', 'path "M 0 0 L 100 100" replaces the calculated path; label (X, Y) positions the edge label; label none hides its text, frame and icon.');
    section('Calculated via points', 'route EDGE_ID { via (source.right + 40, source.centerY), (target.x - 40, target.centerY) }',
      'route information -> EDGE_ID { via (information.centerX, information.y - 40), (target.x - 40, target.centerY) curve bezier }',
      'routes { via ((source.x + target.x) / 2, source.y - 60) }',
      'via accepts the same node/group fields, +, -, *, /, parentheses and numeric limits as place. Literal numbers and expressions may be mixed. Defaults resolve after specific route overrides; a local via replaces the whole default point list.',
      'All via values are absolute view coordinates, including inside packages. Nodes, package sizes and tree groups resolve first; via resolves immediately before routing. Explicit path replaces via. Endpoint points, label positions and size remain numeric.',
      'Only visible nodes and groups in this view can be used; relationship IDs and other routes are not coordinate anchors. Graphical reference cards used as anchors become canonical cards in normal layout, also with perEdge occurrences. Other reference cards retain automatic placement.',
      'A hidden carrying edge or a hidden reference card does not evaluate its unused via. Unknown IDs and invalid arithmetic are still rejected in stored routes. Constant zero divisors fail validation; layout-dependent zero divisors fail during rendering.',
      'JSON: "via": [["source.right + 40", "target.y - 20"], ["target.x - 40", "target.centerY"]]. Source/meta exports preserve expressions.');
    section('Independent label fields', 'routes { icon core.cloud showIcon true showLabel false }', 'route EDGE_ID { showIcon false showLabel true }', 'showIcon and showLabel are booleans (default true). showLabel controls visible text; showIcon controls the configured icon. Both false removes the label frame. label none hides the entire label regardless of these switches.');
    section('Hide relationship labels', 'routes { label none }', 'route EDGE_ID { label none }', 'A local label (X, Y) overrides a global label none and shows the label again, including any inherited icon. Hidden labels occupy no layout space; relationship titles and references remain in the model and edge tooltip.');
    section('Hide entire relationships', 'style EDGE_ID { display none }', 'style EDGE_ID { display standard }',
      'View-local presentation only: hide the path, label/icon and carried reference connectors. Hidden relationships still count for profile/model constraints. Matrices omit their cells; explicit sequence message lists skip hidden messages.',
      'Relationship styles accept only display none or standard. Other presentation fields belong in route EDGE_ID.');
    section('Icons on relationship labels', 'routes { icon core.cloud iconPosition left }', 'route EDGE_ID { icon core.shield iconPosition top }',
      'icon: PACK.NAME from a registered pack, or none to disable an inherited icon. iconPosition: top | left | bottom | right (default left).',
      'Icons appear inside the label frame relative to its text. Layout reserves space for the icon, multiline text and export bounds. An icon also works without label text.',
      'Local route settings override view defaults per property. Label icons do not apply to reference connectors or change node icon positions.');
    section('Reference connector routing (connected only)', 'route NODE_ID -> EDGE_ID {', '  from bottom', '  to 0.5', '  via (400, -80), (400, 100)', '  curve rounded', '}',
      'NODE_ID must be a graphical reference of EDGE_ID, configured by the profile referenceLabels. Works with shared and perEdge cards.',
      'from: a card port (auto, top, right, bottom, left) or an absolute point. to: fraction from 0 (relationship source) to 1 (target), measured along the rendered relationship path. Default: automatic attachment position.',
      'via and curve work like ordinary edge routes. Manual routes replace automatic obstacle avoidance. Coordinates are absolute, including inside containers.',
      'path "M 0 0 L 100 100" overrides the whole connector, including its endpoints. No connector label is supported.',
      'Hidden references, hidden carrying relationships and labels-only presentation do not draw connectors; their stored routes remain available.');
  } else if (topic === 'styles') {
    section('Property fields on cards', 'propertyFields [expression, unit, value]  // view-wide', 'style criterion { propertyFields [expression] }', 'style measure { propertyFields [unit, value] }',
      'Available in connected, tree and class views. diagram connected/tree/class { propertyFields [...] } supplies diagram defaults. Precedence: node style, view, diagram. [] clears a selection.',
      'Names are declared attributes or public properties (id, type, title, description, technology, stereotype, tags). Each card shows only values it has, including 0, false and lists. Unknown names are errors. Text wraps and cards grow before placement/routing; packages reserve header space for their rows.',
      'Connected cards retain templates, icons, place, routes, tree groups and reference cards. Logo display hides all text including properties. Property visibility is independent of showLabel/showDescription. Class details cannot have their own propertyFields style; configure the owner card.',
      'Class cards retain compartments and accept place with calculated coordinates. Routes remain automatic; route/routes/via are not supported in class views.');
    section('Hide nodes, packages or relationships', 'style ELEMENT_ID { display none }', 'style ELEMENT_ID { display standard }',
      'Node hiding removes the card and all incident relationships. Packages also hide their descendants, even when explicitly included. Hidden reference cards/connectors are omitted.',
      'Relationship hiding removes the line, label/icon and carried reference connectors. It does not remove the relationship from model/profile validation.',
      'Presentation only, local to the view; structural renderer and profile requirements still apply. Node display none works in all diagram renderers. Other relationship styles belong in route EDGE_ID.');
    section('View style', 'style NODE_ID {', '  template component', '  icon core.service', '  accent SlateBlue', '  backgroundColor Gold', '  opacity 0.45', '}',
      'Valid fields: template, icon, iconPosition, accent, backgroundColor, opacity, display, fontSize, width, height, showIcon, showLabel, showStereotype, showDescription, showTechnology, propertyFields.', 'fontSize: title size from 6 to 64 (default 15); other node texts scale proportionally. width/height: minimum dimensions (at least 160/96). These overrides require a connected view and take precedence over place size; content may increase height.', 'The type/stereotype badge stays on one line with an ellipsis when needed; its tooltip keeps the complete text.', 'display logo: connected view, non-container elements; show only a rectangle and an aspect-preserving icon. Centered by default; iconPosition aligns it inside the padded rectangle. display standard restores the usual card. Accessible title/type remain present.', 'Containers use template package; other elements use a non-container template.', 'opacity: number from 0 to 1, applied to fills only. Text, icons and borders remain opaque.', 'Default: 0.2 with an explicit background, otherwise 1.');
    section('Node icon placement and visible fields', 'style NODE_ID { iconPosition right showStereotype false showDescription false }', 'iconPosition: top | left | bottom | right. Default: existing template placement; logo display stays centered unless a side is chosen. Package icons stay inside the header. Text and card/header sizes adapt to the placement.', 'showIcon, showLabel, showStereotype, showDescription, showTechnology: true | false (default true). showLabel controls the node title. Hidden fields reserve no text space; model values and accessible tooltips remain present.', 'Use standard display for independent text/icon visibility. Logo display still hides all text; showIcon false leaves its rectangle. These options require connected views and also apply to graphical reference cards.');
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
    section('Select a registered profile', 'architecture "Title" {', '  config { profile PROFILE }', '  model { ... }', '}', 'options.profile overrides this selection. Register external profiles before rendering.');
    section('View selection', 'config { views all }', 'config { profile PROFILE views [overview, detail] }', 'views accepts all, a view ID, or a nonempty unique list of IDs. Combine it with a registered or inline profile. Multiple selected views render below each other inside one SVG; view titles become headings.');
    section('Custom inline profile', 'config {', '  type actor { template person }', '  type product {', '    template application', '    attribute owner { type string required true }', '  }', '  relation uses { from actor to product style flow }', '  defaultRelation uses', '}',
      'Choose either config profile or an inline definition. Inline profiles are not registered globally.');
    section('Inline rule fields', 'Profile: id, title, version, extends, defaultRelation, requireViewpoint.', 'type: extends, template, container, abstract, contains, icon, accent, backgroundColor, styleGroup, attribute/attributes.',
      'relation: extends, style, abstract, from, to, directions [forward, both], allowSelf, acyclic, incoming/outgoing { min ... max ... }, attribute/attributes.',
      'attribute: type, required, enum, min, max, minLength, maxLength, format, many, minItems, maxItems, uniqueItems, targets.',
      'Attribute types: string, number, integer, boolean, reference. Formats: date, date-time, uri.',
      'viewpoint: nodes, relations, requiredNodes, requiredRelations. styleGroup: backgroundColor.',
      'Multiple inheritance: extends A, B. Profile extends has exactly one registered parent.',
      'JSON profiles also support comparisons, pairs and connections. Details: @help types/relations/viewpoints PROFILE NAME.');
    section('Validation mode', 'config { profile naf41-uaf validation draft }', 'validation strict is the default. Draft renders safely incomplete models and lists remaining requirements below the diagram. See @help model.');
  } else if (topic === 'api') {
    section('Queries and rendering', 'arch.help("types default service", options) → help text', 'arch.parse(source, options) → architecture or help document', 'arch.validate(sourceOrModel, options) → { valid, profile, diagnostics }',
      'arch.layout(sourceOrModel, options) → layout with bounds', 'arch.renderToString(sourceOrModel, options) → SVG string', 'arch.render(target, sourceOrModel, options) → SVG DOM element', 'arch.renderAll({ root, selector, ...options }) → rendered SVG elements', 'arch.renderMarkdown(markdown, options) → HTML with inline SVG');
    section('Registration', 'arch.registerProfile(name, definition)', 'arch.getProfiles() → registered IDs', 'arch.getProfile(name) → independent profile copy', 'arch.registerIconPack(name, data)  // Iconify or converted paths', 'arch.getIconPacks() → registered pack names', 'arch.renderIconToString("PACK.NAME", { size, title, idPrefix })');
    section('Options', 'profile: registered profile ID or profile object; also applies to @help types/relations/viewpoints without an explicit ID.', 'validation: strict | draft; overrides config.validation. Incomplete drafts have warning diagnostics and conformant: false; layout returns kind notices with content and enlarged bounds.', 'view: one view ID; views: all, a view ID or an array of IDs. Precedence: view > views > config.views > first view.', 'theme: light | dark (overrides all selected views); idPrefix: unique SVG ID prefix. Multiple views return one SVG. layout returns kind views with layouts/sections and overall bounds; single-view layout stays unchanged.', 'Help uses the help view. Registration does not load URLs. renderAll isolates errors per block.');
  }
  return { topic, profile, title: topic ? `Help · ${topic}` : 'arch.js · Help', sections };
}

export function help(query = '', options = {}) {
  if (typeof query !== 'string') fail('Help query must be a string.');
  const model = parseHelp(`@help${query ? ` ${query}` : ''}`, options), content = helpContent(model, options);
  return [content.title, ...content.sections.flatMap(s => ['', s.title, ...s.lines])].join('\n');
}

// Monospace lines preserve copyable examples and JSON indentation. No HTML or
// foreignObject is needed, so exported help remains a standalone SVG.
export function layoutHelp(model, options = {}) {
  const content = helpContent(model, options);
  if (options.view !== undefined && options.view !== 'help') fail(`Unknown view: ${options.view}`);
  const rows = []; let y = 112;
  const clean = text => String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu, '\ufffd');
  for (const section of content.sections) {
    y += 24;
    for (const line of wrapLine(clean(section.title), 78)) { rows.push({ kind: 'heading', text: line, y }); y += 25; }
    y += 6;
    for (const line of section.lines) for (const part of wrapLine(clean(line), 104)) { rows.push({ kind: 'body', text: part, y }); y += 21; }
    y += 2;
  }
  return { ...content, kind: 'help', nodes: [], edges: [], view: model.views?.[0] ?? { id: 'help', theme: 'light' },
    rows, bounds: { x: 0, y: 0, width: 960, height: y + 35 } };
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" data-arch-svg="${theme}" data-arch-help="${escape(graph.topic || 'overview')}">
<title id="${prefix}-title">${escape(graph.title)}</title><desc id="${prefix}-desc">arch.js language reference and registered extensions. Text can be selected and copied.</desc>
<rect width="${width}" height="${height}" rx="18" fill="${bg}"/>
<rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14" fill="${card}" stroke="${dark ? '#3b4960' : '#d8dfec'}"/>
<g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" xml:space="preserve">
<text x="40" y="49" font-size="11" font-weight="700" letter-spacing="1.5" fill="${muted}">ARCH.JS / REFERENCE</text>
<text x="40" y="85" font-size="26" font-weight="700" fill="${accent}">${escape(graph.title)}</text>
<path d="M40 104H920" stroke="${dark ? '#3b4960' : '#e2e8f0'}"/>
${graph.rows.map(row => `<text x="40" y="${row.y}" style="white-space:pre" font-size="${row.kind === 'heading' ? 17 : 13}" font-weight="${row.kind === 'heading' ? 650 : 400}" fill="${row.kind === 'heading' ? accent : text}">${escape(row.text)}</text>`).join('\n')}
</g></svg>`;
}
