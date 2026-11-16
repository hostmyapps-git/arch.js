// Hand-authored minimal scenarios, independent of the profile builder.
// These test representative structural models, not official conformance certification.
const cap = 'Capability cap "Search and rescue"';
const svc = 'ServiceSpecification service "Rescue service"';
const op = 'OperationalPerformer performer "Rescue team"';
const sw = 'Software resource "Rescue platform" { isStandardConfiguration false }';
const cfg = 'CapabilityConfiguration configuration "Rescue configuration" { isStandardConfiguration true }';
const passive = 'DataEntity data "Distress report"';
const ad = 'Viewpoint vp "Viewpoint specification" ArchitecturalDescription ad "Architecture description" { toBe true architectureFramework "NAFv4.1" viewPoint vp }';
const edge = (id,a,b,type) => `relation ${id} ${a} -> ${b} "${type}" { type ${type} }`;
export const cases = {
  C1: `${cap} Capability maritime "Maritime rescue" ${edge('taxonomy','maritime','cap','CapabilityGeneralization')}`,
  C2: `${cap} EnterpriseVision vision "Rescue vision" EnterpriseGoal goal "Save lives" EnterprisePhase phase "2027" ${edge('requires','vision','cap','RequiresCapability')} ${edge('goalLink','vision','goal','SpecifiesGoal')} ${edge('phaseLink','phase','cap','DesiresCapability')}`,
  C3: `${cap} Capability awareness "Situational awareness" ${edge('depends','cap','awareness','CapabilityDependency')}`,
  C4: `${cap} StandardOperationalActivity activity "Search procedure" ${edge('supports','activity','cap','MapsToCapability')}`,
  C5: `${cap} Effect effect "Lives saved" ${edge('desires','cap','effect','DesiredEffect')}`,
  C7: `${cap} AssessmentCriterion criterion "Response time" { expression "Time from alert to dispatch <= 10 minutes" } Measure measure "Elapsed time" { unit "minutes" } ${edge('characterizes','criterion','cap','CharacterizesCapability')} ${edge('evaluates','measure','criterion','EvaluatesCriterion')}`,
  C8: `${cap} StrategicConstraint constraint "Budget ceiling" { ruleKind Constraint } ${edge('constraintLink','constraint','cap','ConstrainsCapability')}`,
  Cr: `${cap} CapabilityIncrement increment "Initial capability" CapabilityMilestone milestone "Ready" { date "2027-01-01" } ${edge('defines','milestone','increment','DefinesIncrement')} ${edge('delivers','increment','cap','DeliversCapability')}`,
  S1: `${svc} ServiceSpecification specialized "Maritime rescue service" ${edge('taxonomy','specialized','service','ServiceGeneralization')}`,
  S2: `${svc} ServiceSpecification supporting "Weather service" ${edge('depends','service','supporting','ServiceDependency')}`,
  S3: `${svc} ServiceInterface api "Rescue API" ${edge('specifies','service','api','SpecifiesServiceInterface')}`,
  S4: `${svc} ServiceFunction fn "Coordinate rescue" ${edge('performs','service','fn','IsCapableToPerform')}`,
  S5: `${svc} ServiceState ready "Ready" { owner service } ServiceState active "Active" { owner service } ${edge('transition','ready','active','ServiceStateTransition')}`,
  S6: `${svc} ServiceSpecification weather "Weather service" ServiceLifeline rescueLine "Rescue service" { represents service } ServiceLifeline weatherLine "Weather" { represents weather } relation message rescueLine -> weatherLine "Request forecast" { type ServiceInteraction order 1 }`,
  S7: `ServiceFunction fn "Coordinate rescue" PhysicalMaterial report "Report" ServiceFunctionParameter parameter "Report input" { owner fn resource report }`,
  S8: `ServicePolicy policy "Service policy" { ruleKind Contract } ServiceConstraint constraint "Availability" { ruleKind Constraint } ${edge('groups','policy','constraint','GroupsServiceConstraint')}`,
  Sr: `${svc} ServiceMilestone milestone "Service ready" { date "2027-01-01" } ServiceReadinessLevel ready "Operational" ${edge('defines','milestone','ready','DefinesServiceReadiness')} ${edge('fulfils','service','ready','FulfilsServiceReadiness')}`,
  'C1-S1': `${svc} ${cap} ${edge('contributes','service','cap','Exhibits')}`,
  L1: `OperationalArchitecture logical "Rescue operations" ${op} OperationalActivity activity "Coordinate rescue" ${edge('groupsActor','logical','performer','GroupsLogicalResource')} ${edge('groupsActivity','logical','activity','GroupsLogicalResource')}`,
  L2: `OperationalArchitecture centre "Coordination centre" LogicalNode team "Rescue team node" Needline need "Coordination need" { source centre target team }`,
  'L2-L3': 'HighLevelOperationalConcept concept "Rescue concept"',
  L3: `${op} OperationalPerformer centre "Coordination centre" InformationElement information "Distress information" relation interaction performer -> centre "Alert" { type LogicalInteraction conveyed [information] }`,
  L4: `${op} OperationalActivity assess "Assess distress" OperationalActivity dispatch "Dispatch team" ${edge('allocation1','performer','assess','IsCapableToPerform')} ${edge('allocation2','performer','dispatch','IsCapableToPerform')} ${edge('flow','assess','dispatch','LogicalControlFlow')}`,
  L5: `${op} LogicalState ready "Ready" { owner performer } LogicalState active "Active" { owner performer } ${edge('transition','ready','active','LogicalStateTransition')}`,
  L6: `${op} OperationalPerformer centre "Coordination centre" LogicalLifeline teamLine "Team" { represents performer } LogicalLifeline centreLine "Centre" { represents centre } relation interaction centreLine -> teamLine "Dispatch" { type LogicalSequenceInteraction order 1 }`,
  L7: 'InformationElement information "Distress report"',
  L8: `${op} LogicalRequirement requirement "Respond quickly" OperationalConstraint constraint "Response time" { ruleKind Constraint } ${edge('relates','requirement','constraint','LogicalRequirementConstraint')} ${edge('constrains','constraint','performer','ConstrainsLogical')}`,
  Lr: `${op} LogicalMilestone milestone "Team ready" { date "2027-01-01" } LogicalReadinessLevel ready "Operational" ${edge('defines','milestone','ready','DefinesLogicalReadiness')} ${edge('fulfils','performer','ready','FulfilsLogicalReadiness')}`,
  P1: `${sw} Function fn "Dispatch asset" ${edge('performs','resource','fn','IsCapableToPerform')}`,
  P2: `${cfg} ${sw} ${passive} ${edge('groupsActive','configuration','resource','GroupsPhysicalResource')} ${edge('groupsPassive','configuration','data','GroupsPhysicalResource')} ${edge('depends','resource','data','PhysicalDependency')}`,
  P3: `${sw} System radio "Rescue radio" { isStandardConfiguration false } ResourceInteraction interaction "Dispatch link" { source resource target radio } Protocol protocol "Dispatch protocol" ${edge('conforms','interaction','protocol','InteractionConformsTo')} ${edge('implements1','resource','protocol','ResourceImplementsProtocol')} ${edge('implements2','radio','protocol','ResourceImplementsProtocol')}`,
  P4: `${sw} ${passive} Function assess "Assess report" Function dispatch "Dispatch asset" ${edge('performs1','resource','assess','IsCapableToPerform')} ${edge('performs2','resource','dispatch','IsCapableToPerform')} ${edge('uses','assess','data','UsesPhysicalResource')} ${edge('delivers','dispatch','data','DeliversPhysicalResource')} ${edge('control','assess','dispatch','FunctionalFlow')} relation payload assess -> dispatch "Pass report" { type ResourceFlow conveyed [data] }`,
  'L4-P4': `OperationalActivity activity "Dispatch rescue team" Function fn "Dispatch asset" ${edge('implements','fn','activity','Implements')}`,
  P5: `${sw} ResourceState ready "Ready" { owner resource } ResourceState active "Active" { owner resource } ${edge('transition','ready','active','ResourceStateTransition')}`,
  P6: `${sw} System radio "Rescue radio" { isStandardConfiguration false } ResourceLifeline platformLine "Platform" { represents resource } ResourceLifeline radioLine "Radio" { represents radio } relation interaction platformLine -> radioLine "Dispatch" { type ResourceSequenceInteraction order 1 }`,
  P7: passive,
  P8: `${sw} ResourceRequirement requirement "Deployable platform" ResourceConstraint constraint "Power supply" { ruleKind Constraint } ${edge('relates','requirement','constraint','ResourceRequirementConstraint')} ${edge('constrains','constraint','resource','ConstrainsResource')}`,
  Pr: `${cfg} ResourceMilestone milestone "Platform ready" { date "2027-01-01" } ResourceReadinessLevel ready "Operational" ${edge('defines','milestone','ready','DefinesResourceReadiness')} ${edge('delivers','configuration','ready','DeliversResourceReadiness')}`,
  A1: 'GlossaryTerm term "SAR" { definition "Search and Rescue" }',
  A2: `${ad} View product "Rescue concept view" { viewpoint vp } ActualPerson stakeholder "Mission commander" Concern concern "Rescue effectiveness" ${edge('contains','ad','product','ContainsView')} ${edge('conforms','product','vp','ConformsToViewpoint')} ${edge('concernLink','stakeholder','concern','StakeholderHasConcern')} ${edge('frames','vp','concern','FramesConcern')}`,
  A3: `${cap} ${svc} ElementCorrespondence correspondence "Service-capability trace" { source service target cap } CorrespondenceMethod method "Trace method" { rule "A provided service contributes to the stated capability" } ${edge('governs','method','correspondence','GovernsCorrespondence')}`,
  A4: `ArchitectureProject project "Rescue architecture project" { isStandardConfiguration false } ArchitectureMethodology methodology "NAF methodology" MethodologyExtension tailoring "Tailoring decision" { rationale "No additional method extension is required for this scope" } ${edge('uses','project','methodology','UsesMethodology')} ${edge('extends','tailoring','methodology','ExtendsMethodology')}`,
  A5: `ArchitectureWorkProduct product "Rescue architecture" ArchitectureStatus status "Draft" ${edge('statusLink','product','status','ProductHasStatus')}`,
  A6: `ArchitectureWorkProduct product "Rescue architecture" ArchitectureVersion first "Initial" { version "1.0" } ArchitectureVersion next "Updated" { version "1.1" } ${edge('version1','first','product','VersionOfProduct')} ${edge('version2','next','product','VersionOfProduct')} ${edge('succession','first','next','ArchitectureVersionSuccession')}`,
  A7: 'Measure measure "Response time" { unit "minutes" }',
  A8: 'Standard standard "Architecture standard"',
  Ar: `ArchitectureWorkProduct product "Rescue architecture" ArchitectureStatus status "Approved" ArchitectureMilestone milestone "Review board" { date "2027-01-01" } ${edge('statusLink','product','status','ProductHasStatus')} ${edge('defines','milestone','status','DefinesArchitectureStatus')}`,
};
export function document(id, model = cases[id], view = '') {
  return `architecture "${id} scenario" { config { profile naf41-uaf } model { ${model} } view test "${id}" { viewpoint ${id} ${view} } }`;
}
