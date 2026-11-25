const namespace = 'NAFv4-ADMBw::';
const elements = (parent, tag) => [...parent.getElementsByTagName(tag)];
const list = (value, separator) => (value ?? '').split(separator).map(item => item.trim()).filter(Boolean);
const unique = values => [...new Set(values)];
const byName = rows => Object.fromEntries(rows.map(row => [row.name,row]));
const identifier = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const relationshipStyles = {
  Dependency:'dependency', Abstraction:'dependency', Realisation:'realization', Generalization:'generalization',
  InformationFlow:'flow', ObjectFlow:'flow', ControlFlow:'flow', Message:'flow', Connector:'association',
  Association:'association', Aggregation:'aggregation', Composition:'composition'
};
const nodeTemplates = {Activity:'process', Action:'process', Operation:'process', Note:'artifact',
  Constraint:'artifact', Requirement:'artifact', Port:'interface', Parameter:'artifact', DataType:'artifact',
  Signal:'artifact', StateMachine:'process', Lifeline:'node'};
const knownEquivalent = {
  ViewsInArchitecturalDescription:'ContainsView', CompliesViewpoint:'ConformsToViewpoint',
  StakeholderConcern:'StakeholderHasConcern', ConcernForViewpoint:'FramesConcern'
};
const builtins = new Set(['description','technology','icon','stereotype','tags','backgroundImage','direction','type']);
const rolePairs = [
  ['client','supplier'], ['source','target'], ['informationSource','informationTarget'], ['end[0].role','end[1].role']
];
const umlActivityPoints=new Set(['ActivityInitial','ActivityFinal','DecisionNode','FlowFinal','ForkNode','JoinNode','MergeNode']);
const bpmnActivityPoints=new Set(['EndEvent','Gateway','IntermediateEvent','Lane','Pool','StartEvent']);

function readStereotype(item) {
  return {
    name:item.getAttribute('name'),
    title:item.getAttribute('metatype') || item.getAttribute('name'),
    abstract:item.getAttribute('isAbstract') === 'true',
    bases:list(item.getAttribute('generalizes'),';'),
    metaclasses:elements(item,'Apply').map(element=>element.getAttribute('type')),
    tags:elements(item,'Tag').map(tag=>({name:tag.getAttribute('name'),type:tag.getAttribute('type'),
      values:tag.getAttribute('values'),default:tag.getAttribute('default')})),
    constraints:elements(item,'metaconstraint').map(rule=>({role:rule.getAttribute('umlRole'),
      targets:list(rule.getAttribute('constraint'),';')})),
    extraRules:elements(item,'metarelationship').length
  };
}

function tagRule(tag, custom) {
  if (tag.type==='enumeration') {
    const options=unique(list(tag.values,','));
    return options.length ? {type:'string',enum:options} : undefined;
  }
  if (tag.type==='boolean') return {type:'boolean'};
  if (tag.type==='int') return {type:'integer'};
  if (tag.type==='float') return {type:'number'};
  if (tag.type==='Date') return {type:'string',format:'date'};
  if (['String','Sting','char'].includes(tag.type)) return {type:'string'};
  return custom[tag.type || tag.name];
}

function importTags(record, existing, omitted, custom) {
  const attributes={};
  for (const tag of record.tags) {
    if (tag.name.startsWith('_')) { omitted.push({tag:tag.name,reason:'EA control tag'}); continue; }
    const schema=tagRule(tag,custom);
    if (!schema || !identifier.test(tag.name) || builtins.has(tag.name)) {
      omitted.push({tag:tag.name,reason:`Unmapped tag type or reserved name (${tag.type || 'untyped'})`});
      continue;
    }
    if (existing?.[tag.name]) {
      omitted.push({tag:tag.name,reason:'Existing NAF/UAF field retained'});
      continue;
    }
    attributes[tag.name]=schema;
  }
  return attributes;
}

