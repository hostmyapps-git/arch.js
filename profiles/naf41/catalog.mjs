// Authored application mapping, not an OMG stereotype import.
// Edit this file; scripts/build-naf41.mjs writes the runtime JSON and coverage report.
import { representations } from './representations.mjs';
import { naf41Grid } from './viewpoint-grid.mjs';
export const pdf = 'ReferenceDocs/nafv4/NATO-Architecture-Framework-v4-1-en.pdf';
export const source = page => `${pdf} — printed page ${page} (NAFv4.1, 2026.03)`;
export const mappingLimit = 'Structural application mapping in arch.js; not the complete UML/SysML semantics or an official NATO/OMG implementation guide.';
const list = text => typeof text === 'string' ? text.split(/\s+/).filter(Boolean) : text;
const ref = (targets, required = true, many = false) => ({ type: 'reference', targets: list(targets), required, ...(many ? { many: true, minItems: required ? 1 : 0, uniqueItems: true } : {}) });
const text = (required = false) => ({ type: 'string', required, ...(required ? { minLength: 1 } : {}) });
export const nodeTypes = {}, relationTypes = {}, viewpoints = {}, coverage = {};
function node(name, base, page, description, extra = {}) {
  nodeTypes[name] = { extends: list(base), styleGroup: page < 104 ? 'capability' : page < 126 ? 'service' : page < 147 ? 'logical' : page < 172 ? 'physical' : 'foundation', description, sources: [source(page)], limitations: ['arch.js application adapter; this name is not asserted to be a native UAF 1.0 stereotype.'], ...extra };
}
function edge(name, from, to, page, description, extra = {}) {
  relationTypes[name] = { from: list(from), to: list(to), allowSelf: false, style: 'dependency', description, sources: [source(page)],
    ...(extra.attributes?.conveyed ? { referenceLabels: { conveyed: 'Conveys' } } : {}),
    ...(name === 'LogicalInteraction' ? { referenceDisplay: 'nodes' } : {}), ...extra };
}
const connect = (nodes, relations, direction = 'outgoing', counterparts, min = 1, max) => ({ nodes: list(nodes), relations: list(relations), direction, min, ...(counterparts ? { counterparts: list(counterparts) } : {}), ...(max === undefined ? {} : { max }) });
const visible = (nodes, attributes) => ({ nodes: list(nodes), attributes: list(attributes) });
function view(id, title, page, description, nodes, relations, requiredNodes = '', requiredRelations = '', connections = [], references = [], limitations = []) {
  viewpoints[id] = { title, description, sources: [source(page)], limitations: [mappingLimit, ...limitations],
    nodes: [...new Set(['Package', ...list(nodes)])], relations: list(relations), requiredNodes: list(requiredNodes), requiredRelations: list(requiredRelations), connections, references };
  const [formats,renderers,note] = representations[id];
  viewpoints[id].representations = [`NAF formats: ${formats}`, `arch.js: ${renderers}`, ...(note ? [note] : [])];
  coverage[id] = { title, page, status: 'structural application checks', formats, renderers, representationNote:note, limitations };
}

