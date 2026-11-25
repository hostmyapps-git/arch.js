import { naf41Grid } from '../naf41/viewpoint-grid.mjs';
import { viewpointChecks, extraElements, requiredLinks, connections } from './viewpoints.mjs';

const strategy = new Set(['Capability','CourseOfAction','Resource','ValueStream']);
const motivation = new Set(['Assessment','Constraint','Driver','Goal','Meaning','Outcome','Principle','Requirement','Stakeholder','Value']);
const migration = new Set(['Deliverable','Gap','ImplementationEvent','Plateau','WorkPackage']);
const physical = new Set(['DistributionNetwork','Equipment','Facility','Material']);
const layerColors={strategy:'#c49a56',business:'#e4c756',application:'#66a6dd',technology:'#78b687',
  motivation:'#a893cb',migration:'#d698b1',other:'#a1aab9'};
const matrixCodes={
  c:['Composition','composition'],g:['Aggregation','aggregation'],i:['Assignment','assignment'],
  r:['Realization','realization'],v:['Serving','flow'],a:['Access','archimate-access'],n:['Influence','dependency'],
  o:['Association','association'],t:['Triggering','triggering'],f:['Flow','transfer'],s:['Specialization','generalization']
};
const words=value=>value.split(/\s+/).filter(Boolean);
const unique=values=>[...new Set(values)];
const byWords=value=>words(value).map(group=>group.split('|'));
const slug=value=>value.replace(/[^A-Za-z0-9]/g,'').toLowerCase();
const typeName=value=>words(value.replace(/^#\s*/, '')).map(word=>word[0].toUpperCase()+word.slice(1)).join('');
const inflectedNames={Node:'NafNode',Constraint:'NafConstraint'};

function presentation(type) {
  const layer=strategy.has(type)?'strategy':motivation.has(type)?'motivation':migration.has(type)?'migration':
    type.startsWith('Business')||['Contract','Product','Representation'].includes(type)?'business':
    type.startsWith('Application')||type==='DataObject'?'application':
    type.startsWith('Technology')||physical.has(type)||['Artifact','Node','Device','SystemSoftware','CommunicationNetwork','Path'].includes(type)?'technology':'other';
  const template=type==='Junction'?'junction':type==='Grouping'?'package':type.match(/Actor|Stakeholder/)?'person':type.endsWith('Interface')?'interface':
    type.endsWith('Service')?'service':type.match(/Process|Function|Interaction|WorkPackage|ValueStream/)?'process':
    type.match(/Object|Artifact|Contract|Deliverable|Representation/)?'artifact':type==='Capability'?'capability':
    type==='ApplicationComponent'?'component':'node';
  return {template,styleGroup:layer};
}

function matrixRelations(matrix,source) {
  const {concepts,rows}=matrix;
  if (matrix.version!=='3.2'||concepts.length!==62||rows.length!==concepts.length) throw new Error('Unexpected ArchiMate 3.2 relationship matrix');
  const grouped = Object.fromEntries(Object.keys(matrixCodes).map(code=>[code,new Map()]));
  for (const [index,from] of concepts.entries()) {
    const row=words(rows[index]);
    if (row.length!==concepts.length || row.some(value=>value!=='-'&&[...value].some(code=>!Object.hasOwn(matrixCodes,code))))
      throw new Error(`Invalid ArchiMate matrix row: ${from}`);
    if (from==='Relationship') continue;
    for (const [code,targets] of Object.entries(grouped)) {
      const allowed=concepts.filter((to,column)=>to!=='Relationship'&&row[column].includes(code));
      if (!allowed.length) continue;
      const key=allowed.join(' ');
      if (!targets.has(key)) targets.set(key,{from:[],to:allowed});
      targets.get(key).from.push(from);
    }
  }
  const relationTypes={};
  for (const [code,[type,style]] of Object.entries(matrixCodes)) {
    const pairs=[...grouped[code].values()];
    relationTypes[type]={style,pairs,from:unique(pairs.flatMap(pair=>pair.from)),to:unique(pairs.flatMap(pair=>pair.to)),
      sources:[source],...(type==='Composition'||type==='Specialization'?{allowSelf:false,acyclic:true}:{}),
      ...(type==='Triggering'?{activityFlow:true,sequenceMessage:true,attributes:{order:{type:'integer',min:0}}}:{}),
      ...(type==='Access'?{attributes:{accessType:{type:'string',enum:['read','write','readWrite']}}}:{}),
      ...(type==='Association'?{attributes:{directed:{type:'boolean'}}}:{}),
      ...(type==='Influence'?{attributes:{strength:{type:'string'}}}:{})};
  }
  return relationTypes;
}

export function createArchiMateDefinitions(matrix,guide,parent,authority) {
  const nodeTypes=Object.fromEntries(matrix.concepts.filter(type=>type!=='Relationship').map(type=>[type,presentation(type)]));
  nodeTypes.Junction.attributes={kind:{type:'string',enum:['and','or'],required:true}};
  const styleGroups=Object.fromEntries(Object.entries(layerColors).map(([layer,backgroundColor])=>[layer,{backgroundColor}]));
  const archimate={id:'archimate-3.2',version:'3.2.0-arch.1',title:'ArchiMate 3.2',
    sources:[authority.standard,authority.matrix],defaultRelation:null,nodeTypes,styleGroups,
    limitations:['Includes the pinned Archi relationship matrix for element pairs. Review the NAF ArchiMate coverage report for notation, direct relationship endpoints and derivation limits.'],
    relationTypes:matrixRelations(matrix,authority.matrix)};
  const specialisms={}, viewpoints={}, coverage={};
  const baseNames=new Map(Object.keys(nodeTypes).map(name=>[slug(name),name]));
  const addSpecialism=(name,base,page,title=name)=>{
    if (nodeTypes[name]) {
      if (name!==base) throw new Error(`ArchiMate specialism collides with core type ${name}`);
      return;
    }
    if (specialisms[name]) {
      if (specialisms[name].extends[0]!==base) throw new Error(`Incompatible NATO mappings for ${name}`);
      if (!specialisms[name].sources.includes(page)) specialisms[name].sources.push(page);
      return;
    }
    specialisms[name]={extends:[base],title,sources:[page]};
  };
  const scope={};
  for (const [id,table] of Object.entries(guide)) {
    if (!viewpointChecks[id]||!parent.viewpoints[id]) throw new Error(`Unreviewed NATO ArchiMate viewpoint ${id}`);
    const page=`${authority.guide}#page=${table.page}`;
    for (const [,label,core] of table.elements) {
      const base=baseNames.get(slug(core)), type=typeName(label);
      if (!base) throw new Error(`Unknown ArchiMate 3.2 base: ${core}`);
      addSpecialism(inflectedNames[type]??type,base,page,label.replace(/^#\s*/, ''));
    }
    const nodes=unique(table.elements.map(([,label])=>inflectedNames[typeName(label)]??typeName(label)));
    scope[id]={nodes,page};
  }

  // Keep model/entity/product distinctions available in L7 and P7 even though
  // the guide maps them to the same ArchiMate symbol and specialism label.
  for (const type of extraElements.L7) addSpecialism(type,'InformationObject',scope.L7.page);
  for (const type of extraElements.P7) addSpecialism(type,'DataObject',scope.P7.page);
  addSpecialism('ResourceSpecification','Grouping',scope.P8.page);
  addSpecialism('ResourceInteractionCollaboration','TechnologyCollaboration',scope.P3.page,'Resource Interaction');
  specialisms.View.attributes={viewpoint:{type:'reference',targets:['Viewpoint']}};
  specialisms.Viewpoint.attributes={nafViewpoint:{type:'string',enum:Object.keys(guide)}};
  for (const type of ['Milestone','ArchitectureMilestone'])
    specialisms[type].attributes={date:{type:'string',format:'date'}};

  for (const [id,{nodes,page}] of Object.entries(scope)) {
    const [relations,requiredElements,requiredRelationships]=viewpointChecks[id];
    // Entity sets in the guidance span multiple layers. Keep only the forms
    // available in this particular viewpoint's mapping or prose.
    const allowedNodes=unique([...nodes,...(extraElements[id]??[])]);
    const requiredNodeGroups=byWords(requiredElements).map(group=>group.filter(type=>allowedNodes.includes(type)));
    if (requiredNodeGroups.some(group=>!group.length)) throw new Error(`No permitted type satisfies a required group in viewpoint ${id}`);
    const requiredRelationGroups=requiredLinks[id] ?? byWords(requiredRelationships);
    const allowedRelations=words(relations);
    viewpoints[id]={title:parent.viewpoints[id].title,nodes:[...allowedNodes,'Junction'],relations:allowedRelations,
      requiredNodeGroups,requiredRelationGroups,sources:[page,...parent.viewpoints[id].sources],
      ...(connections[id]?{connections:connections[id]}:{}),
      ...(['L3','L4','P2','P3','P4'].includes(id)?{references:[{relations:['ConveyingFlow'],attributes:['conveyed']}]}:{})};
    coverage[id]={guidePage:guide[id].page,guideSection:guide[id].section,
      mappingRows:guide[id].elements.length,...viewpoints[id]};
  }
  const naf41={id:'naf41-archimate',version:'4.1.0-arch.1',title:'NAFv4.1 with ArchiMate 3.2',
    extends:`${archimate.id}@${archimate.version}`,requireViewpoint:true,sources:[authority.naf,authority.guide,authority.standard],
    styleGroups:parent.styleGroups,viewpointGrid:naf41Grid,
    nodeTypes:specialisms,viewpoints,
    relationTypes:{
      ConveyingFlow:{extends:['Flow'],
        attributes:{conveyed:{type:'reference',targets:['InformationObject','LogicalMaterial','LogicalEnergy','DataObject','Artifact','Material'],many:true,required:true,minItems:1,uniqueItems:true}},
        referenceLabels:{conveyed:'Conveys'},referenceDisplay:'nodes',referenceConnectorLabels:true,
        limitations:['The typed conveyed field is the arch.js representation of an object associated directly with a flow.']},
      InteractionTriggering:{extends:['Triggering'],attributes:{
        interaction:{type:'reference',targets:['Interaction','ResourceInteraction','ResourceInteractionCollaboration','StateTransition','ResourceStateTransition']}
      },referenceLabels:{interaction:'Interaction'}},
      RepresentsParticipant:{extends:['Association'],sequenceContext:'above',
        from:['LogicalLifeline','ResourceLifeline'],
        to:['BusinessService','ApplicationService','TechnologyService','Actor','LogicalApplication','LogicalEquipment','LogicalTechnology','NafNode',
          'Application','CommunicationNetwork','Device','DistributionNetwork','Equipment','Facility','Organization','Person','Post','SystemSoftware']}
    },
    limitations:['See profiles/naf41-archimate/COMPLIANCE.md for unresolved NAFv4.1 checks, matrix/guide conflicts and rendering conventions.']};
  return {archimate,naf41,coverage};
}