function customTags(doc, nativeNodes, base) {
  const types=[...doc.documentElement.childNodes].find(child=>child.tagName==='TaggedValueTypes');
  const rules=Object.create(null);
  const knownType=name=>Object.hasOwn(nativeNodes,name)||Object.hasOwn(base.nodeTypes,name);
  for (const row of elements(types,'DataRow')) {
    const columns=Object.fromEntries(elements(row,'Column').map(column=>[column.getAttribute('name'),column.getAttribute('value')]));
    const settings=Object.fromEntries(list(columns.Notes,';').filter(line=>line.includes('=')).map(line=>{
      const [key,value]=line.split('=',2);
      return [key.trim(),value.trim()];
    }));
    if (settings.Type==='Date') rules[columns.Property]={type:'string',format:'date'};
    else if (settings.Type==='Boolean') rules[columns.Property]={type:'boolean'};
    else if (['RefGUID','RefGUIDList'].includes(settings.Type) && settings.Stereotypes) {
      const targets=list(settings.Stereotypes,',').map(type=>({View_:'View',viewpoint:'Viewpoint'})[type]??type);
      if (targets.length && targets.every(knownType))
        rules[columns.Property]={type:'reference',targets,...(settings.Type==='RefGUIDList'?{many:true,uniqueItems:true}:{})};
    }
  }
  return rules;
}