// Capability concepts missing as independently editable elements in UAF 1.0.
// NAF's C2 example labels these «Goal»; UAF and the ADMBw MDG call the concept EnterpriseGoal.
node('Goal', 'EnterpriseGoal', 91, 'NAF C2 Goal, mapped as a concrete subtype of UAF EnterpriseGoal. Existing goal relationships, attributes and viewpoint rules apply to both names.');
node('Effect', 'ActualState', 96, 'A desired change in the world. Use DesiredEffect from a capability to this state.');
node('AssessmentCriterion', 'PropertySet', 98, 'A criterion characterizing capability performance.', { attributes: { expression: text(true) } });
node('EffectivenessCriterion', 'AssessmentCriterion', 96, 'A criterion for assessing an intended effect.');
node('Measure', 'Measurement', 98, 'A defined measurement used to evaluate a criterion or constraint.', { attributes: { unit: text(true), value: { type: 'number' } } });
node('CapabilityGroup', 'UAFElement', 88, 'An explicit grouping of capabilities. Use GroupsCapability rather than relying on drawing containment.');
node('StrategicConstraint', 'Rule', 100, 'A constraint on capabilities. Also present in the ADMBw reference; ruleKind is inherited from UAF.');
node('Constraint', 'StrategicConstraint', 101, 'NAF C8 example vocabulary for a strategic constraint. Its type implies ruleKind Constraint; an explicit ruleKind, when supplied, must be Constraint.', { attributes: { ruleKind: { type: 'string', enum: ['Constraint'], required: false } } });
node('StrategicRationale', 'UAFElement', 100, 'A rationale supporting a planning constraint.');
node('CapabilityIncrement', 'UAFElement', 102, 'A planned increment of capability delivery, kept distinct from an ActualEnterprisePhase. Milestones may be explicit defining nodes, referenced as properties, or implicit in the p.103 presentation.', {
  template: 'node',
  attributes: { milestones: ref('CapabilityMilestone', false, true), startDate: { type: 'string', format: 'date-time' }, endDate: { type: 'string', format: 'date-time' } },
  comparisons: [{ left: 'startDate', op: '<=', right: 'endDate' }]
});
node('CapabilityMilestone', 'ProjectMilestone', 102, 'A milestone defining a capability increment.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('CapabilityProject', 'Project', 102, 'A project scheduling capability milestones.');
edge('CapabilityAggregation', 'Capability', 'Capability', 88, 'Whole capability to component capability.', { style: 'composition', acyclic: true });
edge('GroupsCapability', 'CapabilityGroup', 'Capability', 88, 'Group to member capability.');
edge('CapabilityGroupDependency', 'CapabilityGroup', 'CapabilityGroup', '88, 92', 'Dependent capability group to required capability group.');
edge('AggregatesCapabilityGroup', 'CapabilityGroup', 'CapabilityGroup', 92, 'Whole capability group to subgroup.', {style:'composition',acyclic:true});
edge('SupportsEnduringTask', 'Capability', 'EnduringTask ActualEnduringTask', 90, 'Capability to the enduring task it supports.', {style:'flow'});
edge('GoalRelatesEnduringTask', 'EnterpriseGoal', 'EnduringTask ActualEnduringTask', 90, 'Goal to a related enduring task.');
edge('RequiresCapability', 'EnterpriseVision', 'Capability', 90, 'Vision to required capability.');
edge('SpecifiesGoal', 'EnterpriseVision', 'EnterpriseGoal', 90, 'Vision to its goals.');
edge('DesiresCapability', 'EnterprisePhase ActualEnterprisePhase', 'Capability', 90, 'Enterprise phase to desired capability.');
edge('DesiresVision', 'EnterprisePhase ActualEnterprisePhase', 'EnterpriseVision', 90, 'Enterprise phase to desired vision, as shown in the C2 cut-out and the p.91 example.');
edge('DesiresGoal', 'EnterprisePhase ActualEnterprisePhase', 'EnterpriseGoal', 90, 'Enterprise phase to desired goal, as shown in the C2 cut-out.');
edge('CharacterizesCapability', 'AssessmentCriterion', 'Capability', 98, 'Performance criterion to the capability characterized, following the C7 cut-out direction.');
edge('EvaluatesCriterion', 'Measure', 'AssessmentCriterion', 98, 'Measure to evaluated criterion.');
edge('SpecifiesEffectiveness', 'Capability', 'EffectivenessCriterion', 96, 'Capability to effectiveness criterion.');
edge('CharacterizesEffect', 'EffectivenessCriterion', 'Effect', 96, 'Effectiveness criterion to the effect assessed.');
edge('ConstrainsCapability', 'StrategicConstraint', 'Capability', 100, 'Planning constraint to the capability constrained.');
edge('JustifiesStrategy', 'StrategicRationale', 'StrategicConstraint', 100, 'Rationale to planning constraint.');
edge('OriginatesFromRationale', 'StrategicConstraint', 'StrategicRationale', 100, 'Constraint to its originating rationale, following the C8 cut-out. JustifiesStrategy remains the explicit inverse application relationship.');
edge('DefinesIncrement', 'CapabilityMilestone', 'CapabilityIncrement', 102, 'Milestone to the increment defined.');
edge('DeliversCapability', 'CapabilityIncrement', 'Capability', 102, 'Increment to delivered capability.');
edge('RelatesToEnterprisePhase', 'CapabilityIncrement', 'EnterprisePhase', 102, 'Capability increment to a related planning enterprise phase, following the Cr cut-out and p.103 example. Distinct from AchievedEffect, whose target must be an ActualState.');
edge('AggregatesEnterprisePhase', 'EnterprisePhase', 'EnterprisePhase', 102, 'Whole planning phase to a temporal subphase, following aggregates on pp.102–103. Binary application projection of temporal membership, not an imported UAF TemporalPart property or UML composition.', { acyclic: true });
edge('TriggersEnterprisePhase', 'EnterprisePhase', 'EnterprisePhase', 102, 'Triggering planning phase to a following phase, following triggers on pp.102–103. A directed planning dependency, not an executable state transition or a calculated date constraint.', { acyclic: true });
edge('SchedulesCapability', 'CapabilityProject', 'CapabilityMilestone', 102, 'Project to scheduled milestone.');
edge('DefinesCapabilityEvolution', 'CapabilityProject', 'Capability', 102, 'Capability project to the capability whose evolution it defines.');
edge('ConfigurationRealizesCapability', 'CapabilityConfiguration', 'Capability', 102, 'Capability configuration to the capability it realizes.', {style:'realization'});
edge('EffectGeneralization', 'Effect', 'Effect', 96, 'Specialized effect to general effect.', {style:'generalization',acyclic:true});

// Service structure, explicit state/lifeline/parameter adapters.
node('ServiceGroup', 'UAFElement', 104, 'A grouping of service specifications.');
node('ServiceConstraint', 'Rule', 121, 'An individual constraint grouped by a service policy.');
node('ServiceFunctionParameter', 'ServiceParameter', 119, 'Conceptual parameter of a service function. Use HasServiceFunctionParameter and InvolvesLogicalResource or the owner/resource references.', { attributes: { owner: ref('ServiceFunction', false), resource: ref('OperationalExchangeItem PhysicalPassiveResource DataElement', false) }, limitations: ['Logical payloads use the UAF OperationalExchangeItem category, including InformationProduct and InformationElement. Legacy physical resource references remain accepted for compatibility; InvolvesLogicalResource itself accepts only logical payloads. S7 requires function ownership, visibility of known payload mappings and review of unmodeled payloads.'] });
node('ServiceOperationParameter', 'ServiceParameter', 110, 'Conceptual parameter of one or more service operations. Use incoming HasServiceOperationParameter links or the legacy scalar owner reference. A physical-resource trace is optional in S3; S7 requires known mappings to be visible and reports unmodeled mappings for review.', {
  attributes: { owner: ref('ServiceMethod', false), resource: ref('PhysicalPassiveResource DataElement', false) },
  limitations: ['The p.110 shared parameter is a conceptual reusable parameter, not one UML owned Parameter shared by multiple owners. S3/S7 viewpoint checks require operation association through visible links or owner; optional resource links use InvolvesPhysicalResource.'],
});
node('DataProductType', 'DataElement PhysicalPassiveResource', 110, 'Type of a physical data product, as used by the Position Report and Target Track Record in the S3 example. A specialization of UAF DataElement and the application passive-resource category, not a synonym for every DataElement.', { styleGroup: 'physical' });
node('ServiceState', 'UAFElement', 113, 'A state belonging to a service; use HasServiceState or the legacy owner reference. Distinct from a UAF StateDescription.', { attributes: { owner: ref('ServiceSpecification', false) } });
node('ServiceStateTransition', 'UAFElement', 114, 'Objectified form of a ServiceStateTransition relationship. Bind it using the transition attribute on exactly one selected state-to-state edge in S5; endpoints belong to that edge.');
node('ServiceStateGroup', 'UAFElement', 114, 'A grouping of service states, optionally containing nested state groups.');
node('ServiceEvent', 'UAFElement', 113, 'An event relevant to service behavior.');
node('ServiceMode', 'UAFElement', 113, 'A mode of a service function; use HasServiceMode or the legacy function reference.', { attributes: { function: ref('ServiceFunction', false) } });
node('ServiceLifeline', 'UAFElement', 116, 'A timeline representing a service; use RepresentsService or the legacy represents reference. It is not an objectified message.', { attributes: { represents: ref('ServiceSpecification', false) } });
node('ServiceInteraction', 'UAFElement', 117, 'Objectified form of a message between service lifelines. Bind through the interaction reference on a ServiceInteraction edge.');
node('ServiceReadinessLevel', 'PropertySet', 123, 'A defined service readiness level.');
node('ServiceMilestone', 'ProjectMilestone', 123, 'A milestone defining service readiness.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('ServiceProject', 'Project', 123, 'A project scheduling service milestones.');
edge('ServiceComposition', 'ServiceSpecification', 'ServiceSpecification', 106, 'Whole service to component service.', { style: 'composition', acyclic: true });
edge('ServiceAggregation', 'ServiceSpecification', 'ServiceSpecification', 107, 'Whole service to a member service, following aggregates in the S2 cut-out and p.108 example. A separate directed grouping relation, not an alias of ServiceComposition and not exclusive composition ownership.', { style: 'flow', acyclic: true,
  limitations: ['Binary application projection rendered as a solid directed link. Self-links/cycles are disallowed; multiple aggregating services may reference the same member. Full UML shared-aggregation, ownership and lifecycle semantics are not implemented.'],
});
edge('ServiceDependency', 'ServiceSpecification', 'ServiceSpecification', 106, 'Dependent service to required service. Restricted service-to-service subset of the ADMBw relationship.');
edge('ConsumesService', 'OperationalArchitecture ServiceConsumer', 'ServiceSpecification', 107, 'Logical node or explicit S4 consumer role to the service it consumes. Native UAF Consumes remains OperationalActivity to ServiceSpecification.');
edge('EnablesService', 'ServiceFunction', 'ServiceSpecification', 107, 'Service function to the service it enables, following the S2 cut-out and p.108 example. The native IsCapableToPerform relation remains service to function.');
edge('RealizesService', 'ResourcePerformer', 'ServiceSpecification', 107, 'Physical active resource to the service it realizes, following the S2 cut-out and p.108 example. Native Implements retains its UAF endpoint pairs.', { style: 'realization' });
for (const role of ['ServiceProvider','ServiceConsumer']) node(role, 'UAFElement', 111, `Explicit ${role === 'ServiceProvider' ? 'provider' : 'consumer'} role in the S4 service context. Not an alias of an operational performer or a native UAF stereotype.`, {attributes: {represents: ref('OperationalAgent ResourcePerformer ServiceSpecification', false)}});
edge('ServiceFunctionAggregation', 'ServiceFunction', 'ServiceFunction', 111, 'Whole function to constituent function. Shared membership is permitted; not UML exclusive ownership or executable activity decomposition.', {style:'flow', acyclic:true});
edge('ProvidesService', 'ServiceProvider', 'ServiceSpecification', 111, 'Provider role to the service it provides.', {style:'flow'});
edge('DeliversService', 'OperationalArchitecture', 'ServiceSpecification', 107, 'Logical Node to the service it delivers.', {style:'flow'});
edge('ServiceRoleReliesOnNode', 'ServiceProvider ServiceConsumer', 'OperationalArchitecture', 107, 'Explicit provider or consumer role to the logical Node it relies on.');
edge('NotifiesServiceProvider', 'ServiceFunction', 'ServiceProvider', 111, 'Service function to the provider role it notifies.', {style:'flow'});
edge('AccessesServiceFunction', 'ServiceConsumer', 'ServiceFunction', 111, 'Consumer role to the function it accesses.', {style:'flow'});
edge('SupportsServiceFunction', 'OperationalActivity', 'ServiceFunction', 111, 'Operational activity to the function it supports. Distinct from the inverse enables projection.', {style:'flow'});
edge('EnablesOperationalActivity', 'ServiceFunction ResourcePerformer', 'OperationalActivity', 111, 'Service function or physical active resource to the operational activity it enables.', {style:'flow',sources:[source(111),source(134)]});
edge('PerformsOperationalActivity', 'ServiceProvider ServiceConsumer OperationalArchitecture OperationalRole', 'OperationalActivity', 111, 'Service provider, service consumer, logical Node or Role to the operational activity it performs. Native IsCapableToPerform retains its existing endpoint rules.', {style:'flow',sources:[source(111),source('134–135')]});
for (const name of ['ConsumesService','EnablesService']) relationTypes[name].sources.push(source(111));
edge('GroupsService', 'ServiceGroup', 'ServiceSpecification', 104, 'Group to member service.');
edge('AggregatesServiceGroup', 'ServiceGroup', 'ServiceGroup', 104, 'Whole service group to a member group, following the recursive grouping in the S1 cut-out. Acyclic binary membership projection, not strong UML composition.', { acyclic: true });
edge('SpecifiesServiceInterface', 'ServiceSpecification', 'ServiceInterface', 109, 'Service to specified interface.');
edge('SpecifiesServiceOperation', 'ServiceInterface', 'ServiceMethod', 109, 'Interface to operation.');
edge('HasServiceOperationParameter', 'ServiceMethod', 'ServiceOperationParameter', 109, 'Service operation to its conceptual parameter, following has on pp.109–110. The same parameter may be associated with multiple operations; this is not UML exclusive ownership.', { style: 'flow' });
edge('HasServiceFunctionParameter', 'ServiceFunction', 'ServiceFunctionParameter', 119, 'Service function to its conceptual parameter, following the has association on pp.119–120.', { style: 'flow' });
edge('InvolvesLogicalResource', 'ServiceFunctionParameter', 'OperationalExchangeItem', 119, 'Service function parameter to a logical passive resource, including InformationProduct or InformationElement, following pp.119–120. Uses the native UAF OperationalExchangeItem category; physical data products are not valid targets.', { style: 'flow' });
edge('InvolvesPhysicalResource', 'ServiceOperationParameter', 'PhysicalPassiveResource DataElement', 109, 'Service operation parameter to the physical passive resource or data product it involves, following pp.109–110. Data Model trace is indirect through that resource; DataModel is not a valid direct target.', { style: 'flow' });
edge('ServicePolicySatisfiedBy', 'ServicePolicy', 'ServiceSpecification', 104, 'Policy to a service satisfying it. Retained inverse application relationship; use SatisfiesServicePolicy for the service-to-policy direction shown on pp.104–105.');
edge('SatisfiesServicePolicy', 'ServiceSpecification', 'ServicePolicy', 104, 'Service to the policy it satisfies, following the S1 cut-out and p.105 example. ServicePolicySatisfiedBy remains the explicit inverse application relationship.');
edge('GroupsServiceConstraint', 'ServicePolicy', 'ServiceConstraint', 121, 'Policy to member constraint.');
edge('EvaluatesServiceConstraint', 'Measure', 'ServiceConstraint', 121, 'Measure to evaluated service constraint.');
edge('ServiceStateTransition', 'ServiceState', 'ServiceState', 113, 'Source state to target state. An optional transition reference binds its objectified form; an optional event retains the legacy compact representation.', { allowSelf: true,
  attributes: { event: ref('ServiceEvent', false), transition: ref('ServiceStateTransition', false) },
  stateTrigger: 'event',
  referenceLabels: {transition:'is equal to'}, referenceDisplay:'nodes', referenceConnectorLabels:true });
edge('HasServiceState', 'ServiceSpecification', 'ServiceState', 114, 'Service to one of its states.', {style:'flow'});
edge('TriggersServiceStateTransition', 'ServiceEvent', 'ServiceStateTransition', 114, 'Service event to the objectified transition it triggers.', {style:'flow'});
edge('StateEnablesServiceFunction', 'ServiceState', 'ServiceFunction', 114, 'Service state to a function it enables.', {style:'flow'});
edge('HasServiceMode', 'ServiceFunction', 'ServiceMode', 114, 'Service function to one of its modes.', {style:'flow'});
edge('GroupsServiceState', 'ServiceStateGroup', 'ServiceState', 114, 'State group to a member state.', {style:'flow'});
edge('AggregatesServiceStateGroup', 'ServiceStateGroup', 'ServiceStateGroup', 114, 'State group to a nested state group. Shared grouping, not exclusive UML ownership.', {style:'flow',acyclic:true});
edge('EnablesServiceMode', 'ServiceState', 'ServiceMode', 113, 'State to enabled mode.');
edge('ServiceInteraction', 'ServiceLifeline', 'ServiceLifeline', 116, 'Ordered message between service lifelines; interaction binds the optional objectified form. Compact event/operation references remain valid.', { allowSelf: true, sequenceMessage:true,
  attributes: { order: { type: 'integer', required: true, min: 1 }, event: ref('ServiceEvent', false), operation: ref('ServiceMethod', false), interaction: ref('ServiceInteraction', false) },
  referenceLabels:{interaction:'is equal to'}, referenceDisplay:'nodes', referenceConnectorLabels:true });
edge('RepresentsService', 'ServiceLifeline', 'ServiceSpecification', 117, 'Lifeline to the service whose timeline it represents.', {style:'flow'});
edge('TriggersServiceInteraction', 'ServiceEvent', 'ServiceInteraction', 117, 'Event to the objectified interaction it triggers.', {style:'flow'});
edge('InteractionRelatesOperation', 'ServiceInteraction', 'ServiceMethod', 117, 'Objectified interaction to a related service operation.', {style:'flow'});
edge('DefinesServiceReadiness', 'ServiceMilestone', 'ServiceReadinessLevel', 123, 'Milestone to readiness level.');
edge('FulfilsServiceReadiness', 'ServiceSpecification', 'ServiceReadinessLevel', 123, 'Service to readiness level fulfilled.');
edge('SchedulesService', 'ServiceProject', 'ServiceMilestone', 123, 'Project to scheduled service milestone.');
edge('DefinesServiceEvolution', 'ServiceProject', 'ServiceSpecification', 123, 'Service project to the service whose evolution it defines.');

// Logical: a needline is reified so it can be referenced by an interaction.
node('LogicalNode', 'OperationalArchitecture', 126, 'Convenience subtype of OperationalArchitecture for a NAF logical node. OperationalArchitecture remains usable directly.');
node('LogicalActor', 'OperationalPerformer', 127, 'A logical actor, such as the Crew in the L1 example. A distinct concrete specialization of OperationalPerformer; not an alias or a physical person instance.', {template:'person',styleGroup:'logical',sources:[source('126–127')]});
node('LogicalEquipment', 'OperationalPerformer', 127, 'Logical equipment, such as a communication device, rescue vessel or surveillance system in L1. A distinct concrete specialization of OperationalPerformer; physical implementation belongs to the resource domain.', {template:'node',styleGroup:'logical',sources:[source('126–127')]});
node('Needline', 'UAFElement', 128, 'Objectified form of a need for exchanges between logical nodes. Bind with the needline attribute of a Needline edge; legacy source/target references remain supported as a pair.', { attributes: { source: ref('OperationalArchitecture',false), target: ref('OperationalArchitecture',false), conveyed: ref('OperationalExchangeItem', false, true) },sources:[source('128–129')] });
node('LogicalInteraction', 'UAFElement', 131, 'Objectifies a logical interaction between resources or lifelines. Bind it through interaction on the corresponding relationship.', { sources:[source(131),source(139)] });
node('OperationalFlow', 'UAFElement', 134, 'Objectified operational flow between activities. Bind using the flow attribute on the corresponding OperationalFlow edge. Use ConveysLogicalResource to link its payload.');
node('LogicalState', 'UAFElement', 136, 'A state of a logical active resource. Use HasLogicalState or the compact owner reference.', { attributes: { owner: ref('OperationalAgent', false) } });
node('LogicalEvent', 'UAFElement', 136, 'An event relevant to logical behavior.', {sources:[source(134),source(136)]});
node('LogicalMode', 'UAFElement', 136, 'A mode of an operational activity or logical function. Use HasLogicalMode or the compact activity reference.', { attributes: { activity: ref('OperationalActivity', false) } });
node('LogicalFunction', 'UAFElement', 137, 'A logical function enabled by a logical state.');
node('LogicalTransition', 'UAFElement', 137, 'Objectified form of a LogicalStateTransition edge. Bind it with the transition attribute on the edge.');
node('LogicalStateGroup', 'UAFElement', 137, 'A group of logical states that can aggregate nested state groups.');
node('LogicalLifeline', 'UAFElement', 139, 'A lifeline representing a logical active resource through RepresentsLogicalResource or the compact represents reference.', { attributes: { represents: ref('OperationalAgent', false) } });
node('InformationModel', 'UAFElement', 141, 'A model defining information entities.');
node('InformationEntity', 'InformationElement', 142, 'An information concept specified by an information model. A concrete application subtype of UAF InformationElement for the L7 vocabulary.', {sources:[source('141–142')]});
node('InformationAttribute', 'UAFElement', 141, 'An attribute of an information entity. Use AggregatesInformationAttribute and optional HasInformationAttributeType links, or the compact owner and attributeType references.', { attributes: { owner: ref('InformationElement', false), attributeType: ref('InformationAttributeType', false) } });
node('InformationAttributeType', 'UAFElement', 141, 'A type used by information attributes.');
node('InformationProduct', 'OperationalExchangeItem', 141, 'An information product represented by an information model; also used as the logical payload of a ServiceFunctionParameter in S7.', {sources:[source(120),source(141)]});
node('LogicalConstraint', 'OperationalConstraint', 143, 'A constraint on logical resources or behavior in L8. Its type implies ruleKind Constraint.', {attributes:{ruleKind:{type:'string',enum:['Constraint'],required:false}},sources:[source('143–144')]});
node('LogicalRequirement', 'Requirement', 143, 'A logical requirement related to a logical constraint or applied directly to a logical subject.');
node('LogicalSpecification', 'UAFElement', 143, 'A grouping of logical requirements and constraints.');
node('LogicalRationale', 'UAFElement', 143, 'A rationale for a logical constraint.');
node('LogicalReadinessLevel', 'PropertySet', 145, 'A defined logical resource readiness level.');
node('LogicalMilestone', 'ProjectMilestone', 145, 'A milestone defining logical readiness.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('LogicalProject', 'Project', 145, 'A project scheduling logical milestones.');
edge('GroupsLogicalResource', 'OperationalArchitecture', 'OperationalAgent OperationalActivity LogicalFunction OperationalExchangeItem', 126, 'Logical node to the resources/behavior it groups.');
edge('NeedsCapability', 'OperationalArchitecture', 'Capability', 126, 'Logical Node to a capability it needs. Exhibits retains its separate capability-support mapping.');
edge('LogicalBehaviorGeneralization', 'OperationalActivity LogicalFunction', 'OperationalActivity LogicalFunction', 126, 'A specialized logical behavior to a more general behavior of the same kind.', {style:'generalization',acyclic:true,pairs:[{from:['OperationalActivity'],to:['OperationalActivity']},{from:['LogicalFunction'],to:['LogicalFunction']}]});
edge('Needline', 'OperationalArchitecture', 'OperationalArchitecture', 128, 'Need for key or aggregated exchanges between logical nodes. An optional needline reference binds the objectified form. L2 shows the logical structure; L3 can show the same Needline as context.', {style:'flow',attributes:{needline:ref('Needline',false)},referenceLabels:{needline:'is equal to'},referenceDisplay:'nodes',referenceConnectorLabels:true,sources:[source('128–129'),source(131)]});
edge('ConveysLogicalResource', 'Needline OperationalFlow LogicalInteraction', 'OperationalExchangeItem', 128, 'Objectified needline, operational flow or logical interaction to its logical payload.', {style:'flow',sources:[source(128),source(131),source(134)]});
edge('RealizesNeedline', 'LogicalInteraction', 'Needline', 131, 'Objectified logical interaction to the needline it realizes.', {style:'realization'});
edge('LogicalDependency', 'OperationalAgent', 'OperationalAgent', 128, 'Logical structural dependency. A Needline is modeled separately.');
edge('LogicalInteraction', 'OperationalAgent', 'OperationalAgent', 131, 'Logical interaction with a typed payload. The optional interaction binds its object representation.', { style: 'flow', attributes: { conveyed: ref('OperationalExchangeItem', false, true), volume: {type:'number', min:0}, needline: ref('Needline', false), interaction: ref('LogicalInteraction', false) }, referenceLabels:{conveyed:'Conveys',interaction:'is equal to'}, referenceDisplay:'nodes' });
edge('HoldsRole', 'OperationalArchitecture', 'OperationalRole', 134, 'Logical Node to a Role held in its context.', {style:'flow',sources:[source('134–135')]});
edge('LogicalControlFlow', 'OperationalActivity', 'OperationalActivity', 133, 'Control flow between operational activity definitions, as shown in L4. The NAF profile also accepts OperationalControlFlow for these endpoints.', {style:'flow',allowSelf:true,activityFlow:true,sources:[source('133–135')]});
edge('LogicalObjectFlow', 'OperationalActivity', 'OperationalActivity', 133, 'Flow of logical passive resources between activity definitions.', { style: 'flow', allowSelf: true, attributes: { conveyed: ref('OperationalExchangeItem', true, true) } });
edge('OperationalFlow', 'OperationalActivity', 'OperationalActivity', 134, 'Flow between operational activity definitions. The optional flow reference binds the objectified form for a captioned is equal to connector.', {
  style:'flow',allowSelf:true,attributes:{flow:ref('OperationalFlow',false)},
  referenceLabels:{flow:'is equal to'},referenceDisplay:'nodes',referenceConnectorLabels:true,
});
edge('OperationalActivityAggregation', 'OperationalActivity', 'OperationalActivity', 134, 'Whole operational activity to a constituent activity.', {style:'flow',acyclic:true});
edge('ActsUponLogicalResource', 'OperationalActivity', 'OperationalExchangeItem', 134, 'Operational activity to a logical passive resource it acts upon.', {style:'flow'});
edge('TriggersOperationalActivity', 'LogicalEvent', 'OperationalActivity', 134, 'Logical event to the operational activity it triggers.', {style:'flow'});
edge('TriggersLogicalEvent', 'OperationalActivity', 'LogicalEvent', 134, 'Operational activity to the logical event it triggers.', {style:'flow'});
edge('RelatesServiceToOperationalActivity', 'ServiceSpecification', 'OperationalActivity', 134, 'Service to a related operational activity, following the L4 cut-out direction.', {style:'flow'});
edge('LogicalStateTransition', 'LogicalState', 'LogicalState', '136–138', 'Source state to target state. Use event for a compact trigger and transition to bind the objectified form.', {
  allowSelf: true, attributes: {event: ref('LogicalEvent', false), transition: ref('LogicalTransition', false)},
  stateTrigger: 'event',
  referenceLabels: {event:'triggers', transition:'is equal to'}, referenceDisplay:'nodes', referenceConnectorLabels:true,
});
edge('HasLogicalState', 'OperationalAgent', 'LogicalState', '137–138', 'Logical active resource, including a Node or LogicalActor, to one of its states.', {style:'flow'});
edge('TriggersLogicalTransition', 'LogicalEvent', 'LogicalTransition', 137, 'Logical event to the objectified transition it triggers.', {style:'flow'});
edge('StateEnablesOperationalActivity', 'LogicalState', 'OperationalActivity', 137, 'Logical state to an operational activity it enables.', {style:'flow'});
edge('StateEnablesLogicalFunction', 'LogicalState', 'LogicalFunction', 137, 'Logical state to a logical function it enables.', {style:'flow'});
edge('HasLogicalMode', 'OperationalActivity LogicalFunction', 'LogicalMode', 137, 'Operational activity or logical function to one of its modes.', {style:'flow'});
edge('GroupsLogicalState', 'LogicalStateGroup', 'LogicalState', 137, 'Logical state group to a member state.', {style:'flow'});
edge('AggregatesLogicalStateGroup', 'LogicalStateGroup', 'LogicalStateGroup', 137, 'Logical state group to a nested group.', {style:'flow',acyclic:true});
edge('EnablesLogicalMode', 'LogicalState', 'LogicalMode', 136, 'State to enabled activity mode.');
edge('RepresentsLogicalResource', 'LogicalLifeline', 'OperationalAgent', 139, 'Lifeline to the logical active resource whose timeline it represents, following the L6 cut-out and example.', {style:'flow',sequenceContext:'above',sources:[source('139–140')]});
edge('LogicalSequenceInteraction', 'LogicalLifeline', 'LogicalLifeline', 139, 'Ordered interaction between logical lifelines.', { allowSelf: true, sequenceMessage:true, attributes: { order: { type: 'integer', required: true, min: 1 }, event: ref('LogicalEvent', false), activity: ref('OperationalActivity', false), interaction: ref('LogicalInteraction',false) }, referenceLabels:{interaction:'is equal to'},referenceDisplay:'nodes',referenceConnectorLabels:true });
edge('TriggersLogicalInteraction', 'LogicalEvent', 'LogicalInteraction', 139, 'A logical event triggers an objectified interaction.', {style:'flow'});
edge('LogicalInteractionRelatesBehavior', 'LogicalInteraction', 'LogicalFunction OperationalActivity', 139, 'Objectified interaction to its logical function or operational activity.', {style:'flow'});
edge('SpecifiesInformation', 'InformationModel', 'InformationElement', 141, 'Information model to an information entity or legacy InformationElement.', {sources:[source('141–142')]});
edge('RepresentsInformationProduct', 'InformationModel', 'InformationProduct', 141, 'Information model to represented product, following the L7 scope and cut-out.');
edge('AggregatesInformationAttribute', 'InformationElement', 'InformationAttribute', 141, 'Information entity to one of its attributes, following the L7 cut-out.', {style:'flow'});
edge('HasInformationAttributeType', 'InformationAttribute', 'InformationAttributeType', 141, 'Information attribute to its type, following the L7 cut-out.', {style:'flow'});
edge('LogicalRequirementConstraint', 'LogicalRequirement', 'OperationalConstraint', 143, 'Requirement to related logical constraint.');
const logicalConstraintSubjects = 'OperationalAgent OperationalActivity LogicalFunction OperationalExchangeItem';
edge('ConstrainsLogical', 'OperationalConstraint LogicalRequirement', logicalConstraintSubjects, 143, 'Logical constraint or requirement to the logical resource or behavior it applies to.', {sources:[source('143–144')]});
edge('GroupsLogicalConstraint', 'LogicalSpecification', 'LogicalRequirement OperationalConstraint', 143, 'Specification to requirement or constraint.');
edge('JustifiesLogical', 'LogicalRationale', 'OperationalConstraint', 143, 'Rationale to logical constraint.');
edge('TracesStrategicConstraint', 'OperationalConstraint', 'StrategicConstraint', 143, 'Logical constraint to strategic constraint traced.');
edge('OriginatesFromLogicalRationale', 'OperationalConstraint', 'LogicalRationale', 143, 'Logical constraint to its originating rationale, following the L8 cut-out.', {style:'flow'});
edge('OriginatesFromStrategicConstraint', 'LogicalRationale', 'StrategicConstraint', 143, 'Logical rationale to the strategic constraint it originates from, following the L8 cut-out.', {style:'flow'});
edge('DefinesLogicalReadiness', 'LogicalMilestone', 'LogicalReadinessLevel', 145, 'Milestone to readiness level.');
edge('LogicalReadinessFulfilsResource', 'LogicalReadinessLevel', 'OperationalAgent', 145, 'Readiness level to the logical active resource it fulfils, as drawn in the Lr cut-out and example.', {style:'flow',sources:[source('145–146')]});
edge('FulfilsLogicalReadiness', 'OperationalAgent', 'LogicalReadinessLevel', 145, 'Legacy inverse direction from the logical active resource to its readiness level. For the NAF arrow direction use LogicalReadinessFulfilsResource.');
edge('TracesCapabilityIncrement', 'LogicalReadinessLevel', 'CapabilityIncrement', 145, 'Logical readiness to capability increment traced.');
edge('SchedulesLogical', 'LogicalProject', 'LogicalMilestone', 145, 'Project to scheduled logical milestone.');
edge('DefinesLogicalEvolution', 'LogicalProject', 'OperationalAgent', 145, 'Logical project to the logical active resource whose evolution it defines.', {style:'flow'});

// Physical: passive resources and interactions have independent identities.
node('EquipmentType', 'ResourceArtifact', 149, 'A type of physical equipment in the P1 taxonomy. A concrete specialization of UAF ResourceArtifact with the inherited isStandardConfiguration attribute.');
node('PhysicalPassiveResource', 'ResourceExchangeItem', 150, 'Abstract category for passive physical resources in this application mapping.', { abstract: true });
node('DataEntity', 'DataElement PhysicalPassiveResource', 165, 'Data entity; inherits UAF DataElement and the passive-resource application category.');
node('PhysicalMaterial', 'PhysicalPassiveResource', 150, 'Passive material exchanged or consumed by resources.');
node('ResourceInteraction', 'UAFElement', 153, 'Objectified interaction bound by a physical relationship or a lifeline message. Legacy performer endpoint pairs remain supported.', { attributes: { source: ref('ResourcePerformer', false), target: ref('ResourcePerformer', false), conveyed: ref('PhysicalPassiveResource DataElement', false, true) }, sources:[source(151),source(154),source(163)] });
node('ResourceFlow', 'UAFElement', 157, 'Objectified flow bound through flow on a ResourceFlow relationship.');
node('ResourceState', 'UAFElement', 161, 'A state of a physical active resource. Use an explicit HasResourceState link or the compact owner reference.', { attributes: { owner: ref('ResourcePerformer',false) } });
node('ResourceTransition', 'UAFElement', 161, 'Objectified state transition bound through transition on a ResourceStateTransition relationship.');
node('ResourceStateGroup', 'UAFElement', 161, 'A group of resource states or nested state groups.');
node('ResourceEvent', 'UAFElement', 161, 'An event relevant to resource behavior.');
node('ResourceMode', 'UAFElement', 161, 'A mode of a resource function. Use HasResourceMode or the compact function reference.', { attributes: { function: ref('Function',false) } });
node('ResourceLifeline', 'UAFElement', 163, 'A lifeline representing a physical active resource through RepresentsResource or the represents reference.', { attributes: { represents: ref('ResourcePerformer',false) } });
node('DataAttribute', 'UAFElement', 165, 'An attribute of a data entity. Use explicit links or the legacy owner and attributeType references.', { attributes: { owner: ref('DataElement',false), attributeType: ref('DataAttributeType',false) } });
node('DataAttributeType', 'UAFElement', 165, 'A type used by data attributes.');
node('ActualDataProduct', 'ActualResource', 166, 'A recorded data product represented by a data model.');
node('PhysicalCharacteristic', 'PropertySet', 166, 'A physical characteristic of a data entity or attribute.');
node('ResourceRequirement', 'Requirement', 168, 'A physical resource requirement related to a resource constraint.');
node('ResourceSpecification', 'UAFElement', 168, 'A grouping of resource requirements/constraints.');
node('ResourceRationale', 'UAFElement', 168, 'A rationale for a resource constraint.');
node('ResourceReadinessLevel', 'PropertySet', 170, 'A defined physical resource readiness level.');
node('ResourceMilestone', 'ProjectMilestone', 170, 'A milestone defining resource readiness.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('ResourceProject', 'Project', 170, 'A project scheduling resource milestones.');
edge('GroupsPhysicalResource', 'CapabilityConfiguration', 'ResourcePerformer PhysicalPassiveResource DataElement', 150, 'Capability configuration to member active/passive resource.', { sources: [source('148–149'), source(150)] });
edge('PhysicalDependency', 'ResourcePerformer', 'ResourcePerformer PhysicalPassiveResource DataElement', 150, 'Physical active resource to required active/passive resource.', { sources: [source(148), source(150)] });
edge('ResourceAggregation', 'ResourcePerformer', 'ResourcePerformer', 148, 'Whole physical active resource to an aggregated active resource.', { style: 'flow', acyclic: true });
edge('ResourceFunctionAggregation', 'Function', 'Function', 148, 'Whole resource function to a constituent resource function.', { style: 'flow', acyclic: true });
edge('UsesResourceFunction', 'ResourcePerformer', 'Function', 148, 'A physical active resource uses a resource function. The performs allocation is modeled with IsCapableToPerform.', { style: 'flow', pairs: [{ from: ['ResourcePerformer'], to: ['Function'], toExclude: ['ProjectActivity'] }] });
edge('RealizesLogicalFunction', 'Function', 'LogicalFunction', 148, 'Resource function to the logical function it realizes. Use UAF Implements for traces to a service function or operational activity.', { style: 'realization' });
edge('FunctionGeneralization', 'Function', 'Function', 147, 'Specialized function to general function.', { style: 'generalization', acyclic: true });
edge('InteractionConformsTo', 'ResourceInteraction', 'Standard', 153, 'Interaction to governing standard/protocol. Protocol is a UAF Standard subtype.');
edge('ResourceImplementsProtocol', 'ResourcePerformer', 'Protocol', 153, 'Resource to implemented protocol; direct projection, not ADMBw ProtocolImplementation reification.');
edge('UsesPhysicalResource', 'Function', 'PhysicalPassiveResource DataElement', 156, 'Function to passive resource used.');
edge('DeliversPhysicalResource', 'Function', 'PhysicalPassiveResource DataElement', 156, 'Function to passive resource delivered.');
edge('FunctionalFlow', 'Function', 'Function', 156, 'Control flow between function definitions (not action-level FunctionControlFlow).', { style: 'flow', allowSelf: true, activityFlow:true });
edge('ResourceInteraction', 'ResourcePerformer', 'ResourcePerformer', 151, 'Interaction between physical active resources. Bind its optional object card through interaction.', {style:'flow',allowSelf:true,attributes:{interaction:ref('ResourceInteraction',false)},referenceLabels:{interaction:'is equal to'},referenceDisplay:'nodes',referenceConnectorLabels:true});
edge('PassiveResourceAggregation', 'PhysicalPassiveResource DataElement', 'PhysicalPassiveResource DataElement', 151, 'Whole physical passive resource to its part.', {style:'flow',acyclic:true});
edge('RealizesLogicalInteraction', 'ResourceInteraction', 'LogicalInteraction', 151, 'Objectified physical interaction to its logical trace.', {style:'realization'});
edge('RealizesLogicalResource', 'PhysicalPassiveResource DataElement', 'OperationalExchangeItem', 151, 'Physical passive resource to the logical passive resource it realizes.', {style:'realization'});
edge('ConveysPhysicalResource', 'ResourceInteraction ResourceFlow', 'PhysicalPassiveResource DataElement', 154, 'An objectified physical interaction or flow to its conveyed resource.', {style:'flow',sources:[source(154),source(157)]});
edge('ResourceFlow', 'Function', 'Function', 156, 'Passive-resource flow between function definitions. A payload or bound flow object may be supplied.', { style: 'flow', allowSelf: true, attributes: { conveyed: ref('PhysicalPassiveResource DataElement', false, true), flow:ref('ResourceFlow',false) }, referenceLabels:{conveyed:'Conveys',flow:'is equal to'},referenceDisplay:'nodes',referenceConnectorLabels:true });
edge('ResourceStateTransition', 'ResourceState', 'ResourceState', 161, 'Source state to target state. Optionally bind a transition object or record a triggering event.', { allowSelf: true, stateTrigger:'event', attributes: { event: ref('ResourceEvent', false), transition:ref('ResourceTransition',false) }, referenceLabels:{event:'triggers',transition:'is equal to'},referenceDisplay:'nodes',referenceConnectorLabels:true });
edge('HasResourceState', 'ResourcePerformer', 'ResourceState', 161, 'Physical active resource to a state it can occupy.', {style:'flow'});
edge('HasResourceMode', 'Function', 'ResourceMode', 161, 'Resource function to one of its modes.', {style:'flow'});
edge('GroupsResourceState', 'ResourceStateGroup', 'ResourceState ResourceStateGroup', 161, 'Resource state group to a member state or group.', {style:'flow',acyclic:true});
edge('StateEnablesResourceFunction', 'ResourceState', 'Function', 161, 'A resource state enables a resource function.', {style:'flow'});
edge('ResourceStateRelatesLogicalState', 'ResourceState', 'LogicalState', 161, 'Resource state to a related logical state.', {style:'dependency'});
edge('TriggersResourceTransition', 'ResourceEvent', 'ResourceTransition', 161, 'Resource event to the objectified transition it triggers.', {style:'flow'});
edge('EnablesResourceMode', 'ResourceState', 'ResourceMode', 161, 'State to enabled function mode.');
edge('ResourceSequenceInteraction', 'ResourceLifeline', 'ResourceLifeline', 163, 'Ordered interaction between resource lifelines.', { allowSelf: true, sequenceMessage:true, attributes: { order: { type: 'integer', required: true, min: 1 }, event: ref('ResourceEvent', false), function: ref('Function', false), interaction:ref('ResourceInteraction',false) }, referenceLabels:{interaction:'is equal to'},referenceDisplay:'nodes',referenceConnectorLabels:true });
edge('RepresentsResource', 'ResourceLifeline', 'ResourcePerformer', 163, 'Resource lifeline to the physical resource whose timeline it represents.', {style:'flow',sequenceContext:'above'});
edge('TriggersResourceInteraction', 'ResourceEvent', 'ResourceInteraction', 163, 'Event to the objectified interaction it triggers.', {style:'flow'});
edge('ResourceInteractionRelatesFunction', 'ResourceInteraction', 'Function', 163, 'Objectified interaction to the resource function it relates to.', {style:'flow'});
edge('SpecifiesData', 'DataModel', 'DataElement', 165, 'Data model to entity.');
edge('TracesInformationModel', 'DataModel', 'InformationModel', 165, 'Data model to information model traced.');
edge('RepresentsDataProduct', 'DataModel', 'ActualDataProduct', 166, 'Data model to the actual data product it represents.', {style:'flow'});
edge('AggregatesDataEntity', 'DataElement', 'DataElement', 166, 'Whole data entity to a constituent entity.', {style:'flow',acyclic:true});
edge('AggregatesDataAttribute', 'DataElement', 'DataAttribute', 166, 'Data entity to a member attribute.', {style:'flow'});
edge('HasDataAttributeType', 'DataAttribute', 'DataAttributeType', 166, 'Data attribute to its type.', {style:'flow'});
edge('HasPhysicalCharacteristic', 'DataElement DataAttribute', 'PhysicalCharacteristic', 166, 'Data entity or attribute to its physical characteristic.', {style:'flow'});
edge('ResourceRequirementConstraint', 'ResourceRequirement', 'ResourceConstraint', 168, 'Requirement to related resource constraint.');
edge('ConstrainsResource', 'ResourceConstraint ResourceRequirement', 'ResourcePerformer Function PhysicalPassiveResource DataElement', 168, 'Resource requirement or constraint to the subject it applies to.');
edge('GroupsResourceConstraint', 'ResourceSpecification', 'ResourceRequirement ResourceConstraint', 168, 'Specification to requirement or constraint.');
edge('JustifiesResource', 'ResourceRationale', 'ResourceConstraint', 168, 'Rationale to resource constraint.');
edge('TracesLogicalConstraint', 'ResourceConstraint', 'OperationalConstraint', 168, 'Resource constraint to logical constraint traced.');
edge('OriginatesFromResourceRationale', 'ResourceConstraint', 'ResourceRationale', 168, 'Resource constraint to the rationale it originates from.');
edge('ResourceRationaleOriginatesFromLogical', 'ResourceRationale', 'OperationalConstraint', 168, 'Resource rationale to the logical constraint it originates from.');
edge('DefinesResourceReadiness', 'ResourceMilestone', 'ResourceReadinessLevel', 170, 'Milestone to resource readiness level.');
edge('DeliversResourceReadiness', 'CapabilityConfiguration', 'ResourceReadinessLevel', 170, 'Configuration to delivered resource readiness level.');
edge('TracesLogicalReadiness', 'ResourceReadinessLevel', 'LogicalReadinessLevel', 170, 'Resource readiness to logical readiness traced.');
edge('SchedulesResource', 'ResourceProject', 'ResourceMilestone', 170, 'Project to scheduled resource milestone.');
edge('ResourceReadinessDeliversConfiguration', 'ResourceReadinessLevel', 'CapabilityConfiguration', 170, 'Readiness level to the capability configuration it delivers in Pr.', {style:'flow'});
edge('ResourceMilestoneCorrespondsToLogical', 'ResourceMilestone', 'LogicalMilestone', 170, 'Resource milestone to a corresponding logical milestone.');
edge('DefinesResourceEvolution', 'ResourceProject', 'CapabilityConfiguration', 170, 'Project to the capability configuration whose evolution it defines.');

// Architecture foundation: explicit product/version/correspondence identities.
node('GlossaryTerm', 'Definition', 172, 'An architecture glossary definition.', { attributes: { definition: text(true) } });
node('ContextualData', 'UAFElement', 172, 'Contextual data characterizing an architecture description.');
node('ArchitectureWorkProduct', 'UAFElement', 178, 'A work product of architecting activities.');
node('ArchitectureMethodology', 'UAFElement', 178, 'A method used by an architecture project.');
node('MethodologyExtension', 'ArchitectureMethodology', 178, 'An explicitly documented tailoring/extension of the methodology.', { attributes: { rationale: text(true) } });
node('ArchitectureProject', 'Project', 178, 'A project producing architecture work products.');
node('ArchitectureStatus', 'PropertySet', 180, 'A defined work-product status.');
node('ArchitectureVersion', 'UAFElement', 182, 'A version of an architecture work product.', { attributes: { version: text(true), date: { type: 'string', format: 'date' } } });
node('ArchitectureBaseline', 'ArchitectureVersion', 182, 'A controlled set of architecture versions. A baseline can also carry its own version.', { attributes:{version:text(false)} });
node('ArchitectureMilestone', 'ProjectMilestone', 189, 'A milestone defining architecture status.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('ArchitectureDescriptionElement', 'UAFElement', 176, 'A generic architecture description element for A3 when the concrete type is unspecified. Use a more specific UAF element or ArchitecturalDescription if its type is known.', { sources: [source('176–177')] });
node('ElementCorrespondence', 'UAFElement', 176, 'Objectified correspondence between architecture-description elements.', { attributes: { source: ref('UAFElement',false), target: ref('UAFElement',false) } });
node('CorrespondenceMethod', 'UAFElement', 176, 'A method governing architecture element correspondences.', { attributes: { rule: text(true) } });
node('MeasureGroup', 'UAFElement', 184, 'A grouping of assessment measures.');
node('MeasureLibrary', 'UAFElement', 184, 'A reusable collection of measure groups/measures.');
node('DesiredMetric', 'ActualMeasurement', 184, 'A desired metric governed by a measure.', { attributes: { measure: ref('Measure',false), value: { type: 'number', required: true }, intention: {type:'string', enum:['Actual','Required','Estimate']} } });
node('AchievedMetric', 'ActualMeasurement', 184, 'An achieved metric governed by a measure.', { attributes: { measure: ref('Measure',false), value: { type: 'number', required: true }, intention: {type:'string', enum:['Actual','Required','Estimate']} } });
node('StandardGroup', 'UAFElement', 186, 'A grouping of standards.');
node('StandardProfile', 'UAFElement', 186, 'A profile referencing standards or other standards profiles.');
node('StandardLibrary', 'UAFElement', 186, 'A reusable collection of standards/groups/profiles.');
node('ArchitecturalConstraint', 'Rule', 187, 'An architecture constraint included in a standards profile.');
edge('DefinesGlossaryTerm', 'ArchitecturalDescription', 'GlossaryTerm', 172, 'Architecture description to relevant glossary term.');
edge('CharacterizesArchitectureDescription', 'GlossaryTerm ContextualData Metadata', 'ArchitecturalDescription', 172, 'Glossary term, contextual data or metadata to the description it characterizes. Metadata includes its UAF subtype ArchitectureMetadata.', {sources:[source('172–173')]});
edge('StandardDescribesContext', 'Standard', 'ContextualData', 172, 'Standard to contextual data it describes.');
edge('ContainsView', 'ArchitecturalDescription', 'View', 174, 'Architecture description to constituent view. Same direction as ADMBw ViewsInArchitecturalDescription.');
edge('ConformsToViewpoint', 'View', 'Viewpoint', 174, 'View to governing viewpoint (also retain the native viewpoint reference).');
edge('GovernsView', 'Viewpoint', 'View', 174, 'Viewpoint to its governed view in the NAF cut-out.');
edge('StakeholderHasConcern', 'Stakeholder', 'Concern', 174, 'Stakeholder to concern. Same direction as ADMBw StakeholderConcern.');
edge('FramesConcern', 'Viewpoint', 'Concern', 174, 'Viewpoint to framed concern. Same direction as ADMBw ConcernForViewpoint.');
edge('AddressesConcern', 'View', 'Concern', 174, 'View to directly addressed concern.');
edge('GovernsCorrespondence', 'CorrespondenceMethod', 'ElementCorrespondence', 176, 'Method to correspondence governed.');
edge('DocumentsElement', 'ArchitecturalDescription', 'UAFElement', 176, 'Architecture description to documented element.');
edge('CorrespondenceRelatesElement', 'ElementCorrespondence', 'UAFElement', 176, 'Correspondence to an architecture-description element or description.');
edge('UsesMethodology', 'ArchitectureProject', 'ArchitectureMethodology', 178, 'Architecture project to methodology used.');
edge('ExtendsMethodology', 'ArchitectureMethodology', 'ArchitectureMethodology', 178, 'Methodology to a methodology it extends. A MethodologyExtension can retain its rationale.', {acyclic:true});
edge('MethodologyExtendsStandard', 'ArchitectureMethodology', 'Standard', 179, 'Methodology to the standard it extends, as shown for NAFv4 and TOGAF in the A4 example.');
edge('DocumentsArchitectureProject', 'ArchitecturalDescription', 'ArchitectureProject', 178, 'Architecture description to the project it documents.');
edge('MethodologyAppliesStandard', 'ArchitectureMethodology', 'Standard', 178, 'Methodology to a standard it applies.');
edge('ProductHasStatus', 'ArchitectureWorkProduct', 'ArchitectureStatus', 180, 'Work product to its status.');
edge('ArchitectureStatusDescribesProduct', 'ArchitectureStatus', 'ArchitectureWorkProduct ArchitecturalDescription View', 180, 'Status to the work product, architecture description or view it describes. The A5 example attaches status, completeness and maturity to views.', {sources:[source('180–181')]});
edge('DocumentsWorkProduct', 'ArchitecturalDescription', 'ArchitectureWorkProduct', 180, 'Description to work product documented.');
edge('ArchitectureDescriptionGeneralization', 'ArchitecturalDescription', 'ArchitectureWorkProduct', 180, 'Architectural description to its generalized work product.', {style:'generalization'});
edge('WorkProductContainsView', 'ArchitectureWorkProduct', 'View', 180, 'Work product to a contained view.');
const versionedWorkProducts = 'ArchitectureWorkProduct ArchitecturalDescription';
edge('VersionOfProduct', 'ArchitectureVersion', versionedWorkProducts, 182, 'Version to its work product or architecture description.', {sources:[source('182–183')]});
edge('ArchitectureVersionSuccession', 'ArchitectureVersion', 'ArchitectureVersion', 182, 'Earlier version to succeeding version.', { acyclic: true });
edge('BaselineContains', 'ArchitectureBaseline', `ArchitectureVersion ${versionedWorkProducts}`, 182, 'Baseline to a version, work product or architecture description that it contains.');
edge('ProductHasVersion', versionedWorkProducts, 'ArchitectureVersion', 182, 'Work product or architecture description to its version or baseline.', {sources:[source('182–183')]});
edge('ArchitectureVersionSupersedes', 'ArchitectureVersion', 'ArchitectureVersion', 182, 'Newer version to the earlier version it supersedes.', {acyclic:true});
edge('ArchitectureVersionGeneralization', 'ArchitectureBaseline', 'ArchitectureVersion', 182, 'Baseline to its generalized architecture version.', {style:'generalization'});
edge('GroupsMeasure', 'MeasureGroup', 'Measure MeasureGroup', 184, 'Measure group to a member measure or nested group.', {acyclic:true});
edge('HostsMeasure', 'MeasureLibrary', 'Measure MeasureGroup', 184, 'Library to measure/group hosted.');
edge('GovernsMetric', 'Measure', 'DesiredMetric AchievedMetric', 184, 'Measure to desired or achieved metric it governs.');
edge('StandardSpecifiesMeasure', 'Standard', 'Measure', 184, 'Standard to the measure it specifies.');
edge('MeasureAssessesArchitecture', 'Measure', 'ArchitecturalDescription', 184, 'Measure to the architecture description it assesses.');
edge('GroupsStandard', 'StandardGroup', 'Standard StandardGroup', 186, 'Group to member standard or nested group.', {acyclic:true});
edge('StandardAggregation', 'Standard', 'Standard', 187, 'Standard to a constituent standard.', {acyclic:true});
edge('StandardGeneralization', 'Standard', 'Standard', 187, 'Specialized standard to its general standard.', {style:'generalization',acyclic:true});
edge('IncludesArchitecturalConstraint', 'StandardProfile', 'ArchitecturalConstraint', 187, 'Standards profile to an included architecture constraint.');
edge('ReferencesStandard', 'StandardProfile', 'Standard StandardProfile', 186, 'Standards profile to referenced standard/profile.', { acyclic: true });
edge('HostsStandard', 'StandardLibrary', 'Standard StandardGroup StandardProfile', 186, 'Library to standard/group/profile hosted.');
edge('DefinesArchitectureStatus', 'ArchitectureMilestone', 'ArchitectureStatus', 189, 'Milestone to architecture status defined.');
edge('SchedulesArchitecture', 'ArchitectureProject', 'ArchitectureMilestone', 189, 'Architecture project to scheduled milestone.');
edge('DefinesArchitectureEvolution', 'ArchitectureProject', 'ArchitectureStatus', 190, 'Project to status whose evolution it defines.');
edge('ArchitectureMilestoneCorrespondence', 'ArchitectureMilestone', 'LogicalMilestone ResourceMilestone EnterprisePhase', 190, 'Architecture milestone to another domain milestone or a planning enterprise phase.');

// All 47 current NAFv4.1 cells. Required membership is supplemented with per-element
// incident-link checks; optional information stays optional, including references.
view('C1', 'Capability Taxonomy', 88, 'Capability specialization and whole/part taxonomy.',
  'Capability CapabilityGroup AssessmentCriterion Measure', 'CapabilityGeneralization CapabilityAggregation CapabilityGroupDependency GroupsCapability SpecifiesEffectiveness CharacterizesCapability EvaluatesCriterion', 'Capability');
view('C2', 'Enterprise Vision', 90, 'Vision, goals, enterprise phases and capabilities linked to them.',
  'EnterpriseVision VisionStatement EnterpriseGoal EnterprisePhase ActualEnterprisePhase Capability Effect EnduringTask ActualEnduringTask',
  'RequiresCapability SpecifiesGoal DesiresCapability DesiresVision DesiresGoal DesiredEffect CapabilityForTask SupportsEnduringTask GoalRelatesEnduringTask Exhibits', 'EnterpriseVision EnterpriseGoal EnterprisePhase Capability', 'RequiresCapability SpecifiesGoal',
  [connect('EnterpriseVision','RequiresCapability'), connect('EnterpriseVision','SpecifiesGoal'), connect('EnterprisePhase','DesiresCapability DesiresVision DesiresGoal'), connect('Capability','RequiresCapability DesiresCapability','incoming'), connect('EnterpriseGoal','SpecifiesGoal','incoming')], [],
  ['EnterprisePhase is the required planning-phase representation in this mapping; ActualEnterprisePhase can additionally record actual states.',
    'The C2 cut-out permits desires from an enterprise phase to a capability, vision or goal. Every planning phase requires at least one of these links; a direct DesiresCapability is not mandatory when DesiresVision/DesiresGoal is present.']);
view('C3', 'Capability Dependencies', 92, 'Dependencies between capabilities, with optional specialization and grouping context.', 'Capability CapabilityGroup', 'CapabilityDependency CapabilityGroupDependency CapabilityGeneralization CapabilityAggregation AggregatesCapabilityGroup GroupsCapability', 'Capability', 'CapabilityDependency', [], [],
  ['Not every displayed capability must have a CapabilityDependency: specialization/grouping context is allowed, as SAR demonstrates in the p.93 example. The view requires at least one dependency; completeness of relevant real-world dependencies cannot be checked automatically.']);
view('C4', 'Standard Processes', 94, 'Operational activities supporting capabilities.', 'OperationalActivity Capability', 'MapsToCapability', 'OperationalActivity Capability', 'MapsToCapability', [connect('OperationalActivity','MapsToCapability'), connect('Capability','MapsToCapability','incoming')]);
view('C5', 'Effects', 96, 'Effects desired by capabilities and optional effectiveness criteria.', 'Capability Effect EffectivenessCriterion Measure', 'DesiredEffect SpecifiesEffectiveness CharacterizesEffect EvaluatesCriterion EffectGeneralization', 'Capability Effect', 'DesiredEffect', [connect('Capability','DesiredEffect'), connect('Effect','DesiredEffect','incoming')]);
view('C7', 'Performance Criteria', 98, 'Capabilities characterized by assessment criteria evaluated by measures, with optional effectiveness criteria.', 'Capability AssessmentCriterion Measure Effect', 'CharacterizesCapability EvaluatesCriterion SpecifiesEffectiveness CharacterizesEffect', 'Capability AssessmentCriterion Measure', 'CharacterizesCapability EvaluatesCriterion',
  [connect('Capability','CharacterizesCapability','incoming'), {...connect('AssessmentCriterion','CharacterizesCapability'),nodesExclude:['EffectivenessCriterion']}, {...connect('AssessmentCriterion','EvaluatesCriterion','incoming'),nodesExclude:['EffectivenessCriterion']}, connect('Measure','EvaluatesCriterion')], [],
  ['EffectivenessCriterion and its subtypes are excluded from the per-assessment-criterion mandatory characterization/evaluation checks. Their links are optional, following p.98 and the Time to find example on p.99. Ordinary assessment criteria still require the complete capability-criterion-measure chain.',
    'EvaluatesCriterion is directed from Measure to AssessmentCriterion, following the p.98 cut-out. The evaluates arrows on p.99 are drawn in the opposite direction; that illustration does not change endpoint compatibility.']);
view('C8', 'Planning Constraints', 100, 'Strategic constraints applied to capabilities. Constraint extends StrategicConstraint and supports the p.101 example vocabulary.', 'Capability StrategicConstraint StrategicRationale Effect EnterpriseVision EnterpriseGoal', 'ConstrainsCapability JustifiesStrategy OriginatesFromRationale DesiredEffect RequiresCapability SpecifiesGoal', 'Capability StrategicConstraint', 'ConstrainsCapability', [connect('StrategicConstraint','ConstrainsCapability'), connect('Capability','ConstrainsCapability','incoming')]);
view('Cr', 'Capability Roadmap', 102, 'Increments deliver capabilities and may relate to planning phases with temporal grouping and trigger dependencies. Supports the p.103 presentation with implicit milestone properties.', 'CapabilityMilestone CapabilityIncrement Capability CapabilityProject EnterprisePhase CapabilityConfiguration', 'DefinesIncrement DeliversCapability RelatesToEnterprisePhase AggregatesEnterprisePhase TriggersEnterprisePhase SchedulesCapability DefinesCapabilityEvolution ConfigurationRealizesCapability DesiresCapability Exhibits', 'CapabilityIncrement Capability', 'DeliversCapability', [connect('CapabilityMilestone','DefinesIncrement'), connect('CapabilityIncrement','DeliversCapability'), connect('Capability','DeliversCapability','incoming')], [],
  ['The p.103 example omits explicit milestone nodes because milestones are properties of an increment. Cr therefore does not require visible CapabilityMilestone nodes or incoming DefinesIncrement at every increment. Explicit visible milestones still require a DefinesIncrement link; the optional milestones reference attribute may point to model elements outside the view. Implicit milestone completeness is not checked.',
    'AggregatesEnterprisePhase and TriggersEnterprisePhase are authored binary application adapters, directed whole-to-part and triggering-to-following phase. Each type is acyclic and disallows self-links as an application rule. No single-parent ownership, UML TemporalPart/slot semantics, execution, guards or date ordering between phases is inferred.',
    'CapabilityIncrement is a distinct UAFElement adapter, not an ActualEnterprisePhase/Achiever/ActualState. Earlier implicit compatibility with AchievedEffect and ActualEnterprisePhase relationships no longer applies. Optional startDate/endDate retain ISO date-time validation and ordering.',
    'Connected views reproduce the explanatory p.103 structure. A time-based Gantt representation needs actual schedule dates; the sample does not invent them.']);
view('S1', 'Service Taxonomy', 104, 'Service specialization taxonomy. Service is a vocabulary alias of UAF 1.0 ServiceSpecification in this application profile; policies and nested groups are optional context.', 'ServiceSpecification ServiceGroup ServicePolicy', 'ServiceGeneralization GroupsService AggregatesServiceGroup SatisfiesServicePolicy ServicePolicySatisfiedBy', 'ServiceSpecification', '', [], [],
  ['Service aliases ServiceSpecification in both directions, preserving written labels and inherited service rules. This is not an implementation of the UAF 1.2 service metamodel. ServiceGeneralization points from the specialized service to its general service. Multiple inheritance is permitted by the profile; a whole-view tree still requires one hierarchy parent per node.',
    'SatisfiesServicePolicy points from service to policy, following pp.104–105. ServicePolicySatisfiedBy is the retained inverse application link, not a direction change to existing models. Native ServicePolicy still requires its ruleKind attribute; the p.105 drawing does not specify that value.',
    'GroupsService connects a ServiceGroup to a member service; AggregatesServiceGroup connects a group to a member group. The latter disallows self-links/cycles as an application rule, without imposing single-parent ownership or strong composition.',
    'Use a Connected view with a ServiceGeneralization-only tree group when policy/group context is present. A whole-view tree may filter to ServiceGeneralization, omitting non-hierarchy edges.']);
view('S2', 'Service Structure', 106, 'Service aggregation, composition and dependencies; optional interfaces, functions, logical nodes and physical realizations.', 'ServiceSpecification ServiceGroup ServiceInterface ServiceFunction OperationalAgent OperationalActivity ResourcePerformer ServiceProvider ServiceConsumer', 'ServiceAggregation ServiceComposition ServiceDependency GroupsService SpecifiesServiceInterface IsCapableToPerform Consumes Exhibits Implements ConsumesService EnablesService RealizesService ProvidesService DeliversService ServiceRoleReliesOnNode', 'ServiceSpecification', 'ServiceDependency', [connect('ServiceSpecification','ServiceAggregation ServiceComposition ServiceDependency','either')], [],
  ['Node is an alias of the application LogicalNode, a subtype of OperationalArchitecture. This models the logical grouping/architecture meaning of a NAF Node, not a physical System, runtime instance or drawing template.',
    'The pp.107–108 directions are node to service (ConsumesService), function to service (EnablesService), and physical active resource to service (RealizesService). Native Consumes, IsCapableToPerform and Implements are unchanged; they are not interchangeable aliases of these adapters.',
    'ServiceAggregation projects whole service to member service (aggregates in the source), with a solid directed link and no exclusive ownership. ServiceComposition remains a separate relationship with composition notation. Both reject cycles/self-links; full UML ownership/lifecycle semantics are not implemented. ServiceDependency remains dependent service to required service.',
    'Per-service structural checks count ServiceAggregation/ServiceComposition/ServiceDependency, not optional node/function/resource traces. Optional provider and consumer roles may provide or consume the same service and rely on a logical Node. The Node can independently deliver or consume a service.']);
viewpoints.S2.sources.push(source('107–108'));
view('S3', 'Service Interfaces', 109, 'Services specify interfaces and optional operations with shared conceptual parameters and optional physical data-product traces.', 'ServiceSpecification ServiceInterface ServiceMethod ServiceOperationParameter PhysicalPassiveResource DataElement DataModel', 'SpecifiesServiceInterface SpecifiesServiceOperation HasServiceOperationParameter InvolvesPhysicalResource SpecifiesData', 'ServiceSpecification ServiceInterface', 'SpecifiesServiceInterface', [connect('ServiceSpecification','SpecifiesServiceInterface'), connect('ServiceInterface','SpecifiesServiceInterface','incoming'),
  connect('ServiceMethod','SpecifiesServiceOperation','incoming','ServiceInterface'),
  { ...connect('ServiceOperationParameter','HasServiceOperationParameter','incoming','ServiceMethod'), referenceAttributes: ['owner'] },{...connect('ServiceOperationParameter','InvolvesPhysicalResource','outgoing','PhysicalPassiveResource DataElement',0),referenceAttributes:['resource'],visibility:'may'}], [visible('ServiceOperationParameter','owner')],
  ['ServiceOperation is an application-profile vocabulary alias of UAF ServiceMethod (a UML Operation stereotype). DataProductType is a separate DataElement/PhysicalPassiveResource specialization. Native UAF and ADMBw definitions are unchanged.',
    'HasServiceOperationParameter runs from operation to parameter; InvolvesPhysicalResource runs from parameter to a physical passive resource/data product. The p.110 Geographic Location parameter is shared by two operations. These are conceptual associations, not exclusive UML Parameter ownership.',
    'Legacy owner/resource references remain valid. Owners must be visible; resource traces may be omitted in S3. An owner reference can satisfy the required operation association instead of a has link; identical link/reference evidence is counted once. S3 does not require a resource for every parameter, matching the Resource parameter in p.110.',
    'An optional DataModel trace uses SpecifiesData from model to DataElement/DataProductType. A parameter does not link directly to a DataModel. Full UML operation signatures, parameter ordering/directions and consistency between simultaneous link/reference declarations require review.']);
viewpoints.S3.sources.push(source(110));
view('S4', 'Service Functions', 111, 'Functions enabling services, recursive function aggregation, provider/consumer roles and operational activity context.',
  'ServiceSpecification ServiceFunction ServiceProvider ServiceConsumer OperationalAgent OperationalActivity',
  'IsCapableToPerform Consumes EnablesService ServiceFunctionAggregation ProvidesService ConsumesService NotifiesServiceProvider AccessesServiceFunction SupportsServiceFunction EnablesOperationalActivity PerformsOperationalActivity',
  'ServiceSpecification ServiceFunction', '', [connect('ServiceSpecification','EnablesService IsCapableToPerform','either','ServiceFunction'),
    {...connect('ServiceFunction','EnablesService IsCapableToPerform','either','ServiceSpecification'), through:{relations:['ServiceFunctionAggregation'],direction:'incoming'}}], [],
  ['Each selected function must enable a selected service directly or through selected aggregating ancestors. Legacy service-to-function IsCapableToPerform remains accepted. This is contextual coverage, not inheritance of behavior or implicit model edges.',
   'Provider and consumer are explicit contextual application roles, with optional represents references. Cut-out links are directed structural projections; no execution, notification delivery, exclusive ownership or full UML activity decomposition is asserted.']);
view('S5', 'Service States', 113, 'States, objectified or compact transitions, events, functions, modes and state groupings.',
  'ServiceSpecification ServiceState ServiceStateTransition ServiceStateGroup ServiceEvent ServiceMode ServiceFunction',
  'ServiceStateTransition HasServiceState TriggersServiceStateTransition StateEnablesServiceFunction HasServiceMode GroupsServiceState AggregatesServiceStateGroup EnablesService EnablesServiceMode IsCapableToPerform',
  'ServiceSpecification ServiceState', 'ServiceStateTransition', [connect('ServiceState','ServiceStateTransition','either'),
    {...connect('ServiceState','HasServiceState','incoming','ServiceSpecification',1,1),referenceAttributes:['owner']},
    {...connect('ServiceMode','HasServiceMode','incoming','ServiceFunction',1,1),referenceAttributes:['function']},
  ],
  [visible('ServiceState','owner'),visible('ServiceMode','function'),{relations:['ServiceStateTransition'],attributes:['transition']}],
  ['The transition node and edge share a type name in separate namespaces. Bind the object node via the edge transition attribute; is equal to is the graphical reference connector, not a separate edge with an edge ID as endpoint. Each selected transition object binds exactly one selected state edge.',
   'Legacy owner/function/event references remain accepted. State/mode ownership is checked in S5 through an explicit link or selected reference; duplicate contradictory ownership is rejected. Cross-state same-service consistency, conflicting event representations, guards, reachability, execution and omitted model elements require review.']);
viewpoints.S5.objectifications=[{nodes:['ServiceStateTransition'],relations:['ServiceStateTransition'],attribute:'transition',stateEventRelations:['TriggersServiceStateTransition']}];
view('S6', 'Service Sequence', 116, 'Ordered compact or objectified interactions between lifelines, with optional service/function/interface/operation/event context.',
  'ServiceSpecification ServiceLifeline ServiceInteraction ServiceEvent ServiceFunction ServiceInterface ServiceMethod',
  'ServiceInteraction RepresentsService TriggersServiceInteraction InteractionRelatesOperation EnablesService IsCapableToPerform SpecifiesServiceInterface SpecifiesServiceOperation',
  'ServiceSpecification ServiceLifeline', 'ServiceInteraction', [connect('ServiceLifeline','ServiceInteraction','either'),
    {...connect('ServiceLifeline','RepresentsService','outgoing','ServiceSpecification',1,1),referenceAttributes:['represents']},
    {...connect('ServiceInteraction','ServiceInteraction','either',undefined,1,1),referencedByAttributes:['interaction']}],
  [visible('ServiceLifeline','represents'),{relations:['ServiceInteraction'],attributes:['interaction']}],
  ['Interaction objects bind exactly one selected lifeline message; message endpoints belong to the edge. Lifelines represent services and are not objectified interactions. Compact event/operation/represents references remain supported; explicit context links are optional.',
   'Sequence views support object cards and is equal to attachments. showContext true draws other selected cards and relationships in a context area. orderAttribute order sorts and checks unique positive message positions; otherwise declaration order or an explicit messages list determines display order. No execution, temporal constraints, UML fragments or event/operation-reference consistency is asserted.']);
view('S7', 'Service Interface Parameters', 119, 'Operation/function parameters reference their owner and passive resource.', 'ServiceParameter ServiceFunction ServiceMethod PhysicalPassiveResource DataElement OperationalExchangeItem ServiceSpecification ServiceInterface', 'SpecifiesServiceInterface SpecifiesServiceOperation IsCapableToPerform EnablesService HasServiceOperationParameter InvolvesPhysicalResource HasServiceFunctionParameter InvolvesLogicalResource', 'ServiceParameter', '', [
  { ...connect('ServiceOperationParameter','HasServiceOperationParameter','incoming','ServiceMethod'), referenceAttributes: ['owner'] },
  { ...connect('ServiceOperationParameter','InvolvesPhysicalResource','outgoing','PhysicalPassiveResource DataElement',0), referenceAttributes: ['resource'],visibility:'shall' },
  {...connect('ServiceFunctionParameter','HasServiceFunctionParameter','incoming','ServiceFunction'),referenceAttributes:['owner']},
  {...connect('ServiceFunctionParameter','InvolvesLogicalResource','outgoing','OperationalExchangeItem PhysicalPassiveResource DataElement',0),referenceAttributes:['resource'],visibility:'shall'}], [visible('ServiceOperationParameter','owner'), visible('ServiceFunctionParameter','owner')], ['Use ServiceOperationParameter or ServiceFunctionParameter: the unqualified UAF ServiceParameter lacks the required owner/payload projection. Both parameter kinds may use explicit has/involves links or owner/resource references. S7 requires owner association and visibility of known resource mappings; missing model mappings are non-blocking review notices; function parameters involve logical OperationalExchangeItems, while operation parameters involve physical resources. Legacy physical function-parameter references remain accepted. S3 makes the operation resource trace optional.']);
// The abstract parameter category excludes an unqualified ServiceParameter as a substitute.
node('ServiceInterfaceParameter', 'UAFElement', 119, 'Abstract parameter category for S7.', { abstract: true });
nodeTypes.ServiceOperationParameter.extends.push('ServiceInterfaceParameter');
nodeTypes.ServiceFunctionParameter.extends.push('ServiceInterfaceParameter');
viewpoints.S7.requiredNodes = ['ServiceInterfaceParameter'];
view('S8', 'Service Constraints', 121, 'Service policies group individual constraints. Services may satisfy those policies, following the pp.121–122 cut-out and example.', 'ServicePolicy ServiceConstraint ServiceSpecification Measure', 'GroupsServiceConstraint SatisfiesServicePolicy ServicePolicySatisfiedBy EvaluatesServiceConstraint', 'ServicePolicy ServiceConstraint', 'GroupsServiceConstraint', [connect('ServicePolicy','GroupsServiceConstraint'), connect('ServiceConstraint','GroupsServiceConstraint','incoming')]);
view('Sr', 'Service Roadmap', 123, 'Milestones define readiness levels fulfilled by services.', 'ServiceMilestone ServiceReadinessLevel ServiceSpecification ServiceProject', 'DefinesServiceReadiness FulfilsServiceReadiness SchedulesService DefinesServiceEvolution', 'ServiceMilestone ServiceReadinessLevel ServiceSpecification', 'DefinesServiceReadiness FulfilsServiceReadiness', [connect('ServiceMilestone','DefinesServiceReadiness'), connect('ServiceReadinessLevel','DefinesServiceReadiness','incoming'), connect('ServiceReadinessLevel','FulfilsServiceReadiness','incoming'), connect('ServiceSpecification','FulfilsServiceReadiness')]);
view('C1-S1', 'Service to Capability', 125, 'Service specifications contribute capabilities.', 'ServiceSpecification Capability', 'Exhibits', 'ServiceSpecification Capability', 'Exhibits', [connect('ServiceSpecification','Exhibits'), connect('Capability','Exhibits','incoming')]);
view('L1', 'Logical Taxonomy', 126, 'Logical nodes organize relevant active resources, behavior and optional passive resources, following the pp.126–127 taxonomy.', 'OperationalAgent OperationalActivity LogicalFunction OperationalExchangeItem Capability', 'OperationalGeneralization LogicalBehaviorGeneralization GroupsLogicalResource Exhibits NeedsCapability', 'OperationalArchitecture', '', [
  {...connect('OperationalAgent','GroupsLogicalResource','incoming','OperationalArchitecture'),nodesExclude:['OperationalArchitecture'],through:{relations:['OperationalGeneralization'],direction:'outgoing'}},
  {...connect('OperationalActivity LogicalFunction','GroupsLogicalResource','incoming','OperationalArchitecture'),through:{relations:['LogicalBehaviorGeneralization'],direction:'outgoing'}},
  connect('OperationalExchangeItem','GroupsLogicalResource','incoming','OperationalArchitecture')], [], [
  'LogicalActor and LogicalEquipment are distinct concrete application subtypes of OperationalPerformer, not aliases or native UAF 1.0 stereotypes.',
  'Grouping and specialization nodes do not each require a direct performer or activity. The p.127 example contains no activity; single-node taxonomies are accepted. Which resources/behavior are relevant and whether all relevant elements are present require review.',
  'Selected active resources require node grouping directly or through selected OperationalGeneralization ancestors. Selected behavior can inherit grouping via LogicalBehaviorGeneralization. Selected passive resources require an incoming GroupsLogicalResource from a node. Capability traces and passive resources are optional; existing UAF types remain supported.']);
viewpoints.L1.sources.push(source(127));
view('L2', 'Logical Structure', 128, 'Logical nodes connected by compact or objectified Needlines, with optional conveyed resources.', 'OperationalArchitecture Needline OperationalExchangeItem OperationalPerformer', 'Needline ConveysLogicalResource LogicalDependency GroupsLogicalResource', 'OperationalArchitecture', '', [
  {...connect('Needline','ConveysLogicalResource','outgoing','OperationalExchangeItem',0),referenceAttributes:['conveyed'],visibility:'may'}], [visible('Needline','source target')], [
  'Needline is both a node and relationship name in separate namespaces. Compact edges need no object card; the edge needline attribute binds the optional object and draws is equal to. An object can be omitted from a view without removing its Needline edge.',
  'Each selected Needline object requires one selected bound edge or a complete legacy source/target pair with selected endpoints. Binding is unique across the model; simultaneous endpoint references must match the edge. Legacy references do not synthesize extra model edges or their visualization.',
  'At least one Needline edge or complete legacy object is required; LogicalDependency alone is not a substitute. Conveyed resources and their ConveysLogicalResource links are optional presentation context, including when known mappings exist. Structural hierarchy uses GroupsLogicalResource. Payload completeness, transport details and full UML association-class semantics require review.']);
viewpoints.L2.sources.push(source(129));
viewpoints.L2.objectifications=[{nodes:['Needline'],relations:['Needline'],attribute:'needline',endpoints:{source:'source',target:'target'},allowLegacy:true,required:true}];
view('L2-L3', 'Logical Concept', 130, 'Informal high-level concept: no mandatory information-model content.', '*', '*', '', '', [], [], ['Rich pictures/external illustrations and their interpretation require human review. This permissive concept view is intentionally not a substitute for formal viewpoints.']);
view('L3', 'Logical Interactions', 131, 'Logical interactions carry passive logical resources. Needlines and their logical nodes are optional context.', 'OperationalAgent OperationalExchangeItem Needline LogicalInteraction', 'LogicalInteraction OperationalExchange GroupsLogicalResource Needline ConveysLogicalResource RealizesNeedline', 'OperationalAgent OperationalExchangeItem', 'LogicalInteraction', [
  {...connect('OperationalAgent','LogicalInteraction','either'),nodesExclude:['OperationalArchitecture']}], [], [
  'The p.131 cut-out permits optional Needline edges, their object cards, logical Node endpoints, and requested resources. Nodes shown for structure or needline context do not each require a LogicalInteraction.',
  'Supply at least one selected payload via the conveyed attribute or a ConveysLogicalResource link from the bound interaction object. Needline resource context is optional. The needline reference points to the Needline object.',
  'An interaction object can bind to its carrying edge and trace to a Needline or convey a logical resource. Compact edges can record selected payloads directly. The optional volume attribute can drive a weighted Sankey diagram.']);
viewpoints.L3.objectifications=[{nodes:['LogicalInteraction'],relations:['LogicalInteraction'],attribute:'interaction',payload:{attribute:'conveyed',relations:['ConveysLogicalResource']}}];
// Each activity needs a performer. This also enforces the presence of a Node,
// Role or legacy OperationalAgent without requiring any particular performer type.
// Requiring one of the two flow types per activity keeps both names interchangeable in L4.
view('L4', 'Logical Activities', 133, 'Control flows, activity allocations and optional resource flows, events and traces.', 'OperationalAgent OperationalRole OperationalActivity OperationalExchangeItem OperationalFlow LogicalEvent Capability ServiceSpecification ResourcePerformer',
  'OperationalControlFlow LogicalControlFlow OperationalFlow LogicalObjectFlow OperationalActivityAggregation ActsUponLogicalResource ConveysLogicalResource TriggersOperationalActivity TriggersLogicalEvent RelatesServiceToOperationalActivity EnablesOperationalActivity IsCapableToPerform PerformsOperationalActivity HoldsRole MapsToCapability Consumes Implements', 'OperationalActivity', '', [
  connect('OperationalActivity','IsCapableToPerform PerformsOperationalActivity','incoming','OperationalAgent OperationalRole'),
  connect('OperationalActivity','OperationalControlFlow LogicalControlFlow','either')], [], [
  'Role is an application vocabulary alias of UAF 1.0 OperationalRole. HoldsRole represents its logical Node context when both appear in the view. Roles can be shown without their holding Nodes in an activity-focused view.',
  'Each selected activity requires a visible incoming allocation from a Node, Role or legacy OperationalAgent. Native IsCapableToPerform remains available for OperationalAgent allocations.',
  'OperationalFlow is optional and separate from the required control flow. Its optional object card binds to one selected edge via flow. Payload resources and conveys links may be omitted from the view. LogicalObjectFlow still uses a typed conveyed list.']);
viewpoints.L4.sources.push(source('134–135'));
viewpoints.L4.objectifications=[{nodes:['OperationalFlow'],relations:['OperationalFlow'],attribute:'flow'}];
view('L5', 'Logical States', 136, 'States of logical active resources, compact or objectified transitions, events, activities, functions, modes and state groups.',
  'OperationalAgent LogicalState LogicalTransition LogicalEvent LogicalMode OperationalActivity LogicalFunction LogicalStateGroup',
  'LogicalStateTransition HasLogicalState TriggersLogicalTransition StateEnablesOperationalActivity StateEnablesLogicalFunction HasLogicalMode GroupsLogicalState AggregatesLogicalStateGroup EnablesLogicalMode IsCapableToPerform',
  'OperationalAgent LogicalState', 'LogicalStateTransition', [connect('LogicalState','LogicalStateTransition','either'),
    {...connect('LogicalState','HasLogicalState','incoming','OperationalAgent',1,1), referenceAttributes:['owner']},
    {...connect('LogicalMode','HasLogicalMode','incoming','OperationalActivity LogicalFunction',1,1), referenceAttributes:['activity']}],
  [visible('LogicalState','owner'), visible('LogicalMode','activity'), {relations:['LogicalStateTransition'], attributes:['transition']}],
  ['Connected diagrams draw compact event triggers on state-to-state edges and attach objectified transitions through the transition reference. Event visibility is optional.',
   'State-machine execution, cross-owner transitions, consistency between compact and objectified triggers, and guard completeness require review.']);
viewpoints.L5.sources.push(source('137–138'));
viewpoints.L5.objectifications=[{nodes:['LogicalTransition'],relations:['LogicalStateTransition'],attribute:'transition',stateEventRelations:['TriggersLogicalTransition']}];
view('L6', 'Logical Sequence', 139, 'Ordered interactions between lifelines representing logical active resources.',
  'OperationalAgent LogicalLifeline LogicalEvent OperationalActivity LogicalInteraction LogicalFunction',
  'LogicalSequenceInteraction RepresentsLogicalResource IsCapableToPerform TriggersLogicalInteraction LogicalInteractionRelatesBehavior',
  'OperationalAgent LogicalLifeline', 'LogicalSequenceInteraction', [
    connect('LogicalLifeline','LogicalSequenceInteraction','either'),
    {...connect('LogicalLifeline','RepresentsLogicalResource','outgoing','OperationalAgent',1,1),referenceAttributes:['represents']}],
  [visible('LogicalLifeline','represents')],
  ['Each selected lifeline represents exactly one selected logical active resource through an explicit relationship or a compact reference.',
   'LogicalSequenceInteraction supports compact event and activity references. Bind a LogicalInteraction object to the message to show explicit event and behavior links.',
   'Interaction fragments and concurrency require review. Use orderAttribute order to sort and validate message order in a sequence diagram.']);
viewpoints.L6.sources.push(source(140));
viewpoints.L6.objectifications=[{nodes:['LogicalInteraction'],relations:['LogicalSequenceInteraction'],attribute:'interaction'}];
view('L7', 'Information Model', 141, 'Information entities with optional model, product and typed attributes.',
  'InformationElement InformationModel InformationAttribute InformationAttributeType InformationProduct',
  'SpecifiesInformation RepresentsInformationProduct AggregatesInformationAttribute HasInformationAttributeType',
  'InformationElement', '', [
    {...connect('InformationAttribute','AggregatesInformationAttribute','incoming','InformationElement',1,1),referenceAttributes:['owner']},
    {...connect('InformationAttribute','HasInformationAttributeType','outgoing','InformationAttributeType',0,1),referenceAttributes:['attributeType']}],
  [visible('InformationAttribute','owner')],
  ['InformationEntity specializes InformationElement. Both satisfy the entity requirement and can be specified by an InformationModel.',
   'RepresentsInformationProduct follows the scope and cut-out on p.141. The reversed arrow in the p.142 example is treated as a likely editorial error.',
   'An included attribute belongs to one visible entity. Attribute types can be omitted from the view. Compact owner and attributeType references remain valid.']);
viewpoints.L7.sources.push(source(142));
view('L8', 'Logical Constraints', 143, 'Logical constraints and requirements apply to logical resources or behavior.',
  `LogicalRequirement OperationalConstraint ${logicalConstraintSubjects} LogicalSpecification LogicalRationale StrategicConstraint`,
  'LogicalRequirementConstraint ConstrainsLogical GroupsLogicalConstraint OriginatesFromLogicalRationale OriginatesFromStrategicConstraint JustifiesLogical TracesStrategicConstraint',
  'LogicalRequirement OperationalConstraint', 'ConstrainsLogical', [
    connect('LogicalRequirement','LogicalRequirementConstraint ConstrainsLogical'),
    connect('OperationalConstraint','ConstrainsLogical')],
  [],
  ['A requirement can relate to a constraint as in the cut-out, or apply directly to a logical subject as in the p.144 example. The example omits explicit requirement-to-constraint links; sharing a subject does not establish such a link.',
   'LogicalConstraint specializes OperationalConstraint. Its declared type implies ruleKind Constraint. The native OperationalConstraint retains its required ruleKind.']);
viewpoints.L8.sources.push(source(144));
const logicalReadinessLinks = 'LogicalReadinessFulfilsResource FulfilsLogicalReadiness';
view('Lr', 'Logical Roadmap', 145, 'Milestones define readiness levels that fulfil logical active resources.',
  'LogicalMilestone LogicalReadinessLevel OperationalAgent LogicalProject CapabilityIncrement',
  `DefinesLogicalReadiness ${logicalReadinessLinks} SchedulesLogical DefinesLogicalEvolution TracesCapabilityIncrement`,
  'LogicalMilestone LogicalReadinessLevel OperationalAgent', 'DefinesLogicalReadiness', [
    connect('LogicalMilestone','DefinesLogicalReadiness'),
    connect('LogicalReadinessLevel','DefinesLogicalReadiness','incoming'),
    connect('LogicalReadinessLevel',logicalReadinessLinks,'either','OperationalAgent'),
    connect('OperationalAgent',logicalReadinessLinks,'either','LogicalReadinessLevel')],
  [],
  ['The cut-out and example use LogicalReadinessFulfilsResource from readiness level to resource. Existing models can use the inverse FulfilsLogicalReadiness direction. Either link satisfies the readiness association.',
   'DefinesLogicalEvolution and SchedulesLogical describe optional project context. The example on p.146 leaves dates open; LogicalMilestone requires an ISO date in this profile.']);
viewpoints.Lr.sources.push(source(146));
view('P1', 'Resource Taxonomy', 147, 'Physical active resource and resource function taxonomies, with optional aggregation, allocation, dependency and realization traces.',
  'ResourcePerformer Function PhysicalPassiveResource DataElement Capability OperationalAgent ServiceFunction LogicalFunction OperationalActivity',
  'ResourceGeneralization FunctionGeneralization ResourceAggregation ResourceFunctionAggregation GroupsPhysicalResource IsCapableToPerform UsesResourceFunction PhysicalDependency Exhibits Implements RealizesLogicalFunction',
  'ResourcePerformer Function', '', [], [], [
    'The p.149 notes make relationships between mandatory elements optional. Relevant scope and taxonomy completeness require review.',
    'Use a named tree filtered to ResourceGeneralization for the taxonomy and connected placement for contextual groups and traces. Aggregation allows shared membership and rejects cycles within the relationship type.'
  ]);
viewpoints.P1.sources.push(source('148–149'));
const physicalSubjects = 'ResourcePerformer Function PhysicalPassiveResource DataElement';
const physicalInteractions = 'ResourceInteraction RealizesLogicalInteraction ConveysPhysicalResource';
view('P2', 'Resource Structure', 150, 'Capability configurations, resource aggregation, dependencies and optional interactions.',
  'ResourcePerformer PhysicalPassiveResource DataElement ResourceInteraction LogicalInteraction OperationalExchangeItem',
  `GroupsPhysicalResource ResourceAggregation PassiveResourceAggregation PhysicalDependency ${physicalInteractions} RealizesLogicalResource`,
  'CapabilityConfiguration ResourcePerformer PhysicalPassiveResource', 'GroupsPhysicalResource PhysicalDependency', [
    connect('CapabilityConfiguration','GroupsPhysicalResource','outgoing','ResourcePerformer'),
    connect('PhysicalPassiveResource DataElement','GroupsPhysicalResource PassiveResourceAggregation PhysicalDependency','incoming')], [],
  ['The passive resource in the p.152 example is reached by dependency. It does not need an additional direct configuration membership link. The view must include active resources and a dependency.']);
const physicalInteractionBinding={nodes:['ResourceInteraction'],relations:['ResourceInteraction'],attribute:'interaction',endpoints:{source:'source',target:'target'},allowLegacy:true};
viewpoints.P2.objectifications=[physicalInteractionBinding];
view('P3', 'Resource Interactions', 153, 'Physical interactions conform to standards and protocols. Active resources implement protocols.',
  'ResourcePerformer ResourceInteraction Standard PhysicalPassiveResource DataElement LogicalInteraction',
  `${physicalInteractions} InteractionConformsTo ResourceImplementsProtocol`,
  'ResourcePerformer ResourceInteraction Standard Protocol', 'InteractionConformsTo ResourceImplementsProtocol', [
    connect('ResourceInteraction','InteractionConformsTo','outgoing','Protocol'), connect('ResourceInteraction','InteractionConformsTo','outgoing','Standard'), connect('ResourcePerformer','ResourceImplementsProtocol')], [visible('ResourceInteraction','conveyed')],
  ['Protocol extends Standard, so a governing protocol also satisfies Standard membership. Matching the interaction protocol to the implementations requires review.']);
viewpoints.P3.objectifications=[{...physicalInteractionBinding,required:true}];
view('P4', 'Resource Functions', 156, 'Resources perform or use functions that exchange passive resources.',
  `${physicalSubjects} ResourceFlow LogicalFunction OperationalActivity ServiceFunction`,
  'IsCapableToPerform UsesResourceFunction UsesPhysicalResource DeliversPhysicalResource FunctionalFlow ResourceFlow ResourceFunctionAggregation ConveysPhysicalResource Implements RealizesLogicalFunction',
  'ResourcePerformer Function PhysicalPassiveResource', 'FunctionalFlow ResourceFlow', [
    connect('ResourcePerformer','IsCapableToPerform UsesResourceFunction','outgoing','Function')], [],
  ['The p.158 view decomposes functions and shows the passive resource on an objectified ResourceFlow. It does not require both flow types or a direct allocation at every function.']);
viewpoints.P4.objectifications=[{nodes:['ResourceFlow'],relations:['ResourceFlow'],attribute:'flow'}];
view('L4-P4', 'Activity to Function', 159, 'Resource functions implement operational activities, optionally with service and resource assignments.', 'Function OperationalActivity ServiceFunction ResourcePerformer PhysicalPassiveResource DataElement OperationalExchangeItem', 'Implements IsCapableToPerform UsesResourceFunction OperationalControlFlow LogicalControlFlow LogicalObjectFlow FunctionalFlow ResourceFlow', 'Function OperationalActivity', 'Implements', [connect('Function','Implements','outgoing','OperationalActivity'), connect('OperationalActivity','Implements','incoming','Function')]);
view('P5', 'Resource States', 161, 'Physical resource states, transitions, events, modes and state groups.',
  'ResourcePerformer ResourceState ResourceTransition ResourceStateGroup ResourceEvent ResourceMode Function LogicalState',
  'ResourceStateTransition HasResourceState TriggersResourceTransition GroupsResourceState StateEnablesResourceFunction ResourceStateRelatesLogicalState HasResourceMode EnablesResourceMode IsCapableToPerform',
  'ResourcePerformer ResourceState', 'ResourceStateTransition', [connect('ResourceState','ResourceStateTransition','either'),
    {...connect('ResourceState','HasResourceState','incoming','ResourcePerformer',1,1),referenceAttributes:['owner']},
    {...connect('ResourceMode','HasResourceMode','incoming','Function',1,1),referenceAttributes:['function']}],
  [visible('ResourceState','owner'), visible('ResourceMode','function')], ['Execution, cross-owner transitions and guard completeness require review.']);
viewpoints.P5.objectifications=[{nodes:['ResourceTransition'],relations:['ResourceStateTransition'],attribute:'transition',stateEventRelations:['TriggersResourceTransition']}];
view('P6', 'Resource Sequence', 163, 'Ordered interactions between lifelines representing physical resources.',
  'ResourcePerformer ResourceLifeline ResourceEvent ResourceInteraction Function', 'ResourceSequenceInteraction RepresentsResource TriggersResourceInteraction ResourceInteractionRelatesFunction IsCapableToPerform',
  'ResourcePerformer ResourceLifeline', 'ResourceSequenceInteraction', [connect('ResourceLifeline','ResourceSequenceInteraction','either'),
    {...connect('ResourceLifeline','RepresentsResource','outgoing','ResourcePerformer',1,1),referenceAttributes:['represents']}],
  [visible('ResourceLifeline','represents')], ['Interaction fragments and concurrency require review.']);
viewpoints.P6.objectifications=[{nodes:['ResourceInteraction'],relations:['ResourceSequenceInteraction'],attribute:'interaction',endpoints:{source:'source',target:'target'}}];
view('P7', 'Data Model', 165, 'Data entities, typed attributes, physical characteristics and information-model traces.',
  'DataElement DataModel DataAttribute DataAttributeType InformationModel ActualDataProduct PhysicalCharacteristic',
  'SpecifiesData TracesInformationModel RepresentsDataProduct AggregatesDataEntity AggregatesDataAttribute HasDataAttributeType HasPhysicalCharacteristic', 'DataElement', '', [
    {...connect('DataAttribute','AggregatesDataAttribute','incoming','DataElement',1,1),referenceAttributes:['owner']},
    {...connect('DataAttribute','HasDataAttributeType','outgoing','DataAttributeType',0,1),referenceAttributes:['attributeType']}], [visible('DataAttribute','owner')]);
view('P8', 'Resource Constraints', 168, 'Requirements and constraints apply to physical resources and behavior.',
  `ResourceRequirement ResourceConstraint ${physicalSubjects} ResourceSpecification ResourceRationale OperationalConstraint`,
  'ResourceRequirementConstraint ConstrainsResource GroupsResourceConstraint JustifiesResource TracesLogicalConstraint OriginatesFromResourceRationale ResourceRationaleOriginatesFromLogical',
  'ResourceRequirement ResourceConstraint', 'ResourceRequirementConstraint ConstrainsResource', [connect('ResourceRequirement','ResourceRequirementConstraint ConstrainsResource'), connect('ResourceConstraint','ConstrainsResource')]);
const readinessDelivery='DeliversResourceReadiness ResourceReadinessDeliversConfiguration';
view('Pr', 'Resource Roadmap', 170, 'Milestones define readiness levels that deliver capability configurations.',
  'ResourceMilestone ResourceReadinessLevel CapabilityConfiguration ResourceProject LogicalReadinessLevel LogicalMilestone',
  `DefinesResourceReadiness ${readinessDelivery} SchedulesResource TracesLogicalReadiness ResourceMilestoneCorrespondsToLogical DefinesResourceEvolution`,
  'ResourceMilestone ResourceReadinessLevel CapabilityConfiguration', 'DefinesResourceReadiness', [connect('ResourceMilestone','DefinesResourceReadiness'), connect('ResourceReadinessLevel','DefinesResourceReadiness','incoming'), connect('ResourceReadinessLevel',readinessDelivery,'either','CapabilityConfiguration'), connect('CapabilityConfiguration',readinessDelivery,'either','ResourceReadinessLevel')], [],
  ['ResourceReadinessDeliversConfiguration follows p.170. DeliversResourceReadiness remains available in the inverse direction.']);
for (const [id,pages] of Object.entries({P2:'151–152',P3:'154–155',P4:'157–158','L4-P4':'159–160',P5:'161–162',P6:'163–164',P7:'166–167',P8:'168–169',Pr:'170–171'})) viewpoints[id].sources.push(source(pages));
view('A1', 'Metadata Definitions', 172, 'Glossary terms, metadata and contextual data characterizing an architecture description.',
  'GlossaryTerm ArchitecturalDescription Viewpoint Metadata ContextualData Standard', 'DefinesGlossaryTerm CharacterizesArchitectureDescription StandardDescribesContext', 'GlossaryTerm', '', [], [], ['Glossary relevance and metadata completeness require review.']);
view('A2', 'Architecture Products', 174, 'Views, viewpoints, stakeholders and concerns linked to an architecture description.',
  'ArchitecturalDescription View Viewpoint Stakeholder Concern', 'ContainsView ConformsToViewpoint GovernsView StakeholderHasConcern FramesConcern AddressesConcern',
  'ArchitecturalDescription View Viewpoint Stakeholder Concern', 'ContainsView StakeholderHasConcern FramesConcern', [connect('ArchitecturalDescription','ContainsView'), connect('View','ContainsView','incoming'),
    {...connect('View','ConformsToViewpoint GovernsView','either','Viewpoint',1,1),referenceAttributes:['viewpoint']},
    connect('Stakeholder','StakeholderHasConcern'), connect('Concern','StakeholderHasConcern','incoming'), connect('Concern','FramesConcern','incoming'), connect('Viewpoint','FramesConcern')], [visible('View','viewpoint'), visible('ArchitecturalDescription','viewPoint')]);
view('A3', 'Architecture Correspondence', 176, 'Objectified correspondences relate elements and are governed by methods.',
  'UAFElement', 'GovernsCorrespondence DocumentsElement CorrespondenceRelatesElement', 'ElementCorrespondence CorrespondenceMethod', 'GovernsCorrespondence',
  [connect('ElementCorrespondence','GovernsCorrespondence','incoming'), connect('CorrespondenceMethod','GovernsCorrespondence'),
    {...connect('ElementCorrespondence','CorrespondenceRelatesElement','outgoing','UAFElement',2),referenceAttributes:['source','target'],distinctCounterparts:true}], [visible('ElementCorrespondence','source target')],
  ['ArchitectureDescriptionElement models a generic endpoint. Concrete UAF elements and complete architecture descriptions can also be endpoints.', 'The governing method records a rule as text. Its domain-specific interpretation requires review.']);
view('A4', 'Architecture Methodology', 178, 'Architecture projects use methodologies with explicit extensions or tailoring.',
  'ArchitectureProject ArchitectureMethodology Standard ArchitecturalDescription Viewpoint', 'UsesMethodology ExtendsMethodology DocumentsArchitectureProject MethodologyAppliesStandard MethodologyExtendsStandard',
  'ArchitectureProject ArchitectureMethodology', 'UsesMethodology ExtendsMethodology', [connect('ArchitectureProject','UsesMethodology'),
    connect('ArchitectureMethodology','UsesMethodology ExtendsMethodology','either'), connect('MethodologyExtension','ExtendsMethodology')], [], ['Process adherence requires review.']);
const statusDescriptions='ProductHasStatus ArchitectureStatusDescribesProduct';
const productVersions='VersionOfProduct ProductHasVersion';
view('A5', 'Architecture Status', 180, 'Work products have defined statuses.',
  'ArchitectureWorkProduct ArchitectureStatus ArchitecturalDescription Viewpoint View', `${statusDescriptions} DocumentsWorkProduct ArchitectureDescriptionGeneralization ContainsView WorkProductContainsView`,
  'ArchitectureStatus', '', [
    {...connect('ArchitectureWorkProduct',statusDescriptions,'either','ArchitectureStatus'), through:[
      {relations:['ArchitectureDescriptionGeneralization'],direction:'incoming'},
      {relations:['ContainsView','WorkProductContainsView'],direction:'outgoing'},
    ]},
    connect('ArchitectureStatus',statusDescriptions,'either','ArchitectureWorkProduct ArchitecturalDescription View'),
  ], [], ['Work products can show status directly, on a more specific architecture description, or on a view contained by either.']);
const versionSuccession='ArchitectureVersionSuccession ArchitectureVersionSupersedes';
view('A6', 'Architecture Versions', 182, 'Versions of work products, succession and baselines.',
  `ArchitectureVersion ${versionedWorkProducts}`, `${productVersions} ${versionSuccession} BaselineContains ArchitectureVersionGeneralization`,
  'ArchitectureVersion', '', [
    {...connect('ArchitectureVersion',productVersions,'either',versionedWorkProducts),
      through:{relations:['ArchitectureVersionGeneralization'],direction:'incoming'}},
    {...connect('ArchitectureVersion',versionSuccession,'either'),nodesExclude:['ArchitectureBaseline']},
    connect(versionedWorkProducts,productVersions,'either','ArchitectureVersion'),
  ], [],
  ['An architecture description can serve as the work product. A version can be linked through a baseline that specializes it, as on p.183.',
    'Newer-to-earlier ArchitectureVersionSupersedes follows p.182. ArchitectureVersionSuccession preserves the older inverse. Version-label uniqueness and date order need review.']);
view('A7', 'Architecture Metadata', 184, 'Assessment measures, groups, libraries, standards and metrics.',
  'Measure MeasureGroup MeasureLibrary Standard DesiredMetric AchievedMetric ArchitecturalDescription Viewpoint',
  'GroupsMeasure HostsMeasure GovernsMetric StandardSpecifiesMeasure MeasureAssessesArchitecture StandardAggregation', 'Measure', '', [{...connect('DesiredMetric AchievedMetric','GovernsMetric','incoming','Measure',1,1),referenceAttributes:['measure']}], [visible('DesiredMetric AchievedMetric','measure')],
  ['Whether measures suffice for an assessment and whether desired and achieved metrics are comparable require review.']);
view('A8', 'Architecture Standards', 186, 'Applicable standards, profiles, constraints and libraries.',
  'Standard StandardGroup StandardProfile StandardLibrary ArchitecturalConstraint', 'GroupsStandard ReferencesStandard HostsStandard StandardAggregation StandardGeneralization IncludesArchitecturalConstraint', 'Standard', '', [], [],
  ['Applicability, compliance with standard contents and ratification require review.']);
view('Ar', 'Architecture Roadmap', 189, 'Milestones define statuses of architecture work products.',
  'ArchitectureWorkProduct ArchitectureStatus ArchitectureMilestone ArchitectureProject ArchitectureVersion LogicalMilestone ResourceMilestone EnterprisePhase',
  `${statusDescriptions} DefinesArchitectureStatus SchedulesArchitecture ${productVersions} DefinesArchitectureEvolution ArchitectureMilestoneCorrespondence`,
  'ArchitectureWorkProduct ArchitectureStatus ArchitectureMilestone', 'DefinesArchitectureStatus', [connect('ArchitectureWorkProduct',statusDescriptions,'either','ArchitectureStatus'), connect('ArchitectureStatus',statusDescriptions,'either','ArchitectureWorkProduct'), connect('ArchitectureStatus','DefinesArchitectureStatus','incoming'), connect('ArchitectureMilestone','DefinesArchitectureStatus')]);
for (const [id,pages] of Object.entries({A1:'172–173',A2:'174–175',A3:'176–177',A4:'178–179',A5:'180–181',A6:'182–183',A7:'184–185',A8:'187–188',Ar:190})) viewpoints[id].sources.push(source(pages));

// Show typed payloads in viewpoints whose scope requires their display.
viewpoints.L3.references.push({ relations: ['LogicalInteraction'], attributes: ['conveyed'] });
viewpoints.L4.references.push({ relations: ['LogicalObjectFlow'], attributes: ['conveyed'] });
viewpoints.L3.sources.push(source(132));
relationTypes.LogicalInteraction.sources.push(source(132));
relationTypes.LogicalInteraction.description += ' The default connected presentation uses reference cards attached to the flow, following the example on page 132 with the original arch.js templates and colors.';

// Register the NAF grid tag on an explicit subtype, leaving the native
// Viewpoint vocabulary and arbitrary project viewpoints available.
node('NafViewpoint','Viewpoint',174,'A viewpoint tagged with a NAFv4.1 grid cell.',{
  attributes:{nafViewpoint:{type:'string',required:true,enum:Object.keys(viewpoints)}},sources:[source(79),source('174–175')],
});

export const createDefinition = ({nodeTypes:nativeNodes, relationTypes: {OperationalControlFlow: nativeControlFlow}}) => ({
  id: 'naf41-uaf', title: 'NAFv4.1 · UAF-based structural application profile', version: '4.1.0-arch.43', extends: 'uaf@1.0.0-arch.1',
  viewpointGrid: naf41Grid,
  description: 'All 47 NAFv4.1 (2026.03) viewpoint IDs with executable structural checks, inherited UAF 1.0 types and explicit application adapters. Use @help viewpoints naf41-uaf ID and @help connections naf41-uaf TYPE.',
  sources: [source('78–82, 88–190'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — inherited UAF 1.0 catalog', 'ReferenceDocs/nafv4/NAFv4-ADMBw-MDG-2026.05.xml — supporting comparison only; its declared foundation is NAF 4.0'],
  limitations: [mappingLimit, 'No certification or complete NAF/UAF conformance is claimed. All 47 IDs are covered structurally, not all normative semantics.', 'The inherited UAF coverage report still applies, including deferred native constraints. Application adapters are identified in type help.', 'Only included view elements/links count toward viewpoint connection rules. Typed references resolve in the model; designated structural references must also be visible.', 'NAF methodology, stakeholder approval, full state/sequence execution semantics and qualitative completeness require human review. See profiles/naf41/COVERAGE.md.'],
  aliases: { nodeTypes: { Service: {
    target: 'ServiceSpecification',
    description: 'NAF S1 vocabulary resolved to UAF 1.0 ServiceSpecification in this application profile. ActualService remains distinct.',
    sources: [source('104–105'), 'https://issues.omg.org/issues/UAF12-33'],
    limitations: ['UAF 1.2 renamed ServiceSpecification to Service alongside other service metamodel changes. This alias retains UAF 1.0 semantics; it does not claim cross-version equivalence.'],
  }, Node: {
    target: 'LogicalNode',
    description: 'NAF S2/L1/L4 Node vocabulary for the existing logical-node application type. Its UAF projection is OperationalArchitecture through LogicalNode.',
    sources: [source('107–108, 126–127, 134–135')],
    limitations: ['Explicit arch.js application mapping. This is not a native UAF or ADMBw stereotype named Node, nor an assertion that every OperationalArchitecture must be called Node.'],
  }, Role: {
    target: 'OperationalRole',
    description: 'NAF L4 vocabulary for a role held by a logical Node. The application profile resolves Role to the UAF 1.0 OperationalRole type.',
    sources: [source('134–135'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — OperationalRole'],
    limitations: ['HoldsRole and PerformsOperationalActivity express the explicit links in the NAF example. Native UAF role ownership and action-level execution semantics are outside this projection.'],
  }, PhysicalActiveResource: {
    target: 'ResourcePerformer',
    description: 'Abstract NAF physical active resource category mapped to UAF ResourcePerformer. Use a concrete subtype such as System for the S2 air traffic control system. Set stereotype "Physical Active Resource" to reproduce the caption in the example.',
    sources: [source('107–108'), source('151–152')],
    limitations: ['The application alias covers the full ResourcePerformer hierarchy. Models instantiating the former concrete adapter can pin naf41-uaf@4.1.0-arch.33.'],
  }, ServiceOperation: {
    target: 'ServiceMethod',
    description: 'NAF S3 operation vocabulary resolved to UAF 1.0 ServiceMethod, which extends UML Operation. This alias retains the native runtime rules and written source name.',
    sources: [source('109–110'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — ServiceMethod, base_Operation'],
    limitations: ['Application vocabulary mapping, not a claim that all native UML operation-owner, method and ownedParameter constraints are implemented.'],
  }, ResourceFunction: {
    target: 'Function',
    description: 'NAF Resource Function vocabulary resolved to UAF 1.0 Function. The written name is preserved in the model and diagram.',
    sources: [source('148–149'), source(157), 'ReferenceDocs/uaf/UAFP-1.0.xmi — Function'],
  }, PostType: {
    target: 'Post',
    description: 'P2 vocabulary for a type of post. The native UAF Post supplies the resource semantics.',
    sources: [source(152)],
  }, ArchitectureDescription: {
    target: 'ArchitecturalDescription',
    description: 'NAF Architecture Description vocabulary from the A1 cut-out and example, resolved to UAF 1.0 ArchitecturalDescription in this application profile.',
    sources: [source('172–173'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — ArchitecturalDescription'],
  }, Methodology: {
    target: 'ArchitectureMethodology',
    description: 'NAF A4 vocabulary for the methodology used by an architecture project. Resolves to the ArchitectureMethodology application type.',
    sources: [source('178–179')],
  }, Profile: {
    target: 'StandardProfile',
    description: 'NAF A8 vocabulary for a profile that references applicable standards or other profiles and includes architectural constraints.',
    sources: [source('186–188')],
  } } },
  mappings: [{ kind: 'node', relationship: 'equivalent',
    source: { framework: 'NAF', version: '4.1', type: 'Service' },
    target: { framework: 'UAF', version: '1.0', type: 'ServiceSpecification' },
    description: 'Explicit application-profile vocabulary equivalence for S1. Executable identity is defined separately by aliases.nodeTypes.Service.',
    sources: [source('104–105')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'rename',
    source: { framework: 'UAF', version: '1.0', type: 'ServiceSpecification' },
    target: { framework: 'UAF', version: '1.2', type: 'Service' },
    description: 'Documented UAF rename. Descriptive only: other service concepts and relationships also changed in UAF 1.2.',
    sources: ['https://issues.omg.org/issues/UAF12-33'], limitations: ['No automatic UAF 1.0 to 1.2 model conversion or complete semantic equivalence is asserted.'],
  }, { kind: 'node', relationship: 'specialization',
    source: { framework: 'NAF', version: '4.1', type: 'Node' },
    target: { framework: 'UAF', version: '1.0', type: 'OperationalArchitecture' },
    description: 'Application projection of NAF logical grouping nodes through LogicalNode extends OperationalArchitecture. Node is a vocabulary alias of LogicalNode within arch.js, not an alias of the entire UAF OperationalArchitecture category.',
    sources: [source('107–108, 126–127, 134–135')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'equivalent',
    source: { framework: 'NAF', version: '4.1', type: 'Role' },
    target: { framework: 'UAF', version: '1.0', type: 'OperationalRole' },
    description: 'Application-profile vocabulary equivalence for the L4 role usage. Executable identity is defined by aliases.nodeTypes.Role.',
    sources: [source('134–135'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — OperationalRole'], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'specialization',
    source: { framework: 'NAF', version: '4.1', type: 'LogicalActor' },
    target: { framework: 'UAF', version: '1.0', type: 'OperationalPerformer' },
    description: 'Distinct concrete application subtype for the logical Crew concept in the L1 example. Not an alias of all operational performers or a physical ActualPerson.',
    sources: [source('126–127')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'specialization',
    source: { framework: 'NAF', version: '4.1', type: 'LogicalEquipment' },
    target: { framework: 'UAF', version: '1.0', type: 'OperationalPerformer' },
    description: 'Distinct concrete application subtype for the logical equipment in the L1 example, separate from physical ResourcePerformer implementations.',
    sources: [source('126–127')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'equivalent',
    source: { framework: 'NAF', version: '4.1', type: 'PhysicalActiveResource' },
    target: { framework: 'UAF', version: '1.0', type: 'ResourcePerformer' },
    description: 'Application-profile identity for the abstract category. Executable identity is defined by aliases.nodeTypes.PhysicalActiveResource.',
    sources: [source('107–108'), source('151–152')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'specialization',
    source: { framework: 'NAF', version: '4.1', type: 'EquipmentType' },
    target: { framework: 'UAF', version: '1.0', type: 'ResourceArtifact' },
    description: 'A distinct application subtype for the equipment taxonomy shown in P1. It inherits the native attributes and physical resource relationship endpoints.',
    sources: [source('148–149')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'equivalent',
    source: { framework: 'NAF', version: '4.1', type: 'ResourceFunction' },
    target: { framework: 'UAF', version: '1.0', type: 'Function' },
    description: 'Application-profile vocabulary equivalence. Executable identity is defined by aliases.nodeTypes.ResourceFunction.',
    sources: [source('148–149'), source(157)], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'equivalent',
    source: { framework: 'NAF', version: '4.1', type: 'ServiceOperation' },
    target: { framework: 'UAF', version: '1.0', type: 'ServiceMethod' },
    description: 'Application-profile operation vocabulary equivalence. Native ServiceMethod extends UML Operation; deferred native ownership/method constraints remain outside the structural projection.',
    sources: [source('109–110'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — ServiceMethod'], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'specialization',
    source: { framework: 'NAF', version: '4.1', type: 'DataProductType' },
    target: { framework: 'UAF', version: '1.0', type: 'DataElement' },
    description: 'Concrete application subtype for a physical data product type. It also specializes the application PhysicalPassiveResource category; it is not an alias for all UAF DataElements.',
    sources: [source(110)], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'specialization',
    source: { framework:'NAF',version:'4.1',type:'InformationEntity' },
    target: { framework:'UAF',version:'1.0',type:'InformationElement' },
    description: 'Concrete information-model entity using the existing InformationElement base. This application subtype retains native relationship compatibility without asserting equivalent framework definitions.',
    sources: [source('141–142')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'specialization',
    source: { framework:'NAF',version:'4.1',type:'LogicalConstraint' },
    target: { framework:'UAF',version:'1.0',type:'OperationalConstraint' },
    description: 'Concrete application subtype for L8 constraints. The constrained rule kind follows from the declared type.',
    sources: [source('143–144')], limitations: [mappingLimit],
  }, { kind: 'node', relationship: 'equivalent',
    source: { framework:'NAF',version:'4.1',type:'ArchitectureDescription' },
    target: { framework:'UAF',version:'1.0',type:'ArchitecturalDescription' },
    description: 'A1 application-profile vocabulary equivalence. Executable identity is defined by aliases.nodeTypes.ArchitectureDescription.',
    sources: [source('172–173'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — ArchitecturalDescription'], limitations: [mappingLimit],
  }],
  requireViewpoint: true, defaultRelation: null, viewpoints,
  nodeTypes: {
    ...nodeTypes,
    // A2 governance is validated in the selected graph. Accept the original
    // compact UAF fields and the NAF cut-out's explicit relationship form.
    View:{...nativeNodes.View,attributes:{...nativeNodes.View.attributes,viewpoint:ref('Viewpoint',false)}},
    ArchitecturalDescription:{...nativeNodes.ArchitecturalDescription,attributes:{...nativeNodes.ArchitecturalDescription.attributes,viewPoint:ref('Viewpoint',false)}},
  },
  relationTypes: {
    ...relationTypes,
    OperationalControlFlow: {
      // Preserve the native action pair and attributes from the pinned base.
      // Separate pairs prevent a flow between a definition and an action.
      ...nativeControlFlow,
      activityFlow: true,
      from: [...nativeControlFlow.from, 'OperationalActivity'],
      to: [...nativeControlFlow.to, 'OperationalActivity'],
      pairs: [
        ...(nativeControlFlow.pairs ?? [{from:nativeControlFlow.from,to:nativeControlFlow.to}]),
        {from:['OperationalActivity'],to:['OperationalActivity']},
      ],
      description: 'Control flow between L4 operational activity definitions or between native UAF operational activity actions. Both endpoints must use the same representation.',
      sources: [source('133–135'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — OperationalControlFlow'],
    },
  },
});
