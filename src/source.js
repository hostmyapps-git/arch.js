import { ArchError, parseDocument, validate as validateModel } from './parser.js';
import { errorDiagnostic } from './errors.js';
import { diagnosticProfile, rememberDiagnosticProfile } from './diagnostic-help.js';
import { jsonToDSL, isJSONDocument } from './json.js';
import { resolveProfile, getProfiles, getProfileVersions, matches, NODE_PROPERTIES, EDGE_PROPERTIES } from './profiles.js';
import { DIAGRAMS, DIAGRAM_OPTIONS } from './diagrams.js';
import { topics } from './help-syntax.js';
import {POSITION_FIELDS} from './placement.js';
import { similarNames } from './spelling.js';

const copy = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.hasOwn(value, key);
const sourceFormat = source => isJSONDocument(source) || typeof source === 'string' && /^\s*[\[{]/.test(source) ? 'json' : 'dsl';
const clean = value => JSON.parse(JSON.stringify(value, (key, value) => ['loc', 'attributeLocs','_explicit'].includes(key) ? undefined : value));
const collection = entries => new Set(entries.map(([id]) => id)).size === entries.length
  ? Object.fromEntries(entries) : entries.map(([id, value]) => ({id, ...value}));

function jsonSource(model) {
  if (model.kind === 'help' && !model.config && model.title === 'arch.js Help') {
    return {'@help': [model.help.topic, ...model.help.parameters.map(p => JSON.stringify(p))].join(' ').trim()};
  }
  const a = {name: model.title};
  if (model.description) a.description = model.description;
  if (model.config) {
    const config = {}, original = model.config;
    if (own(original, 'profile')) config.profile = original.profile;
    if (own(original, 'views')) config.views = copy(original.views);
    if (own(original, 'presentation')) config.presentation = original.presentation;
    if(own(original,'showValidation'))config.showValidation=original.showValidation;
    if (own(original, 'syntaxRecovery')) config.syntaxRecovery = original.syntaxRecovery;
    if (own(original, 'validation')) config.validation = original.validation;
    if (original.definition) {
      for (const [key, value] of Object.entries(original.definition)) {
        const mapped = {nodeTypes:'type', relationTypes:'relation', viewpoints:'viewpoint', styleGroups:'styleGroup'}[key];
        if (mapped) {
          if (Object.keys(value).length) config[mapped] = Object.fromEntries(Object.entries(value).map(([name, rule]) => {
            const result = copy(rule);
            if (result.attributes) { result.attribute = result.attributes; delete result.attributes; }
            return [name, result];
          }));
        } else config[key] = copy(value);
      }
    }
    a.config = config;
  }
  if (model.kind === 'help') {
    a['@help'] = [model.help.topic, ...model.help.parameters.map(p => JSON.stringify(p))].join(' ').trim();
    return {architecture: a};
  }
  const props = (item, builtins, reserved) => {
    const result = Object.create(null);
    for (const key of builtins) if (own(item, key)) result[key] = copy(item[key]);
    for (const [key, value] of Object.entries(item.attributes ?? {})) {
      if (reserved.includes(key)) { result.attributes ??= Object.create(null); result.attributes[key] = copy(value); }
      else result[key] = copy(value);
    }
    return result;
  };
  const ancestors = new Set(), childrenByParent = new Map();
  for (const node of model.nodes) {
    const parent = node.parent ?? null;
    let children = childrenByParent.get(parent);
    if (!children) childrenByParent.set(parent,children = []);
    children.push(node);
  }
  const nodes = parent => (childrenByParent.get(parent) ?? []).map(n => {
    if (ancestors.has(n.id)) throw new ArchError(`Cannot translate cyclic or ambiguous package ID: ${n.id}`, n.loc, 'ARCH_VALIDATION');
    ancestors.add(n.id);
    const result = {type:n.type, name:n.title, ...props(n, NODE_PROPERTIES, ['id','type','name','elements','relations','attributes'])};
    const children = nodes(n.id); if (children.length) result.elements = collection(children);
    ancestors.delete(n.id); return [n.id,result];
  });
  a.model = {elements: collection(nodes(null))};
  if (model.edges.length) a.model.relations = collection(model.edges.map(e => [e.id, {
    from:e.source, to:e.target, name:e.title, ...(e.type !== undefined ? {type:e.type} : {}),
    ...props(e, EDGE_PROPERTIES, ['id','from','to','name','type','direction','attributes'])
  }]));
  const places = rules => Object.fromEntries(Object.entries(rules).map(([id, rule]) => [id, {
    ...(rule.relative ? { relative:clean(rule.relative) } : { at:[rule.at.x, rule.at.y] }),
    ...(rule.size ? { size:[rule.size.x, rule.size.y] } : {}),
  }]));
  a.views = collection(model.views.map(v => {
    const result = {name:v.title};
    if(v.meta!==undefined)result['@meta']=v.meta;
    for (const key of ['extends','direction','theme','spacing','viewpoint','represents','include','exclude','referenceDisplay','referenceOccurrences','diagram','propertyFields','backgroundImage','showBackgroundImage']) if (v[key] !== undefined && !(v.extends&&['direction','theme','spacing'].includes(key)&&v._explicit&&!v._explicit.includes(key))) result[key] = clean(v[key]);
    if (Object.keys(v.places).length) result.place = places(v.places);
    if (Object.keys(v.virtualPlaces??{}).length) result.virtualPlace = places(v.virtualPlaces);
    if (Object.keys(v.styles).length) result.style = clean(v.styles);
    if(v.embeds)result.embed=clean(v.embeds);
    if(v.trees)result.tree=clean(v.trees);
    const route = item => Object.fromEntries(Object.entries(item).filter(([key]) => !['loc','nodeId','edgeId'].includes(key)).map(([key,value]) => [key,
      key === 'via' ? value.map(p=>[p.x,p.y]) : value && typeof value === 'object' && own(value,'x') ? [value.x,value.y] : value]));
    if (v.routeDefaults) result.routes = route(v.routeDefaults);
    if (Object.keys(v.virtualRoutes??{}).length) result.virtualRoute=Object.fromEntries(Object.entries(v.virtualRoutes).map(([id,r])=>[id,route(r)]));
    if (Object.keys(v.routes).length || v.referenceRoutes?.length) result.route = Object.fromEntries([
      ...Object.entries(v.routes).map(([id,r])=>[id,route(r)]),
      ...(v.referenceRoutes??[]).map(r=>[`${r.nodeId} -> ${r.edgeId}`,route(r)])
    ]);
    return [v.id,result];
  }));
  return {architecture:a};
}

function prettyDSL(source) {
  const lines = source.split('\n'), result = []; let depth = 0;
  for (let i=0;i<lines.length;i++) {
    let line=lines[i].trim();
    if (lines[i+1]?.trim()==='{') {line+=' {';i++;}
    if(line.endsWith('{') && lines[i+1]?.trim()==='}') {line+='}';i++;}
    if(line==='}')depth--;
    result.push('  '.repeat(Math.max(0,depth))+line);
    if(line.endsWith('{'))depth++;
  }
  return result.join('\n')+'\n';
}

export function translate(source, options = {}) {
  const format = options.format ?? (sourceFormat(source)==='json'?'dsl':'json');
  if (!['dsl','json'].includes(format)) throw new ArchError('Translation format must be dsl or json');
  const model = parseDocument(source);
  const output = format === 'dsl' && sourceFormat(source)==='json' ? prettyDSL(jsonToDSL(source).source) : modelSource(model,format);
  if(output.length>2_000_000)throw new ArchError('Translated source exceeds 2 MB; split the architecture into smaller documents');
  return output;
}

export function modelSource(model,format) {
  if(!['dsl','json'].includes(format))throw new ArchError('Translation format must be dsl or json');
  return formatSource(jsonSource(model),format);
}

export function modelSources(model) {
  const source = jsonSource(model);
  return {dsl:formatSource(source,'dsl'),json:formatSource(source,'json')};
}

function formatSource(source,format) {
  const output=format==='json'?JSON.stringify(source,null,2)+'\n':prettyDSL(jsonToDSL(source).source);
  if(output.length>2_000_000)throw new ArchError('Translated source exceeds 2 MB; split the architecture into smaller documents');
  return output;
}

const styleKeys = ['template','accent','icon','iconPosition','backgroundColor','backgroundImage','showBackgroundImage','opacity','display','fontSize','width','height','showIcon','showLabel','showStereotype','showDescription','showTechnology','propertyFields'];
const routingKeys = ['source','target','from','to','via','curve','path','label','icon','iconPosition','showIcon','showLabel','sharePath','color','width','dasharray','crossings','crossingRadius','avoidObstacles'];
const viewKeys = ['extends','embed','name','@meta','meta','diagram','tree','direction','theme','spacing','viewpoint','represents','include','exclude','place','virtualPlace','style','routes','route','virtualRoute','referenceDisplay','referenceOccurrences','propertyFields','backgroundImage','showBackgroundImage'];
const configKeys = ['showValidation','syntaxRecovery','profile','views','presentation','validation','id','title','version','extends','defaultRelation','requireViewpoint','type','relation','viewpoint','styleGroup'];
const profileKeys = ['extends','template','container','abstract','contains','attribute','attributes','icon','accent','backgroundColor','styleGroup','from','to','directions','style','allowSelf','acyclic','sequenceContext','incoming','outgoing','nodes','relations','requiredNodes','requiredRelations'];
function jsonKeys(path='') {
  if(path==='/architecture')return ['name','description','config','model','views','@help','@meta'];
  if(path==='/architecture/model')return ['elements','relations'];
  if(path==='/architecture/config')return configKeys;
  if(/\/style\/[^/]+$/.test(path))return styleKeys;
  if(/\/tree\/[^/]+$/.test(path))return ['nodes',...DIAGRAM_OPTIONS.tree];
  if(/\/(?:route\/[^/]+|routes)$/.test(path))return routingKeys;
  if(/\/virtualRoute\/[^/]+$/.test(path))return ['from','to','via','curve'];
  if(/\/(?:place|virtualPlace)\/[^/]+\/relative\/align$/.test(path))return ['to'];
  if(/\/(?:place|virtualPlace)\/[^/]+\/relative$/.test(path))return ['side','of','gap','align'];
  if(/\/place\/[^/]+$/.test(path))return ['at','relative','size'];
  if(/\/virtualPlace\/[^/]+$/.test(path))return ['at','relative'];
  if(/\/views\/[^/]+$/.test(path))return viewKeys;
  return path===''?['architecture','@help']:undefined;
}

function corrections(diagnostic, model, source, format, options) {
  const candidates=[], message=diagnostic.message.split(' (JSON path ')[0];
  const tokenAtError = typeof source === 'string' && diagnostic.line
    ? source.split('\n')[diagnostic.line-1]?.slice(Math.max(0,(diagnostic.column??1)-1)).match(/^[A-Za-z_][A-Za-z0-9_.-]*/)?.[0] : '';
  const add=(label,example,detail='')=>{if(!candidates.some(c=>c.label===label))candidates.push({label,example,detail});};
  const nearest=(bad,values,label='Use')=>similarNames(bad,values,6).forEach(value=>add(`${label} ${value}`,value));
  let profile;
  try { profile=resolveProfile(model??{},options); } catch { /* Syntax repair does not require a loaded profile. */ }
  const found=message.match(/Unknown (?:element|relationship|node) type (?:in profile [^:]+: )?([^\s(]+)/);
  if(found&&profile)nearest(found[1],Object.keys(message.includes('relationship')?profile.relationTypes:profile.nodeTypes),'Type');
  if(Array.isArray(diagnostic.candidates)) for(const type of diagnostic.candidates.slice(0,8)) add(`Use concrete type ${type}`,format==='json'?`"type": "${type}"`:`${type} ${diagnostic.elementId??'element'} "Title"`);
  const unknownProfile=message.match(/Unknown profile: ([^\s(]+)/);
  if(unknownProfile)nearest(unknownProfile[1],getProfiles().flatMap(id=>[id,...getProfileVersions(id).map(version=>`${id}@${version}`)]),'Registered profile');
  if (diagnostic.viewId && /requires a viewpoint/.test(message) && profile) {
    const match = Object.keys(profile.viewpoints).find(id => id.toLowerCase()===diagnostic.viewId.toLowerCase());
    if (match) add(`Use viewpoint ${match}`,format==='json'?`"viewpoint": "${match}"`:`viewpoint ${match}`);
  }
  const unknownKey=message.match(/Unknown (?:JSON field|view option|routing attribute|attribute rule|profile rule|config option|attribute): ([^\s(]+)/);
  if(unknownKey) {
    const key=unknownKey[1], parent=diagnostic.path?.replace(/\/[^/]*$/,'');
    const contextual=message.includes('routing')?routingKeys:message.includes('view option')?viewKeys.filter(k=>k!=='name'):message.includes('config')?configKeys:message.includes('attribute rule')?['type','required','enum','min','max','minLength','maxLength','format','targets','many','minItems','maxItems','uniqueItems']:message.includes('profile rule')?profileKeys:styleKeys;
    const values=format==='json'&&diagnostic.path?jsonKeys(parent)??contextual:contextual;
    nearest(key,values,'Field');
  }
  const endpoint=message.match(/Unknown (?:endpoint|reference element|element in view [^:]+): ([^\s(]+)/);
  if(endpoint&&model)nearest(endpoint[1],model.nodes.map(n=>n.id),'Element ID');
  const missing=message.match(/Missing required attribute (\w+)/);
  if(missing) {
    const item=model?.nodes.find(n=>n.id===diagnostic.elementId)??model?.edges.find(e=>e.id===diagnostic.elementId);
    const rule=(profile?.nodeTypes[item?.type]??profile?.relationTypes[item?.type])?.attributes?.[missing[1]];
    const value=rule?.enum?.[0]??(rule?.type==='boolean'?true:['number','integer'].includes(rule?.type)?rule.min??0:rule?.type==='reference'?model?.nodes.find(n=>!rule.targets||matches(n.type,rule.targets,profile.nodeTypes))?.id??'elementId':'value');
    const serialized=JSON.stringify(rule?.many?[value]:value);
    add(`Provide ${missing[1]}`,format==='json'?`"${missing[1]}": ${serialized}`:`${missing[1]} ${serialized}`,'Check the attribute type and profile constraints.');
  }
  const edgeDirection=/forward or both|does not allow direction/.test(message)||/\/relations\//.test(diagnostic.path??'');
  for(const [term,values] of [['validation',['strict','draft']],['parentDirection',['auto','source','target']],['orientation',['down','right','up','left']],['direction',edgeDirection?['forward','both']:/must be.*up/.test(message)?['down','right','up','left']:['right','down']],['theme',['light','dark']],['iconPosition',['top','left','bottom','right']],['referenceDisplay',['labels','nodes','both']],['referenceOccurrences',['shared','perEdge']],['curve',['straight','orthogonal','rounded','bezier']]])
    if(message.includes(term)&&(message.includes('must')||message.includes('Unknown')))for(const value of values)add(`${term}: ${value}`,format==='json'?`"${term}": "${value}"`:`${term} ${value}`);
  if(/spacing must/.test(message))add('Use spacing between 24 and 400',format==='json'?'"spacing": 80':'spacing 80');
  if(/Port\/attachment position|Port position|Positioned port/.test(message))add('Use a side position between 0 and 1',format==='json'?'"from": {"side":"bottom","position":"1/2"}':'from bottom 1/2','Use top/right/bottom/left with a decimal, fraction or expression. A reference connector target uses to 1/2 along the relationship.');
  if(/Division by zero in placement coordinate/.test(message))add('Use a nonzero denominator','1/2','Choose a denominator that is nonzero for the final layout.');
  if(/style (?:expression|reference|dependency)|explicit style value/i.test(message))add('Use a numeric style or an independent node dimension',format==='json'?'"height": "2 * source.height"':'height 2 * source.height','Use width, height or fontSize; ID.style.FIELD requires an explicitly set style. Break cycles with a numeric value.');
  const allowedDirections=message.match(/allowed directions: (forward|both)(?:, (forward|both))?/);
  if(allowedDirections)for(const value of allowedDirections.slice(1).filter(Boolean))add(`Use ${value==='both'?'<->':'->'}`,format==='json'?`"direction": "${value}"`:`relation LINK_ID SOURCE_ID ${value==='both'?'<->':'->'} TARGET_ID "Label"`,'Use a direction allowed by the selected relationship type.');
  if(/Unknown diagram type/.test(message))nearest(message.split(' ').at(-1),DIAGRAMS,'Diagram');
  const diagramOption=message.match(/Option (\w+) does not apply to (\w+)/);
  if (diagramOption?.[1]==='dated' && diagramOption[2]==='timeline')
    add('Show only dated elements',format==='json'?'"datedOnly": true':'datedOnly true');
  if(diagramOption)nearest(diagramOption[1],DIAGRAM_OPTIONS[diagramOption[2]]??[],'Diagram field');
  if(/Duplicate (?:JSON key|ID|view ID)/.test(message))add('Use a unique name or ID',format==='json'?'"newId": { "name": "Title" }':'service newId "Title"','Rename the duplicate and update references, or combine its properties.');
  if(/Unknown attribute for/.test(message)&&profile) {
    const match=message.match(/Unknown attribute for ([^:]+): ([^\s(]+)/),rule=profile.nodeTypes[match?.[1]]??profile.relationTypes[match?.[1]];
    if(match)nearest(match[2],[...Object.keys(rule?.attributes??{}),...NODE_PROPERTIES,...EDGE_PROPERTIES],'Attribute');
  }
  if(format==='json'&&/Invalid JSON/.test(message)) {
    add('Use double-quoted property names and strings','{ "architecture": { "name": "Test", "model": {} } }');
    if(/comma|property name|after property|after array|after JSON|Unexpected/.test(message))add('Check commas and closing brackets','"name": "Test",\n"model": {}','Separate object properties with commas; remove a comma before } or ].');
    if(/end|unterminated|Expected.*[}\]]/i.test(message))add('Close the string, object or array','{ "architecture": { "name": "Test", "model": {} } }','Match each opening quote/bracket with its closing character.');
  }
  if(/Missing model block/.test(message))add('Add a model block',format==='json'?'"model": {}':'model { }');
  if(/Unclosed block/.test(message))add('Close the block','}','Add the missing closing brace after its contents.');
  if(/Unclosed string|Invalid string/.test(message))add('Use a closed, escaped string','"Title with \\"quotes\\""','Close the double quote; escape inner quotes with \\".');
  if(/Expected: architecture/.test(message))add('Start an architecture document','architecture "Test" {\n  model {}\n}');
  if(/Expected: (?:element title|architecture title|relationship label|view title)/.test(message))add('Quote the title','"Title"');
  if(/Expected: model, view, config/.test(message))nearest(tokenAtError??'',['model','view','config','description']);
  if(/Expected: at|at or placement side/.test(message)) {
    add('Specify fixed coordinates','place elementId at (0, 0)');
    add('Place relative to a visible card','place elementId right of anchor gap 24');
  }
  if(/placement coordinate|Placement expressions require/.test(message)) {
    add('Use a box field with an offset',format==='json'?'"at": ["coverage.x + 20", "vision.y - 40"]':'place elementId at (coverage.x + 20, vision.y - 40)',`Allowed fields: ${POSITION_FIELDS.join(', ')}. Operators: +, -, *, /; multiplication/division precede addition/subtraction. Parentheses group calculations.`);
    add('Use fixed coordinates',format==='json'?'"at": [0, 0]':'place elementId at (0, 0)');
    if(/Placement expressions require/.test(message))add('Separate the two coordinates',',','Use (x, y), with a comma between coordinates; use +, -, * or / within an expression.');
  }
  if(/Division by zero/.test(message))add('Choose a nonzero divisor',format==='json'?'"at": ["coverage.x / 2", 0]':'place elementId at (coverage.x / 2, 0)','Check calculated denominators as well as literal zero.');
  if(/calculation must remain finite/.test(message))add('Reduce the calculation magnitude','100 * 2','Keep intermediate calculations finite and final coordinates within ±10000000.');
  if(/Circular placement dependency/.test(message))add('Break the dependency with a fixed coordinate',format==='json'?'"at": [300, 0]':'place elementId at (300, 0)','Follow the coordinate chain in the error. Tree members depend on their group; package sizes depend on their children.');
  const placementReference=message.match(/Unknown or hidden placement reference: ([^;]+)/);
  if(placementReference&&model)nearest(placementReference[1],[...model.nodes.map(n=>n.id),...model.views.flatMap(v=>Object.keys(v.trees??{}))],'Visible element/group');
  const viaReference=message.match(/(?:Unknown|Hidden or excluded|Unavailable) via reference: ([^;]+)/);
  if(viaReference&&model)nearest(viaReference[1],[...model.nodes.map(n=>n.id),...model.views.flatMap(v=>Object.keys(v.trees??{}))],'Visible via anchor');
  if(/Expected: ->/.test(message))add('Connect the endpoints with ->','relation flow sourceId -> targetId "Label"');
  if(/Expected an object/.test(message))add('Use an object for this block',format==='json'?'{}':'model {}');
  if(/Expected a coordinate pair/.test(message))add('Use two numeric coordinates','[0, 0]');
  if(/Expected a string/.test(message))add('Provide a double-quoted string','"Title"');
  if(/Expected an identifier|Expected: identifier/.test(message))add('Use a declared identifier','elementId','Start with a letter or underscore; use letters, digits, _, . and -.');
  const punctuation=message.match(/^Expected: ([(){}\[\],])/);
  if(punctuation)add(`Insert ${punctuation[1]}`,punctuation[1],'Check the surrounding block, list or coordinate pair.');
  if(/Expected: number/.test(message))add('Use a numeric value','0','Coordinates use (x, y) in DSL and [x, y] in JSON.');
  if(/Unicode character that is invalid in SVG/.test(message))add('Remove the invalid control or surrogate character','"Readable title"','Use valid Unicode text without isolated surrogate code units or forbidden control characters.');
  if(/Unknown help topic/.test(message))nearest('',Object.keys(topics),'Help topic');
  if(/@meta|meta must be/.test(message))for(const format of ['json','dsl'])add(`Show architecture as ${format.toUpperCase()}`,`@meta ${format}`,'Place the directive inside an architecture or view.');
  if(/requires the connected renderer|only supported for connected/.test(message))add('Use a connected view',format==='json'?'"diagram": "connected"':'diagram connected','Alternatively remove Connected-only presentation options from this view.');
  if(!candidates.length)add('Compare with a valid example',format==='json'?'{ "architecture": { "name": "Test", "model": {} } }':'architecture "Test" {\n  model {}\n}','Inspect @help syntax, @help json, or the selected profile. Suggested examples require review.');
  return candidates.slice(0,8);
}

export function inspectSource(source, options = {}) {
  const format=sourceFormat(source),target=options.format??(format==='json'?'dsl':'json');
  const result={sourceFormat:format,targetFormat:target,output:null,valid:false,diagnostics:[]};
  let model;
  try {
    model=parseDocument(source);
    result.title=model.title;result.views=model.views.map(v=>({id:v.id,title:v.title}));result.kind=model.kind??'architecture';
    if(model.config?.views!==undefined)result.configuredViews=copy(model.config.views);
    result.output=translate(source,{...options,format:target});
    const report=validateModel(model,options);result.valid=report.valid;result.diagnostics=report.diagnostics;result.profile=report.profile;
    rememberDiagnosticProfile(result, diagnosticProfile(report));
  } catch(error) {
    if(!(error instanceof ArchError))throw error;
    result.diagnostics=error.diagnostics??[errorDiagnostic(error)];
    rememberDiagnosticProfile(result, diagnosticProfile(error));
  }
  result.diagnostics=result.diagnostics.map(d=>({...d,candidates:corrections(d,model,source,format,options)}));
  return result;
}
