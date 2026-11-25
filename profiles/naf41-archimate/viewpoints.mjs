// Each row lists the relationship vocabulary in the Guide's implementation
// guidance, then required element and relationship groups. Within a group
// either form is sufficient. The matrix still validates each endpoint pair.
const services = 'ApplicationService|BusinessService|TechnologyService';
const interfaces = 'ApplicationInterface|BusinessInterface|TechnologyInterface';
const functions = 'ApplicationFunction|BusinessFunction|TechnologyFunction';
const processes = 'ApplicationProcess|BusinessProcess|TechnologyProcess';
const operations = 'ApplicationOperation|BusinessOperation|TechnologyOperation';
const states = 'ApplicationState|BusinessState|TechnologyState';
const resourceStates = 'ApplicationResourceState|BusinessResourceState|TechnologyResourceState';
const logical = 'NafNode|Actor|LogicalApplication|LogicalEquipment|LogicalTechnology';
const physical = 'Application|CommunicationNetwork|Device|DistributionNetwork|Equipment|Facility|Organization|Person|Post|SystemSoftware';
const logicalPassive = 'InformationObject|LogicalEnergy|LogicalMaterial';
const physicalPassive = 'Artifact|DataObject|Energy|Material';

export const viewpointChecks = {
  C1:['Composition Aggregation Specialization Serving Realization','Capability','Composition|Specialization'],
  C2:['Influence Aggregation Realization Specialization','EnterprisePhase Goal|Driver|Outcome','Influence|Aggregation|Realization|Specialization'],
  C3:['Serving Aggregation Specialization','Capability','Serving'],
  C4:['Realization Serving',`Capability OperationalActivity|ValueStream`,'Realization|Serving'],
  C5:['Realization Association','Capability Outcome EffectivenessCriteria','Realization'],
  C7:['Realization Association','AssessmentCriteria Capability','Realization'],
  C8:['Association Influence Specialization Realization','Capability NafConstraint','Association'],
  Cr:['Composition Aggregation Triggering Realization Association','Capability','Composition'],
  S1:['Specialization Realization Aggregation',services,'Specialization'],
  S2:['Composition Serving Assignment Association Realization',services,'Serving'],
  S3:['Assignment Serving Access Association',`${services} ${interfaces}`,'Assignment'],
  S4:['Serving Aggregation Realization Assignment Association',`${services} ${functions}`,'Serving'],
  S5:['Association Triggering Aggregation Serving',`${services} ${states}`,'Triggering'],
  S6:['Association Triggering Serving Assignment',`${services} LogicalLifeline`,'Triggering'],
  S7:['Access Association Serving Assignment',`${operations}|${functions} ServiceOperationParameter|ServiceFunctionParameter InformationObject|DataObject`,'Access Association'],
  S8:['Aggregation Realization Association','ServicePolicy NafConstraint','Aggregation'],
  Sr:['Aggregation Association Realization',`${services} ReadinessLevel`,'Aggregation'],
  'C1-S1':['Realization',`Capability ${services}`,'Realization'],
  L1:['Aggregation Specialization Realization Serving',`NafNode ${functions}|OperationalActivity`,'Aggregation|Specialization'],
  L2:['Aggregation Flow Access Association','NafNode','Flow'],
  'L2-L3':['Flow','',''],
  L3:['Flow Association Aggregation Access',`${logical} ${logicalPassive}`,'Flow Access|ConveyingFlow'],
  L4:['Assignment Association Triggering Flow Access Serving',`${logical}|Role OperationalActivity`,'Triggering Assignment|Association'],
  L5:['Assignment Association Triggering Aggregation Serving',`${logical} ${states}`,'Triggering'],
  L6:['Association Triggering Serving',`${logical} LogicalLifeline`,'Triggering'],
  L7:['Specialization Aggregation','InformationEntity',''],
  L8:['Realization Influence Aggregation Association',`NafConstraint Requirement ${logical}|${logicalPassive}|${functions}|OperationalActivity`,'Realization'],
  Lr:['Association Aggregation Realization',`ReadinessLevel ${logical}`,'Aggregation'],
  P1:['Specialization Composition Assignment Serving Aggregation Realization Access Association',`${physical} ${processes}`,'Assignment|Serving'],
  P2:['Specialization Composition Serving Access Aggregation Flow Association Realization',`CapabilityConfiguration ${physical} ${physicalPassive}`,'Aggregation Access|Serving'],
  P3:['Flow Association Realization Access',`${physical} Protocol Standard`,'Flow|Realization'],
  P4:['Assignment Serving Aggregation Flow Association Triggering Access',`${physical} ${processes} ${physicalPassive}`,'Assignment|Serving Triggering Flow'],
  'L4-P4':['Serving Assignment Aggregation',`OperationalActivity ${processes}`,'Serving'],
  P5:['Association Triggering Aggregation Serving Specialization',`${physical} ${resourceStates}`,'Triggering'],
  P6:['Association Triggering Serving',`${physical} ResourceLifeline`,'Triggering'],
  P7:['Specialization Aggregation Realization','DataEntity',''],
  P8:['Realization Influence Aggregation',`NafConstraint Requirement ${physical}|${physicalPassive}|${processes}`,'Realization'],
  Pr:['Association Aggregation Realization','ReadinessLevel CapabilityConfiguration','Aggregation'],
  A1:['Association','ArchitectureDescription GlossaryTerm','Association'],
  A2:['Aggregation Realization Influence Association','ArchitectureDescription View Viewpoint Stakeholder Concern','Aggregation Realization Influence Association'],
  A3:['Association Aggregation Access','ArchitectureDescription ArchitectureDescriptionElement ElementCorrespondence','Association'],
  A4:['Association Specialization Access','ArchitectureProject ArchitectureMethodology','Association'],
  A5:['Specialization Association Aggregation','ArchitectureWorkProduct ArchitectureStatus','Association'],
  A6:['Aggregation Triggering Specialization','ArchitectureWorkProduct Version','Aggregation Triggering'],
  A7:['Aggregation Association','Measure',''],
  A8:['Aggregation Specialization Association','Standard',''],
  Ar:['Association Aggregation Realization Specialization','ArchitectureWorkProduct ArchitectureStatus ArchitectureMilestone','Association']
};

