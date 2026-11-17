// Authored application mapping, not an OMG stereotype import.
// Edit this file; scripts/build-naf41.mjs writes the runtime JSON and coverage report.
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
  coverage[id] = { title, page, status: 'structural application checks', limitations };
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
node('CapabilityIncrement', 'ActualEnterprisePhase', 102, 'A planned increment of capability delivery.');
node('CapabilityMilestone', 'ProjectMilestone', 102, 'A milestone defining a capability increment.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('CapabilityProject', 'Project', 102, 'A project scheduling capability milestones.');
edge('CapabilityAggregation', 'Capability', 'Capability', 88, 'Whole capability to component capability.', { style: 'composition', acyclic: true });
edge('GroupsCapability', 'CapabilityGroup', 'Capability', 88, 'Group to member capability.');
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
edge('SchedulesCapability', 'CapabilityProject', 'CapabilityMilestone', 102, 'Project to scheduled milestone.');

// Service structure, explicit state/lifeline/parameter adapters.
node('ServiceGroup', 'UAFElement', 104, 'A grouping of service specifications.');
node('ServiceConstraint', 'Rule', 121, 'An individual constraint grouped by a service policy.');
node('ServiceFunctionParameter', 'ServiceParameter', 119, 'Parameter of a service function.', { attributes: { owner: ref('ServiceFunction'), resource: ref('PhysicalPassiveResource DataElement') } });
node('ServiceOperationParameter', 'ServiceParameter', 119, 'Parameter of a service operation (ServiceMethod).', { attributes: { owner: ref('ServiceMethod'), resource: ref('PhysicalPassiveResource DataElement') } });
node('ServiceState', 'UAFElement', 113, 'A state belonging to a service; distinct from a UAF StateDescription (state machine).', { attributes: { owner: ref('ServiceSpecification') } });
node('ServiceEvent', 'UAFElement', 113, 'An event relevant to service behavior.');
node('ServiceMode', 'UAFElement', 113, 'A mode of a service function.', { attributes: { function: ref('ServiceFunction') } });
node('ServiceLifeline', 'UAFElement', 116, 'An interaction lifeline representing a service.', { attributes: { represents: ref('ServiceSpecification') } });
node('ServiceReadinessLevel', 'PropertySet', 123, 'A defined service readiness level.');
node('ServiceMilestone', 'ProjectMilestone', 123, 'A milestone defining service readiness.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('ServiceProject', 'Project', 123, 'A project scheduling service milestones.');
edge('ServiceComposition', 'ServiceSpecification', 'ServiceSpecification', 106, 'Whole service to component service.', { style: 'composition', acyclic: true });
edge('ServiceDependency', 'ServiceSpecification', 'ServiceSpecification', 106, 'Dependent service to required service. Restricted service-to-service subset of the ADMBw relationship.');
edge('GroupsService', 'ServiceGroup', 'ServiceSpecification', 104, 'Group to member service.');
edge('SpecifiesServiceInterface', 'ServiceSpecification', 'ServiceInterface', 109, 'Service to specified interface.');
edge('SpecifiesServiceOperation', 'ServiceInterface', 'ServiceMethod', 109, 'Interface to operation.');
edge('ServicePolicySatisfiedBy', 'ServicePolicy', 'ServiceSpecification', 104, 'Policy to a service satisfying it.');
edge('GroupsServiceConstraint', 'ServicePolicy', 'ServiceConstraint', 121, 'Policy to member constraint.');
edge('EvaluatesServiceConstraint', 'Measure', 'ServiceConstraint', 121, 'Measure to evaluated service constraint.');
edge('ServiceStateTransition', 'ServiceState', 'ServiceState', 113, 'Source state to target state.', { allowSelf: true, attributes: { event: ref('ServiceEvent', false) } });
edge('EnablesServiceMode', 'ServiceState', 'ServiceMode', 113, 'State to enabled mode.');
edge('ServiceInteraction', 'ServiceLifeline', 'ServiceLifeline', 116, 'Ordered interaction between service lifelines.', { allowSelf: true, attributes: { order: { type: 'integer', required: true, min: 1 }, event: ref('ServiceEvent', false), operation: ref('ServiceMethod', false) } });
edge('DefinesServiceReadiness', 'ServiceMilestone', 'ServiceReadinessLevel', 123, 'Milestone to readiness level.');
edge('FulfilsServiceReadiness', 'ServiceSpecification', 'ServiceReadinessLevel', 123, 'Service to readiness level fulfilled.');
edge('SchedulesService', 'ServiceProject', 'ServiceMilestone', 123, 'Project to scheduled service milestone.');

// Logical: a needline is reified so it can be referenced by an interaction.
node('LogicalNode', 'OperationalArchitecture', 126, 'Convenience subtype of OperationalArchitecture for a NAF logical node. OperationalArchitecture remains usable directly.');
node('Needline', 'UAFElement', 128, 'An objectified need for exchanges between logical nodes, with typed source/target references.', { attributes: { source: ref('OperationalArchitecture'), target: ref('OperationalArchitecture'), conveyed: ref('OperationalExchangeItem', false, true) } });
node('LogicalState', 'UAFElement', 136, 'A state of a logical active resource.', { attributes: { owner: ref('OperationalAgent') } });
node('LogicalEvent', 'UAFElement', 136, 'An event relevant to logical behavior.');
node('LogicalMode', 'UAFElement', 136, 'A mode of an operational activity.', { attributes: { activity: ref('OperationalActivity') } });
node('LogicalLifeline', 'UAFElement', 139, 'A lifeline representing a logical active resource.', { attributes: { represents: ref('OperationalAgent') } });
node('InformationModel', 'UAFElement', 141, 'A model defining information entities.');
node('InformationAttribute', 'UAFElement', 141, 'A typed attribute of an information entity.', { attributes: { owner: ref('InformationElement'), attributeType: ref('InformationAttributeType') } });
node('InformationAttributeType', 'UAFElement', 141, 'A type used by information attributes.');
node('InformationProduct', 'OperationalExchangeItem', 141, 'An information product represented by an information model.');
node('LogicalRequirement', 'Requirement', 143, 'A logical requirement related to an operational constraint.');
node('LogicalSpecification', 'UAFElement', 143, 'A grouping of logical requirements and constraints.');
node('LogicalRationale', 'UAFElement', 143, 'A rationale for a logical constraint.');
node('LogicalReadinessLevel', 'PropertySet', 145, 'A defined logical resource readiness level.');
node('LogicalMilestone', 'ProjectMilestone', 145, 'A milestone defining logical readiness.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('LogicalProject', 'Project', 145, 'A project scheduling logical milestones.');
edge('GroupsLogicalResource', 'OperationalArchitecture', 'OperationalAgent OperationalActivity OperationalExchangeItem', 126, 'Logical node to the resources/behavior it groups.');
edge('LogicalDependency', 'OperationalAgent', 'OperationalAgent', 128, 'Logical structural dependency. A Needline is modeled separately.');
edge('LogicalInteraction', 'OperationalAgent', 'OperationalAgent', 131, 'Binary projection of a logical interaction with explicit payload; use needline to reference its need.', { style: 'flow', attributes: { conveyed: ref('OperationalExchangeItem', true, true), needline: ref('Needline', false) } });
edge('LogicalControlFlow', 'OperationalActivity', 'OperationalActivity', 133, 'Control flow between activity definitions (adapter, not UML action-level OperationalControlFlow).', { style: 'flow', allowSelf: true });
edge('LogicalObjectFlow', 'OperationalActivity', 'OperationalActivity', 133, 'Flow of logical passive resources between activity definitions.', { style: 'flow', allowSelf: true, attributes: { conveyed: ref('OperationalExchangeItem', true, true) } });
edge('LogicalStateTransition', 'LogicalState', 'LogicalState', 136, 'Source state to target state.', { allowSelf: true, attributes: { event: ref('LogicalEvent', false) } });
edge('EnablesLogicalMode', 'LogicalState', 'LogicalMode', 136, 'State to enabled activity mode.');
edge('LogicalSequenceInteraction', 'LogicalLifeline', 'LogicalLifeline', 139, 'Ordered interaction between logical lifelines.', { allowSelf: true, attributes: { order: { type: 'integer', required: true, min: 1 }, event: ref('LogicalEvent', false), activity: ref('OperationalActivity', false) } });
edge('SpecifiesInformation', 'InformationModel', 'InformationElement', 141, 'Information model to entity.');
edge('RepresentsInformationProduct', 'InformationModel', 'InformationProduct', 141, 'Information model to represented product.');
edge('LogicalRequirementConstraint', 'LogicalRequirement', 'OperationalConstraint', 143, 'Requirement to related logical constraint.');
edge('ConstrainsLogical', 'OperationalConstraint', 'OperationalAgent OperationalActivity OperationalExchangeItem', 143, 'Logical constraint to constrained subject.');
edge('GroupsLogicalConstraint', 'LogicalSpecification', 'LogicalRequirement OperationalConstraint', 143, 'Specification to requirement or constraint.');
edge('JustifiesLogical', 'LogicalRationale', 'OperationalConstraint', 143, 'Rationale to logical constraint.');
edge('TracesStrategicConstraint', 'OperationalConstraint', 'StrategicConstraint', 143, 'Logical constraint to strategic constraint traced.');
edge('DefinesLogicalReadiness', 'LogicalMilestone', 'LogicalReadinessLevel', 145, 'Milestone to readiness level.');
edge('FulfilsLogicalReadiness', 'OperationalAgent', 'LogicalReadinessLevel', 145, 'Logical active resource to readiness level fulfilled.');
edge('TracesCapabilityIncrement', 'LogicalReadinessLevel', 'CapabilityIncrement', 145, 'Logical readiness to capability increment traced.');
edge('SchedulesLogical', 'LogicalProject', 'LogicalMilestone', 145, 'Project to scheduled logical milestone.');

// Physical: passive resources and interactions have independent identities.
node('PhysicalPassiveResource', 'ResourceExchangeItem', 150, 'Abstract category for passive physical resources in this application mapping.', { abstract: true });
node('DataEntity', 'DataElement PhysicalPassiveResource', 165, 'Data entity; inherits UAF DataElement and the passive-resource application category.');
node('PhysicalMaterial', 'PhysicalPassiveResource', 150, 'Passive material exchanged or consumed by resources.');
node('ResourceInteraction', 'UAFElement', 153, 'Objectified interaction so standards/protocols can be attached without edge-to-edge references.', { attributes: { source: ref('ResourcePerformer'), target: ref('ResourcePerformer'), conveyed: ref('PhysicalPassiveResource DataElement', false, true) } });
node('ResourceState', 'UAFElement', 161, 'A state of a physical active resource.', { attributes: { owner: ref('ResourcePerformer') } });
node('ResourceEvent', 'UAFElement', 161, 'An event relevant to resource behavior.');
node('ResourceMode', 'UAFElement', 161, 'A mode of a resource function.', { attributes: { function: ref('Function') } });
node('ResourceLifeline', 'UAFElement', 163, 'A lifeline representing a physical active resource.', { attributes: { represents: ref('ResourcePerformer') } });
node('DataAttribute', 'UAFElement', 165, 'A typed attribute of a data entity.', { attributes: { owner: ref('DataElement'), attributeType: ref('DataAttributeType') } });
node('DataAttributeType', 'UAFElement', 165, 'A type used by data attributes.');
node('ResourceRequirement', 'Requirement', 168, 'A physical resource requirement related to a resource constraint.');
node('ResourceSpecification', 'UAFElement', 168, 'A grouping of resource requirements/constraints.');
node('ResourceRationale', 'UAFElement', 168, 'A rationale for a resource constraint.');
node('ResourceReadinessLevel', 'PropertySet', 170, 'A defined physical resource readiness level.');
node('ResourceMilestone', 'ProjectMilestone', 170, 'A milestone defining resource readiness.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('ResourceProject', 'Project', 170, 'A project scheduling resource milestones.');
edge('GroupsPhysicalResource', 'CapabilityConfiguration', 'ResourcePerformer PhysicalPassiveResource DataElement', 150, 'Capability configuration to member active/passive resource.');
edge('PhysicalDependency', 'ResourcePerformer', 'ResourcePerformer PhysicalPassiveResource DataElement', 150, 'Physical active resource to required active/passive resource.');
edge('FunctionGeneralization', 'Function', 'Function', 147, 'Specialized function to general function.', { style: 'generalization', acyclic: true });
edge('InteractionConformsTo', 'ResourceInteraction', 'Standard', 153, 'Interaction to governing standard/protocol. Protocol is a UAF Standard subtype.');
edge('ResourceImplementsProtocol', 'ResourcePerformer', 'Protocol', 153, 'Resource to implemented protocol; direct projection, not ADMBw ProtocolImplementation reification.');
edge('UsesPhysicalResource', 'Function', 'PhysicalPassiveResource DataElement', 156, 'Function to passive resource used.');
edge('DeliversPhysicalResource', 'Function', 'PhysicalPassiveResource DataElement', 156, 'Function to passive resource delivered.');
edge('FunctionalFlow', 'Function', 'Function', 156, 'Control flow between function definitions (not action-level FunctionControlFlow).', { style: 'flow', allowSelf: true });
edge('ResourceFlow', 'Function', 'Function', 156, 'Passive-resource flow between function definitions.', { style: 'flow', allowSelf: true, attributes: { conveyed: ref('PhysicalPassiveResource DataElement', true, true) } });
edge('ResourceStateTransition', 'ResourceState', 'ResourceState', 161, 'Source state to target state.', { allowSelf: true, attributes: { event: ref('ResourceEvent', false) } });
edge('EnablesResourceMode', 'ResourceState', 'ResourceMode', 161, 'State to enabled function mode.');
edge('ResourceSequenceInteraction', 'ResourceLifeline', 'ResourceLifeline', 163, 'Ordered interaction between resource lifelines.', { allowSelf: true, attributes: { order: { type: 'integer', required: true, min: 1 }, event: ref('ResourceEvent', false), function: ref('Function', false) } });
edge('SpecifiesData', 'DataModel', 'DataElement', 165, 'Data model to entity.');
edge('TracesInformationModel', 'DataModel', 'InformationModel', 165, 'Data model to information model traced.');
edge('ResourceRequirementConstraint', 'ResourceRequirement', 'ResourceConstraint', 168, 'Requirement to related resource constraint.');
edge('ConstrainsResource', 'ResourceConstraint', 'ResourcePerformer Function PhysicalPassiveResource DataElement', 168, 'Resource constraint to constrained subject.');
edge('GroupsResourceConstraint', 'ResourceSpecification', 'ResourceRequirement ResourceConstraint', 168, 'Specification to requirement or constraint.');
edge('JustifiesResource', 'ResourceRationale', 'ResourceConstraint', 168, 'Rationale to resource constraint.');
edge('TracesLogicalConstraint', 'ResourceConstraint', 'OperationalConstraint', 168, 'Resource constraint to logical constraint traced.');
edge('DefinesResourceReadiness', 'ResourceMilestone', 'ResourceReadinessLevel', 170, 'Milestone to resource readiness level.');
edge('DeliversResourceReadiness', 'CapabilityConfiguration', 'ResourceReadinessLevel', 170, 'Configuration to delivered resource readiness level.');
edge('TracesLogicalReadiness', 'ResourceReadinessLevel', 'LogicalReadinessLevel', 170, 'Resource readiness to logical readiness traced.');
edge('SchedulesResource', 'ResourceProject', 'ResourceMilestone', 170, 'Project to scheduled resource milestone.');

// Architecture foundation: explicit product/version/correspondence identities.
node('GlossaryTerm', 'Definition', 172, 'An architecture glossary definition.', { attributes: { definition: text(true) } });
node('ArchitectureWorkProduct', 'UAFElement', 178, 'A work product of architecting activities.');
node('ArchitectureMethodology', 'UAFElement', 178, 'A method used by an architecture project.');
node('MethodologyExtension', 'UAFElement', 178, 'An explicitly documented tailoring/extension of the methodology.', { attributes: { rationale: text(true) } });
node('ArchitectureProject', 'Project', 178, 'A project producing architecture work products.');
node('ArchitectureStatus', 'PropertySet', 180, 'A defined work-product status.');
node('ArchitectureVersion', 'UAFElement', 182, 'A version of an architecture work product.', { attributes: { version: text(true), date: { type: 'string', format: 'date' } } });
node('ArchitectureBaseline', 'UAFElement', 182, 'A controlled grouping of architecture versions/products.');
node('ArchitectureMilestone', 'ProjectMilestone', 189, 'A milestone defining architecture status.', { attributes: { date: { type: 'string', required: true, format: 'date' } } });
node('ElementCorrespondence', 'UAFElement', 176, 'Objectified correspondence between architecture-description elements.', { attributes: { source: ref('UAFElement'), target: ref('UAFElement') } });
node('CorrespondenceMethod', 'UAFElement', 176, 'A method governing architecture element correspondences.', { attributes: { rule: text(true) } });
node('MeasureGroup', 'UAFElement', 184, 'A grouping of assessment measures.');
node('MeasureLibrary', 'UAFElement', 184, 'A reusable collection of measure groups/measures.');
node('DesiredMetric', 'ActualMeasurement', 184, 'A desired metric governed by a measure.', { attributes: { measure: ref('Measure'), value: { type: 'number', required: true } } });
node('AchievedMetric', 'ActualMeasurement', 184, 'An achieved metric governed by a measure.', { attributes: { measure: ref('Measure'), value: { type: 'number', required: true } } });
node('StandardGroup', 'UAFElement', 186, 'A grouping of standards.');
node('StandardProfile', 'UAFElement', 186, 'A profile referencing standards or other standards profiles.');
node('StandardLibrary', 'UAFElement', 186, 'A reusable collection of standards/groups/profiles.');
edge('DefinesGlossaryTerm', 'ArchitecturalDescription', 'GlossaryTerm', 172, 'Architecture description to relevant glossary term.');
edge('ContainsView', 'ArchitecturalDescription', 'View', 174, 'Architecture description to constituent view. Same direction as ADMBw ViewsInArchitecturalDescription.');
edge('ConformsToViewpoint', 'View', 'Viewpoint', 174, 'View to governing viewpoint (also retain the native viewpoint reference).');
edge('StakeholderHasConcern', 'Stakeholder', 'Concern', 174, 'Stakeholder to concern. Same direction as ADMBw StakeholderConcern.');
edge('FramesConcern', 'Viewpoint', 'Concern', 174, 'Viewpoint to framed concern. Same direction as ADMBw ConcernForViewpoint.');
edge('AddressesConcern', 'View', 'Concern', 174, 'View to directly addressed concern.');
edge('GovernsCorrespondence', 'CorrespondenceMethod', 'ElementCorrespondence', 176, 'Method to correspondence governed.');
edge('DocumentsElement', 'ArchitecturalDescription', 'UAFElement', 176, 'Architecture description to documented element.');
edge('UsesMethodology', 'ArchitectureProject', 'ArchitectureMethodology', 178, 'Architecture project to methodology used.');
edge('ExtendsMethodology', 'MethodologyExtension', 'ArchitectureMethodology', 178, 'Tailoring extension to methodology extended.');
edge('ProductHasStatus', 'ArchitectureWorkProduct', 'ArchitectureStatus', 180, 'Work product to its status.');
edge('DocumentsWorkProduct', 'ArchitecturalDescription', 'ArchitectureWorkProduct', 180, 'Description to work product documented.');
edge('VersionOfProduct', 'ArchitectureVersion', 'ArchitectureWorkProduct', 182, 'Version to its work product.');
edge('ArchitectureVersionSuccession', 'ArchitectureVersion', 'ArchitectureVersion', 182, 'Earlier version to succeeding version.', { acyclic: true });
edge('BaselineContains', 'ArchitectureBaseline', 'ArchitectureVersion ArchitectureWorkProduct', 182, 'Baseline to version/product member.');
edge('GroupsMeasure', 'MeasureGroup', 'Measure', 184, 'Measure group to member measure.');
edge('HostsMeasure', 'MeasureLibrary', 'Measure MeasureGroup', 184, 'Library to measure/group hosted.');
edge('GroupsStandard', 'StandardGroup', 'Standard', 186, 'Group to member standard.');
edge('ReferencesStandard', 'StandardProfile', 'Standard StandardProfile', 186, 'Standards profile to referenced standard/profile.', { acyclic: true });
edge('HostsStandard', 'StandardLibrary', 'Standard StandardGroup StandardProfile', 186, 'Library to standard/group/profile hosted.');
edge('DefinesArchitectureStatus', 'ArchitectureMilestone', 'ArchitectureStatus', 189, 'Milestone to architecture status defined.');
edge('SchedulesArchitecture', 'ArchitectureProject', 'ArchitectureMilestone', 189, 'Architecture project to scheduled milestone.');

// All 47 current NAFv4.1 cells. Required membership is supplemented with per-element
// incident-link checks; optional information stays optional, including references.
view('C1', 'Capability Taxonomy', 88, 'Capability specialization and whole/part taxonomy.',
  'Capability CapabilityGroup AssessmentCriterion Measure', 'CapabilityGeneralization CapabilityAggregation GroupsCapability CharacterizesCapability EvaluatesCriterion', 'Capability');
view('C2', 'Enterprise Vision', 90, 'Vision, goals, enterprise phases and capabilities linked to them.',
  'EnterpriseVision VisionStatement EnterpriseGoal EnterprisePhase ActualEnterprisePhase Capability Effect EnduringTask ActualEnduringTask',
  'RequiresCapability SpecifiesGoal DesiresCapability DesiresVision DesiresGoal DesiredEffect CapabilityForTask Exhibits', 'EnterpriseVision EnterpriseGoal EnterprisePhase Capability', 'RequiresCapability SpecifiesGoal',
  [connect('EnterpriseVision','RequiresCapability'), connect('EnterpriseVision','SpecifiesGoal'), connect('EnterprisePhase','DesiresCapability DesiresVision DesiresGoal'), connect('Capability','RequiresCapability DesiresCapability','incoming'), connect('EnterpriseGoal','SpecifiesGoal','incoming')], [],
  ['EnterprisePhase is the required planning-phase representation in this mapping; ActualEnterprisePhase can additionally record actual states.',
    'The C2 cut-out permits desires from an enterprise phase to a capability, vision or goal. Every planning phase requires at least one of these links; a direct DesiresCapability is not mandatory when DesiresVision/DesiresGoal is present.']);
view('C3', 'Capability Dependencies', 92, 'Dependencies between capabilities, with optional specialization and grouping context.', 'Capability CapabilityGroup', 'CapabilityDependency CapabilityGeneralization CapabilityAggregation GroupsCapability', 'Capability', 'CapabilityDependency', [], [],
  ['Not every displayed capability must have a CapabilityDependency: specialization/grouping context is allowed, as SAR demonstrates in the p.93 example. The view requires at least one dependency; completeness of relevant real-world dependencies cannot be checked automatically.']);
view('C4', 'Standard Processes', 94, 'Operational activities supporting capabilities.', 'OperationalActivity Capability', 'MapsToCapability', 'OperationalActivity Capability', 'MapsToCapability', [connect('OperationalActivity','MapsToCapability'), connect('Capability','MapsToCapability','incoming')]);
view('C5', 'Effects', 96, 'Effects desired by capabilities and optional effectiveness criteria.', 'Capability Effect EffectivenessCriterion Measure', 'DesiredEffect SpecifiesEffectiveness CharacterizesEffect EvaluatesCriterion', 'Capability Effect', 'DesiredEffect', [connect('Capability','DesiredEffect'), connect('Effect','DesiredEffect','incoming')]);
view('C7', 'Performance Criteria', 98, 'Capabilities characterized by assessment criteria evaluated by measures, with optional effectiveness criteria.', 'Capability AssessmentCriterion Measure Effect', 'CharacterizesCapability EvaluatesCriterion SpecifiesEffectiveness CharacterizesEffect', 'Capability AssessmentCriterion Measure', 'CharacterizesCapability EvaluatesCriterion',
  [connect('Capability','CharacterizesCapability','incoming'), {...connect('AssessmentCriterion','CharacterizesCapability'),nodesExclude:['EffectivenessCriterion']}, {...connect('AssessmentCriterion','EvaluatesCriterion','incoming'),nodesExclude:['EffectivenessCriterion']}, connect('Measure','EvaluatesCriterion')], [],
  ['EffectivenessCriterion and its subtypes are excluded from the per-assessment-criterion mandatory characterization/evaluation checks. Their links are optional, following p.98 and the Time to find example on p.99. Ordinary assessment criteria still require the complete capability-criterion-measure chain.',
    'EvaluatesCriterion is directed from Measure to AssessmentCriterion, following the p.98 cut-out. The evaluates arrows on p.99 are drawn in the opposite direction; that illustration does not change endpoint compatibility.']);
view('C8', 'Planning Constraints', 100, 'Strategic constraints applied to capabilities. Constraint extends StrategicConstraint and supports the p.101 example vocabulary.', 'Capability StrategicConstraint StrategicRationale Effect EnterpriseVision EnterpriseGoal', 'ConstrainsCapability JustifiesStrategy OriginatesFromRationale DesiredEffect RequiresCapability SpecifiesGoal', 'Capability StrategicConstraint', 'ConstrainsCapability', [connect('StrategicConstraint','ConstrainsCapability'), connect('Capability','ConstrainsCapability','incoming')]);
view('Cr', 'Capability Roadmap', 102, 'Dated milestones define increments delivering capabilities.', 'CapabilityMilestone CapabilityIncrement Capability CapabilityProject EnterprisePhase CapabilityConfiguration', 'DefinesIncrement DeliversCapability SchedulesCapability DesiresCapability Exhibits', 'CapabilityMilestone CapabilityIncrement Capability', 'DefinesIncrement DeliversCapability', [connect('CapabilityMilestone','DefinesIncrement'), connect('CapabilityIncrement','DefinesIncrement','incoming'), connect('CapabilityIncrement','DeliversCapability'), connect('Capability','DeliversCapability','incoming')]);
view('S1', 'Service Taxonomy', 104, 'Service specialization taxonomy.', 'ServiceSpecification ServiceGroup ServicePolicy', 'ServiceGeneralization GroupsService ServicePolicySatisfiedBy', 'ServiceSpecification');
view('S2', 'Service Structure', 106, 'Service composition and dependencies; optional interfaces, functions and implementations.', 'ServiceSpecification ServiceGroup ServiceInterface ServiceFunction OperationalAgent ResourcePerformer', 'ServiceComposition ServiceDependency GroupsService SpecifiesServiceInterface IsCapableToPerform Consumes Exhibits Implements', 'ServiceSpecification', 'ServiceDependency', [connect('ServiceSpecification','ServiceComposition ServiceDependency','either')]);
view('S3', 'Service Interfaces', 109, 'Services specify their interfaces, operations and typed operation parameters.', 'ServiceSpecification ServiceInterface ServiceMethod ServiceOperationParameter PhysicalPassiveResource DataElement', 'SpecifiesServiceInterface SpecifiesServiceOperation', 'ServiceSpecification ServiceInterface', 'SpecifiesServiceInterface', [connect('ServiceSpecification','SpecifiesServiceInterface'), connect('ServiceInterface','SpecifiesServiceInterface','incoming')], [visible('ServiceOperationParameter','owner resource')]);
view('S4', 'Service Functions', 111, 'Functions enabling service specifications.', 'ServiceSpecification ServiceFunction OperationalAgent OperationalActivity', 'IsCapableToPerform Consumes', 'ServiceSpecification ServiceFunction', 'IsCapableToPerform', [connect('ServiceSpecification','IsCapableToPerform','outgoing','ServiceFunction'), connect('ServiceFunction','IsCapableToPerform','incoming','ServiceSpecification')]);
view('S5', 'Service States', 113, 'Service states, transitions, events and function modes.', 'ServiceSpecification ServiceState ServiceEvent ServiceMode ServiceFunction', 'ServiceStateTransition EnablesServiceMode IsCapableToPerform', 'ServiceSpecification ServiceState', 'ServiceStateTransition', [connect('ServiceState','ServiceStateTransition','either')], [visible('ServiceState','owner'), visible('ServiceMode','function')], ['Transition guards, state ownership consistency, reachability and execution are not evaluated.']);
view('S6', 'Service Sequence', 116, 'Ordered interactions between lifelines representing services.', 'ServiceSpecification ServiceLifeline ServiceEvent ServiceFunction ServiceInterface ServiceMethod', 'ServiceInteraction IsCapableToPerform SpecifiesServiceInterface SpecifiesServiceOperation', 'ServiceSpecification ServiceLifeline', 'ServiceInteraction', [connect('ServiceLifeline','ServiceInteraction','either')], [visible('ServiceLifeline','represents')], ['Order is a positive integer; UML interaction fragments, time semantics and unique sequence positions require review.']);
view('S7', 'Service Interface Parameters', 119, 'Operation/function parameters reference their owner and passive resource.', 'ServiceParameter ServiceFunction ServiceMethod PhysicalPassiveResource DataElement ServiceSpecification ServiceInterface', 'SpecifiesServiceInterface SpecifiesServiceOperation IsCapableToPerform', 'ServiceParameter', '', [], [visible('ServiceOperationParameter','owner resource'), visible('ServiceFunctionParameter','owner resource')], ['Use ServiceOperationParameter or ServiceFunctionParameter: the unqualified UAF ServiceParameter lacks the required owner/payload projection.']);
// The abstract parameter category excludes an unqualified ServiceParameter as a substitute.
node('ServiceInterfaceParameter', 'UAFElement', 119, 'Abstract parameter category for S7.', { abstract: true });
nodeTypes.ServiceOperationParameter.extends.push('ServiceInterfaceParameter');
nodeTypes.ServiceFunctionParameter.extends.push('ServiceInterfaceParameter');
viewpoints.S7.requiredNodes = ['ServiceInterfaceParameter'];
view('S8', 'Service Constraints', 121, 'Service policies group individual constraints.', 'ServicePolicy ServiceConstraint ServiceSpecification Measure', 'GroupsServiceConstraint ServicePolicySatisfiedBy EvaluatesServiceConstraint', 'ServicePolicy ServiceConstraint', 'GroupsServiceConstraint', [connect('ServicePolicy','GroupsServiceConstraint'), connect('ServiceConstraint','GroupsServiceConstraint','incoming')]);
view('Sr', 'Service Roadmap', 123, 'Milestones define readiness levels fulfilled by services.', 'ServiceMilestone ServiceReadinessLevel ServiceSpecification ServiceProject', 'DefinesServiceReadiness FulfilsServiceReadiness SchedulesService', 'ServiceMilestone ServiceReadinessLevel ServiceSpecification', 'DefinesServiceReadiness FulfilsServiceReadiness', [connect('ServiceMilestone','DefinesServiceReadiness'), connect('ServiceReadinessLevel','DefinesServiceReadiness','incoming'), connect('ServiceReadinessLevel','FulfilsServiceReadiness','incoming'), connect('ServiceSpecification','FulfilsServiceReadiness')]);
view('C1-S1', 'Service to Capability', 125, 'Service specifications contribute capabilities.', 'ServiceSpecification Capability', 'Exhibits', 'ServiceSpecification Capability', 'Exhibits', [connect('ServiceSpecification','Exhibits'), connect('Capability','Exhibits','incoming')]);
view('L1', 'Logical Taxonomy', 126, 'Logical nodes organize active resources and behavior.', 'OperationalAgent OperationalActivity OperationalExchangeItem Capability', 'OperationalGeneralization GroupsLogicalResource Exhibits', 'OperationalArchitecture OperationalPerformer OperationalActivity', 'GroupsLogicalResource', [connect('OperationalArchitecture','GroupsLogicalResource','outgoing','OperationalPerformer'), connect('OperationalArchitecture','GroupsLogicalResource','outgoing','OperationalActivity')]);
view('L2', 'Logical Structure', 128, 'Logical nodes and objectified needlines between them.', 'OperationalArchitecture Needline OperationalExchangeItem OperationalPerformer', 'LogicalDependency GroupsLogicalResource', 'OperationalArchitecture Needline', '', [], [visible('Needline','source target conveyed')], ['Needline source/target are references rendered in class details, not native UML AssociationClass ends. Structural hierarchy can use GroupsLogicalResource.']);
view('L2-L3', 'Logical Concept', 130, 'Informal high-level concept: no mandatory information-model content.', '*', '*', '', '', [], [], ['Rich pictures/external illustrations and their interpretation require human review. This permissive concept view is intentionally not a substitute for formal viewpoints.']);
view('L3', 'Logical Interactions', 131, 'Logical interactions carry passive logical resources.', 'OperationalAgent OperationalExchangeItem Needline', 'LogicalInteraction OperationalExchange GroupsLogicalResource', 'OperationalAgent OperationalExchangeItem', 'LogicalInteraction', [connect('OperationalAgent','LogicalInteraction','either')], [], ['LogicalInteraction.conveyed is typed and nonempty; edge payloads may be shared with other views. UAF OperationalExchange may supplement, but not replace, the application interaction.']);
view('L4', 'Logical Activities', 133, 'Control flows and allocation of activities to logical resources.', 'OperationalAgent OperationalActivity OperationalExchangeItem LogicalEvent Capability ServiceSpecification ResourcePerformer', 'LogicalControlFlow LogicalObjectFlow IsCapableToPerform MapsToCapability Consumes Implements', 'OperationalAgent OperationalActivity', 'LogicalControlFlow IsCapableToPerform', [connect('OperationalActivity','IsCapableToPerform','incoming','OperationalAgent'), connect('OperationalActivity','LogicalControlFlow','either')]);
view('L5', 'Logical States', 136, 'States of logical active resources and their transitions.', 'OperationalAgent LogicalState LogicalEvent LogicalMode OperationalActivity', 'LogicalStateTransition EnablesLogicalMode IsCapableToPerform', 'OperationalAgent LogicalState', 'LogicalStateTransition', [connect('LogicalState','LogicalStateTransition','either')], [visible('LogicalState','owner'), visible('LogicalMode','activity')], ['State-machine execution, same-owner transitions and guard completeness require review.']);
view('L6', 'Logical Sequence', 139, 'Ordered interactions between logical lifelines.', 'OperationalAgent LogicalLifeline LogicalEvent OperationalActivity', 'LogicalSequenceInteraction IsCapableToPerform', 'OperationalAgent LogicalLifeline', 'LogicalSequenceInteraction', [connect('LogicalLifeline','LogicalSequenceInteraction','either')], [visible('LogicalLifeline','represents')], ['Interaction fragments, concurrency and sequence ordering consistency require review.']);
view('L7', 'Information Model', 141, 'Information entities with optional model, product and typed attributes.', 'InformationElement InformationModel InformationAttribute InformationAttributeType InformationProduct', 'SpecifiesInformation RepresentsInformationProduct', 'InformationElement', '', [], [visible('InformationAttribute','owner attributeType')]);
view('L8', 'Logical Constraints', 143, 'Requirements relate constraints to their logical subjects.', 'LogicalRequirement OperationalConstraint OperationalAgent OperationalActivity OperationalExchangeItem LogicalSpecification LogicalRationale StrategicConstraint', 'LogicalRequirementConstraint ConstrainsLogical GroupsLogicalConstraint JustifiesLogical TracesStrategicConstraint', 'LogicalRequirement OperationalConstraint', 'LogicalRequirementConstraint ConstrainsLogical', [connect('LogicalRequirement','LogicalRequirementConstraint'), connect('OperationalConstraint','LogicalRequirementConstraint','incoming'), connect('OperationalConstraint','ConstrainsLogical')]);
view('Lr', 'Logical Roadmap', 145, 'Milestones define readiness fulfilled by logical resources.', 'LogicalMilestone LogicalReadinessLevel OperationalAgent LogicalProject CapabilityIncrement', 'DefinesLogicalReadiness FulfilsLogicalReadiness SchedulesLogical TracesCapabilityIncrement', 'LogicalMilestone LogicalReadinessLevel OperationalAgent', 'DefinesLogicalReadiness FulfilsLogicalReadiness', [connect('LogicalMilestone','DefinesLogicalReadiness'), connect('LogicalReadinessLevel','DefinesLogicalReadiness','incoming'), connect('LogicalReadinessLevel','FulfilsLogicalReadiness','incoming'), connect('OperationalAgent','FulfilsLogicalReadiness')]);
view('P1', 'Resource Taxonomy', 147, 'Physical active resources and their function taxonomy.', 'ResourcePerformer Function PhysicalPassiveResource Capability', 'ResourceGeneralization FunctionGeneralization IsCapableToPerform Exhibits', 'ResourcePerformer Function', '', [], [], ['Resource/function taxonomy may consist of a single root; decomposition and classification completeness require review.']);
view('P2', 'Resource Structure', 150, 'Configurations group active/passive resources with dependencies.', 'CapabilityConfiguration ResourcePerformer PhysicalPassiveResource DataElement ResourceInteraction', 'GroupsPhysicalResource PhysicalDependency', 'CapabilityConfiguration ResourcePerformer PhysicalPassiveResource', 'GroupsPhysicalResource PhysicalDependency', [connect('CapabilityConfiguration','GroupsPhysicalResource','outgoing','ResourcePerformer'), connect('CapabilityConfiguration','GroupsPhysicalResource','outgoing','PhysicalPassiveResource'), connect('PhysicalPassiveResource','GroupsPhysicalResource','incoming'), connect('PhysicalPassiveResource','PhysicalDependency','incoming')]);
view('P3', 'Resource Interactions', 153, 'Objectified interactions conform to standards/protocols; resources implement protocols.', 'ResourcePerformer ResourceInteraction Standard PhysicalPassiveResource DataElement', 'InteractionConformsTo ResourceImplementsProtocol', 'ResourcePerformer ResourceInteraction Standard Protocol', 'InteractionConformsTo ResourceImplementsProtocol', [connect('ResourceInteraction','InteractionConformsTo','outgoing','Protocol'), connect('ResourceInteraction','InteractionConformsTo','outgoing','Standard'), connect('ResourcePerformer','ResourceImplementsProtocol')], [visible('ResourceInteraction','source target conveyed')], ['Protocol extends Standard, so a governing protocol also satisfies Standard membership. Matching the exact interaction protocol to both endpoint implementations requires review.']);
view('P4', 'Resource Functions', 156, 'Resources perform functions using/delivering passive resources; functions have control/resource flows.', 'ResourcePerformer Function PhysicalPassiveResource DataElement', 'IsCapableToPerform UsesPhysicalResource DeliversPhysicalResource FunctionalFlow ResourceFlow', 'ResourcePerformer Function PhysicalPassiveResource', 'IsCapableToPerform UsesPhysicalResource DeliversPhysicalResource FunctionalFlow ResourceFlow', [connect('Function','IsCapableToPerform','incoming','ResourcePerformer'), connect('Function','FunctionalFlow','either'), connect('Function','ResourceFlow','either'), connect('PhysicalPassiveResource','UsesPhysicalResource DeliversPhysicalResource','incoming')]);
view('L4-P4', 'Activity to Function', 159, 'Resource functions implement operational activities, with optional service/function allocations and flow context.', 'Function OperationalActivity ServiceFunction ResourcePerformer PhysicalPassiveResource DataElement OperationalExchangeItem', 'Implements IsCapableToPerform LogicalControlFlow LogicalObjectFlow FunctionalFlow ResourceFlow', 'Function OperationalActivity', 'Implements', [connect('Function','Implements','outgoing','OperationalActivity'), connect('OperationalActivity','Implements','incoming','Function')]);
view('P5', 'Resource States', 161, 'Physical resource states and transitions.', 'ResourcePerformer ResourceState ResourceEvent ResourceMode Function LogicalState', 'ResourceStateTransition EnablesResourceMode IsCapableToPerform', 'ResourcePerformer ResourceState', 'ResourceStateTransition', [connect('ResourceState','ResourceStateTransition','either')], [visible('ResourceState','owner'), visible('ResourceMode','function')], ['State-machine execution, same-owner transitions and guard completeness require review.']);
view('P6', 'Resource Sequence', 163, 'Ordered interactions between resource lifelines.', 'ResourcePerformer ResourceLifeline ResourceEvent Function', 'ResourceSequenceInteraction IsCapableToPerform', 'ResourcePerformer ResourceLifeline', 'ResourceSequenceInteraction', [connect('ResourceLifeline','ResourceSequenceInteraction','either')], [visible('ResourceLifeline','represents')], ['Interaction fragments, concurrency and sequence ordering consistency require review.']);
view('P7', 'Data Model', 165, 'Data entities, typed attributes and optional information-model trace.', 'DataElement DataModel DataAttribute DataAttributeType InformationModel', 'SpecifiesData TracesInformationModel', 'DataElement', '', [], [visible('DataAttribute','owner attributeType')]);
view('P8', 'Resource Constraints', 168, 'Requirements relate constraints to their physical subjects.', 'ResourceRequirement ResourceConstraint ResourcePerformer Function PhysicalPassiveResource DataElement ResourceSpecification ResourceRationale OperationalConstraint', 'ResourceRequirementConstraint ConstrainsResource GroupsResourceConstraint JustifiesResource TracesLogicalConstraint', 'ResourceRequirement ResourceConstraint', 'ResourceRequirementConstraint ConstrainsResource', [connect('ResourceRequirement','ResourceRequirementConstraint'), connect('ResourceConstraint','ResourceRequirementConstraint','incoming'), connect('ResourceConstraint','ConstrainsResource')]);
view('Pr', 'Resource Roadmap', 170, 'Milestones define readiness delivered by capability configurations.', 'ResourceMilestone ResourceReadinessLevel CapabilityConfiguration ResourceProject LogicalReadinessLevel', 'DefinesResourceReadiness DeliversResourceReadiness SchedulesResource TracesLogicalReadiness', 'ResourceMilestone ResourceReadinessLevel CapabilityConfiguration', 'DefinesResourceReadiness DeliversResourceReadiness', [connect('ResourceMilestone','DefinesResourceReadiness'), connect('ResourceReadinessLevel','DefinesResourceReadiness','incoming'), connect('ResourceReadinessLevel','DeliversResourceReadiness','incoming'), connect('CapabilityConfiguration','DeliversResourceReadiness')]);
view('A1', 'Metadata Definitions', 172, 'Glossary terms relevant to the architecture description.', 'GlossaryTerm ArchitecturalDescription Viewpoint ArchitectureMetadata Standard', 'DefinesGlossaryTerm', 'GlossaryTerm', '', [], [], ['Glossary relevance and metadata completeness require review. Architecture descriptions and their native viewpoint references are optional here.']);
view('A2', 'Architecture Products', 174, 'Views, viewpoints, stakeholders and concerns linked to an architecture description.', 'ArchitecturalDescription View Viewpoint Stakeholder Concern', 'ContainsView ConformsToViewpoint StakeholderHasConcern FramesConcern AddressesConcern', 'ArchitecturalDescription View Viewpoint Stakeholder Concern', 'ContainsView ConformsToViewpoint StakeholderHasConcern FramesConcern', [connect('ArchitecturalDescription','ContainsView'), connect('View','ContainsView','incoming'), connect('View','ConformsToViewpoint'), connect('Stakeholder','StakeholderHasConcern'), connect('Concern','StakeholderHasConcern','incoming'), connect('Concern','FramesConcern','incoming'), connect('Viewpoint','FramesConcern')], [visible('View','viewpoint'), visible('ArchitecturalDescription','viewPoint')], ['The native View.viewpoint reference and the drawn ConformsToViewpoint link must be kept consistent by the author.']);
view('A3', 'Architecture Correspondence', 176, 'Objectified correspondences relate elements and are governed by methods.', 'UAFElement', 'GovernsCorrespondence DocumentsElement', 'ElementCorrespondence CorrespondenceMethod', 'GovernsCorrespondence', [connect('ElementCorrespondence','GovernsCorrespondence','incoming'), connect('CorrespondenceMethod','GovernsCorrespondence')], [visible('ElementCorrespondence','source target')], ['The governing method is recorded as text; its domain-specific rule is not executed.']);
view('A4', 'Architecture Methodology', 178, 'Architecture projects use methodologies with explicit extensions/tailoring.', 'ArchitectureProject ArchitectureMethodology MethodologyExtension Standard ArchitecturalDescription Viewpoint', 'UsesMethodology ExtendsMethodology', 'ArchitectureProject ArchitectureMethodology MethodologyExtension', 'UsesMethodology ExtendsMethodology', [connect('ArchitectureProject','UsesMethodology'), connect('ArchitectureMethodology','UsesMethodology','incoming'), connect('MethodologyExtension','ExtendsMethodology'), connect('ArchitectureMethodology','ExtendsMethodology','incoming')], [], ['A non-tailored methodology can record an explicit no-extension decision and rationale. Process adherence requires review.']);
view('A5', 'Architecture Status', 180, 'Work products have defined statuses.', 'ArchitectureWorkProduct ArchitectureStatus ArchitecturalDescription Viewpoint View', 'ProductHasStatus DocumentsWorkProduct ContainsView', 'ArchitectureWorkProduct ArchitectureStatus', 'ProductHasStatus', [connect('ArchitectureWorkProduct','ProductHasStatus'), connect('ArchitectureStatus','ProductHasStatus','incoming')]);
view('A6', 'Architecture Versions', 182, 'Versions of work products and temporal succession.', 'ArchitectureVersion ArchitectureWorkProduct ArchitectureBaseline', 'VersionOfProduct ArchitectureVersionSuccession BaselineContains', 'ArchitectureVersion ArchitectureWorkProduct', 'VersionOfProduct ArchitectureVersionSuccession', [connect('ArchitectureVersion','VersionOfProduct'), connect('ArchitectureVersion','ArchitectureVersionSuccession','either'), connect('ArchitectureWorkProduct','VersionOfProduct','incoming')], [], ['Succession is acyclic; version-label uniqueness, same-product succession and date ordering require review.']);
view('A7', 'Architecture Metadata', 184, 'Assessment measures and optional libraries, desired/achieved metrics.', 'Measure MeasureGroup MeasureLibrary Standard DesiredMetric AchievedMetric', 'GroupsMeasure HostsMeasure', 'Measure', '', [], [visible('DesiredMetric AchievedMetric','measure')], ['Whether measures are sufficient for an assessment and whether desired/achieved metrics are comparable require review.']);
view('A8', 'Architecture Standards', 186, 'Applicable architecture standards and optional profiles/libraries.', 'Standard StandardGroup StandardProfile StandardLibrary', 'GroupsStandard ReferencesStandard HostsStandard', 'Standard', '', [], [], ['Applicability, compliance with standard contents and organizational ratification require review.']);
view('Ar', 'Architecture Roadmap', 189, 'Milestones define statuses of architecture work products.', 'ArchitectureWorkProduct ArchitectureStatus ArchitectureMilestone ArchitectureProject ArchitectureVersion', 'ProductHasStatus DefinesArchitectureStatus SchedulesArchitecture VersionOfProduct', 'ArchitectureWorkProduct ArchitectureStatus ArchitectureMilestone', 'ProductHasStatus DefinesArchitectureStatus', [connect('ArchitectureWorkProduct','ProductHasStatus'), connect('ArchitectureStatus','ProductHasStatus','incoming'), connect('ArchitectureStatus','DefinesArchitectureStatus','incoming'), connect('ArchitectureMilestone','DefinesArchitectureStatus')]);

// Payload identities required by formal interaction/flow views must appear there.
viewpoints.L3.references.push({ relations: ['LogicalInteraction'], attributes: ['conveyed'] });
viewpoints.L4.references.push({ relations: ['LogicalObjectFlow'], attributes: ['conveyed'] });
viewpoints.P4.references.push({ relations: ['ResourceFlow'], attributes: ['conveyed'] });
viewpoints.L3.sources.push(source(132));
relationTypes.LogicalInteraction.sources.push(source(132));
relationTypes.LogicalInteraction.description += ' The default connected presentation uses reference cards attached to the flow, following the example on page 132 with the original arch.js templates and colors.';

export const definition = {
  id: 'naf41-uaf', title: 'NAFv4.1 · UAF-based structural application profile', version: '4.1.0-arch.6', extends: 'uaf',
  description: 'All 47 NAFv4.1 (2026.03) viewpoint IDs with executable structural checks, inherited UAF 1.0 types and explicit application adapters. Use @help viewpoints naf41-uaf ID and @help connections naf41-uaf TYPE.',
  sources: [source('78–82, 88–190'), 'ReferenceDocs/uaf/UAFP-1.0.xmi — inherited UAF 1.0 catalog', 'ReferenceDocs/nafv4/NAFv4-ADMBw-MDG-2026.05.xml — supporting comparison only; its declared foundation is NAF 4.0'],
  limitations: [mappingLimit, 'No certification or complete NAF/UAF conformance is claimed. All 47 IDs are covered structurally, not all normative semantics.', 'The inherited UAF coverage report still applies, including deferred native constraints. Application adapters are identified in type help.', 'Only included view elements/links count toward viewpoint connection rules. Typed references resolve in the model; designated structural references must also be visible.', 'NAF methodology, stakeholder approval, full state/sequence execution semantics and qualitative completeness require human review. See profiles/naf41/COVERAGE.md.'],
  requireViewpoint: true, defaultRelation: null, nodeTypes, relationTypes, viewpoints,
};