export function createAdmbwDefinition(doc, base, sources) {
  const technology=elements(doc,'Documentation')[0];
  const [domain,...auxiliary]=elements(doc,'UMLProfile');
  const domainName=elements(domain,'Documentation')[0].getAttribute('name');
  const all=elements(domain,'Stereotype').map(readStereotype);
  if (technology.getAttribute('version')!=='2026.05' || domainName!=='NAFv4-ADMBw' || all.length!==318)
    throw new Error('Unexpected ADMBw MDG domain profile structure');
  const connectors=all.filter(record=>record.metaclasses.some(type=>Object.hasOwn(relationshipStyles,type)));
  const connectorNames=new Set(connectors.map(record=>record.name));
  const nativeNodes=byName(all.filter(record=>!connectorNames.has(record.name)));
  const custom=customTags(doc,nativeNodes,base);
  const nodeTypes={}, relationTypes={}, viewpoints={};
  const aliases={relationTypes:{}}, coverage={};
  const nodeIds=new Map();
  const flags=record=>({omittedTags:[], unresolvedConstraints:record.constraints,
    ...(record.extraRules ? {additionalMetamodelRules:record.extraRules} : {})});
  const evidence=record=>[`${sources.mdg} · domain stereotype ${record.name}`];
  const externalTargets={};
  function targetOf(type) {
    if (type.startsWith(namespace)) return type.slice(namespace.length);
    const bpmn = type.match(/^BPMN2\.0::(.+)$/)?.[1];
    const uml = umlActivityPoints.has(type);
    if (!(uml || bpmnActivityPoints.has(bpmn))) return type.includes('::') ? undefined : type;
    const id=uml ? `AdmbwUml${type}` : `AdmbwBpmn${bpmn}`;
    externalTargets[id]=type;
    nodeTypes[id] ??={template:'node',title:`ADMBw endpoint ${type}`,sources:[sources.mdg],
      limitations:['Endpoint identity is checked. Full UML/BPMN behavior rules require their own metamodel.']};
    return id;
  }
  for (const record of Object.values(nativeNodes)) {
    const {name}=record;
    const result=coverage[name]={...flags(record),kind:'element'};
    if (!identifier.test(name)) { result.status='unsupported identifier'; continue; }
    nodeIds.set(name,name);
  }
  for (const record of Object.values(nativeNodes)) {
    const {name,abstract}=record, result=coverage[name], id=nodeIds.get(name);
    if (!id) continue;
    const inherited=base.nodeTypes[id];
    const attributes=importTags(record,inherited?.attributes,result.omittedTags,custom);
    const parents=record.bases.filter(parent=>parent!==id && nodeIds.has(parent));
    const unresolvedBases=record.bases.filter(parent=>parent!==id && !nodeIds.has(parent));
    if (unresolvedBases.length) result.unresolvedBases=unresolvedBases;
    if (inherited) {
      result.status='inherited';
      if (!inherited.aliasOf && Object.keys(attributes).length) {
        nodeTypes[id]={...inherited,attributes:{...inherited.attributes,...attributes}};
        result.status='inherited with optional MDG tags';
      } else if (inherited.aliasOf) {
        for (const tag of Object.keys(attributes)) result.omittedTags.push({tag,reason:'Inherited alias retains its canonical schema'});
      }
      continue;
    }
    const template=record.metaclasses.includes('Package') ? 'package' : nodeTemplates[record.metaclasses[0]];
    nodeTypes[id]={extends:parents.length?parents:['UAFElement'],abstract,
      ...(template ? {template} : {}),attributes,title:record.title,sources:evidence(record)};
    result.status='imported';
  }
  const relationIds=new Map();
  const accepts=(type)=>nodeIds.has(type) || Object.hasOwn(base.nodeTypes,type) || Object.hasOwn(externalTargets,type);
  for (const record of connectors) {
    const {name}=record;
    const result=coverage[name]={...flags(record),kind:'relationship'};
    const paired=rolePairs.filter(pair=>pair.every(role=>record.constraints.some(constraint=>constraint.role===role)));
    const pair=record.metaclasses.includes('InformationFlow') ? paired.find(([role])=>role==='informationSource') ?? paired[0] : paired[0];
    const targets=role=>unique(record.constraints.filter(constraint=>constraint.role===role).flatMap(constraint=>constraint.targets).map(targetOf));
    if (!identifier.test(name) || !pair) {
      result.status='unresolved binary endpoint roles';
      continue;
    }
    const [sourceRole,targetRole]=pair, from=targets(sourceRole), to=targets(targetRole);
    if ([...from,...to].some(type=>!type || !accepts(type))) {
      result.status='unresolved endpoint types';
      continue;
    }
    result.unresolvedConstraints=record.constraints.filter(constraint=>!pair.includes(constraint.role));
    const equivalent=knownEquivalent[name];
    if (equivalent && base.relationTypes[equivalent] && !Object.hasOwn(base.relationTypes,name)) {
      aliases.relationTypes[name]={target:equivalent,sources:evidence(record)};
      relationIds.set(name,name);
      result.status='alias'; result.type=equivalent;
      continue;
    }
    const id=Object.hasOwn(base.relationTypes,name)?`ADMBw${name}`:name;
    if (Object.hasOwn(base.relationTypes,id) || Object.hasOwn(relationTypes,id)) throw new Error(`ADMBw connector name collision: ${id}`);
    const style=relationshipStyles[record.metaclasses.find(type=>Object.hasOwn(relationshipStyles,type))];
    const attributes=importTags(record,undefined,result.omittedTags,custom);
    const conveyed=targets('conveyed');
    if (conveyed.length && conveyed.every(accepts)) {
      attributes.conveyed={type:'reference',targets:conveyed,many:true};
      result.unresolvedConstraints=result.unresolvedConstraints.filter(constraint=>constraint.role!=='conveyed');
    }
    relationTypes[id]={from,to,style,abstract:record.abstract,title:record.title,attributes,sources:evidence(record)};
    relationIds.set(name,id); result.status=id===name?'imported':'imported as a distinct ADMBw relation'; result.type=id;
  }
  // UML Message endpoints are lifelines derived from interaction references.
  // Reuse the typed NAF sequence representation and retain the EA-specific
  // receive-operation/connector constraints in the audit for future import.
  const messageBases={OperationalMessage:'LogicalSequenceInteraction',ServiceMessage:'ServiceInteraction',ResourceMessage:'ResourceSequenceInteraction'};
  const messagePairs=Object.values(messageBases).map(type=>{
    const {from,to}=base.relationTypes[type];
    return {from,to};
  });
  relationTypes.InteractionMessage={style:'flow',abstract:true,sequenceMessage:true,
    from:unique(messagePairs.flatMap(pair=>pair.from)),to:unique(messagePairs.flatMap(pair=>pair.to)),pairs:messagePairs,
    sources:[`${sources.mdg} · InteractionMessage`]};
  for (const [type,baseType] of Object.entries(messageBases)) {
    relationTypes[type]={extends:[baseType,'InteractionMessage'],sources:[`${sources.mdg} · ${type}`],
      limitations:['Uses the corresponding NAFv4.1 lifeline endpoint representation for UML messages.']};
    relationIds.set(type,type);
    coverage[type].status='projected UML message';
  }
  relationIds.set('InteractionMessage','InteractionMessage');
  coverage.InteractionMessage.status='abstract UML message projection';
  const storagePairs=connectors.filter(record=>record.bases.includes('StoredIn')).map(({name})=>relationTypes[relationIds.get(name)]).filter(Boolean)
    .map(({from,to})=>({from,to}));
  if (storagePairs.length) {
    relationTypes.StoredIn={style:'dependency',from:unique(storagePairs.flatMap(pair=>pair.from)),
      to:unique(storagePairs.flatMap(pair=>pair.to)),pairs:storagePairs,sources:[`${sources.mdg} · StoredIn`],
      limitations:['Endpoint pairs are taken from the MDG specializations DataElementStoredIn and FormStoredIn.']};
    relationIds.set('StoredIn','StoredIn');
    coverage.StoredIn.status='projected from constrained MDG subtypes';
  }
  for (const profile of auxiliary) {
    const name=elements(profile,'Documentation')[0].getAttribute('name');
    const id=name.match(/^NAFv4-ADMBw-(.+)-Toolbox$/)?.[1];
    if (!id || !identifier.test(id)) continue;
    const names=elements(profile,'Tag').map(tag=>tag.getAttribute('name').match(/^NAFv4-ADMBw::([^()]+)\(UML::/u)?.[1]).filter(Boolean);
    const nodes=names.map(name=>nodeIds.get(name)).filter(Boolean);
    const relations=names.map(name=>relationIds.get(name)).filter(Boolean);
    for (const type of relations) {
      const rule=relationTypes[type];
      if (rule?.from && rule.to) nodes.push(...rule.from,...rule.to);
    }
    const naf=base.viewpoints[id];
    viewpoints[id]={...naf,title:naf?.title ?? `ADMBw ${id}`,
      nodes:unique([...(naf?.nodes ?? ['Package']),...nodes]),
      relations:unique([...(naf?.relations ?? []),...relations]),
      sources:unique([...(naf?.sources ?? []),`${sources.mdg} · ${name}`]),
      ...(!naf ? {limitations:['ADMBw-specific toolbox content. Required model content needs review against the ADMBw methodology.']} : {})};
  }
  // The requirement extension and explicit protocol implementation retain
  // their original MDG endpoints. Allow them beside the NAF application forms.
  function allow(id,nodes,relations) {
    const view=viewpoints[id] ??={...base.viewpoints[id]};
    view.nodes=unique([...view.nodes,...nodes]);
    view.relations=unique([...view.relations,...relations]);
  }
  allow('P3',['ProtocolImplementation'],['ImplementsProtocol']);
  allow('C7',['FulfilmentCriterion','FitCriterion'],['Evaluates']);

  const definition={id:'naf41-admbw',title:'NAFv4.1 with ADMBw',version:'2026.05-arch.1',
    extends:`${base.id}@${base.version}`,sources:[sources.naf,sources.mdg],
    description:'NAFv4.1 viewpoint checks with additive ADMBw 2026.05 domain vocabulary.',
    limitations:[
      'ADMBw 2026.05 declares NAF 4.0. The NAFv4.1 Scope and cut-out checks come from the pinned application profile.',
      'Sparx UML ownership, non-binary connector roles, EA scripts, model templates and exchange are outside this application mapping.',
      'See profiles/admbw/coverage.json for the result and unsupported rules of each MDG domain stereotype.'
    ],nodeTypes,relationTypes,viewpoints,aliases};
  return {definition,coverage,externalTargets};
}