// Cases where prose/examples include a construct beyond the mapping table,
// or where the table and its Scope use a shared ArchiMate label for several
// distinct NAF information concepts.
export const extraElements = {
  L5:['NafNode'], L6:['NafNode'], L8:['NafNode'],
  L7:['InformationEntity','InformationModel','InformationProduct','InformationAttribute','InformationAttributeType'],
  P2:['ResourceInteractionCollaboration'], P3:['ResourceInteractionCollaboration'],
  P7:['DataEntity','DataModel','DataProduct','DataAttribute','DataAttributeType'],
  P8:['ResourceSpecification'],
  A5:['ArchitectureDescription'], A6:['ArchitectureDescription']
};

const check = (nodes,relations,direction,counterparts) => ({nodes,relations,direction,counterparts,min:1});
const alternatives = value => value.split('|');
const between = (types,from,to=from) => ({types:alternatives(types),from:alternatives(from),to:alternatives(to)});

// Check the semantic endpoints of mandatory structural evidence where the
// same ArchiMate relationship can also connect unrelated optional context.
export const requiredLinks = {
  C1:[between('Composition|Specialization','Capability')],
  C3:[between('Serving','Capability')],
  S1:[between('Specialization',services)],
  S2:[between('Serving',services)],
  S5:[between('Triggering',states)],
  S6:[between('Triggering','LogicalLifeline')],
  L2:[between('Flow','NafNode')],
  L4:[between('Triggering','OperationalActivity'),between('Assignment|Association',`${logical}|Role`,'OperationalActivity')],
  L5:[between('Triggering',states)],
  L6:[between('Triggering','LogicalLifeline')],
  P4:[between('Assignment|Serving',`${physical}|${processes}`),between('Triggering',processes),between('Flow',processes)],
  P5:[between('Triggering',resourceStates)],
  P6:[between('Triggering','ResourceLifeline')],
  A6:[between('Aggregation','Version|Baseline','ArchitectureWorkProduct|ArchitectureDescription'),between('Triggering','Version')]
};

export const connections = {
  S3: [
    ...alternatives(services).map((service,index)=>check([service],['Assignment'],'either',[alternatives(interfaces)[index]]))
  ],
  S4: [
    ...alternatives(services).map((service,index)=>check([service],['Serving'],'incoming',[alternatives(functions)[index]]))
  ],
  'C1-S1':[check(alternatives(services),['Realization'],'outgoing',['Capability'])],
  L6:[check(['LogicalLifeline'],['Association'],'either',alternatives(logical))],
  P6:[check(['ResourceLifeline'],['Association'],'either',alternatives(physical))],
  A2:[
    check(['View'],['Aggregation'],'incoming',['ArchitectureDescription']),
    check(['View'],['Realization'],'outgoing',['Viewpoint']),
    check(['Stakeholder'],['Association'],'either',['Concern']),
    check(['Concern'],['Influence'],'incoming',['Viewpoint'])
  ],
  A3:[
    check(['ElementCorrespondence'],['Association'],'either',['ArchitectureDescriptionElement']),
    check(['ElementCorrespondence'],['Association'],'either',['ArchitectureDescription'])
  ],
  Ar:[
    check(['ArchitectureStatus'],['Association'],'either',['ArchitectureWorkProduct']),
    check(['ArchitectureMilestone'],['Association'],'either',['ArchitectureStatus'])
  ]
};
