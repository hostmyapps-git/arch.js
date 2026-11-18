import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import vm from 'node:vm';
import * as arch from '../src/arch.js';
import { cases, document } from './fixtures/naf41/cases.mjs';
for (const id of ['uaf', 'naf41-uaf']) arch.registerProfile(id, JSON.parse(await readFile(`profiles/${id}.json`, 'utf8')));
const coverage = JSON.parse(await readFile('profiles/naf41/coverage.json', 'utf8'));
const errors = source => arch.validate(source).diagnostics.map(d => d.message).join('\n');
const without = (id, relationship) => document(id, cases[id].replace(new RegExp(`relation ${relationship} [^}]*}`), ''));

test('S3 reproduces p.110 with operation vocabulary, a shared parameter and optional physical-resource traces',async()=>{
  const source=await readFile('examples/naf41-service-interfaces.arch','utf8');
  for(const validation of ['strict','draft'])assert.deepEqual(arch.validate(source,{validation}).diagnostics,[]);
  const model=arch.parse(source),graph=arch.layout(model);
  assert.equal(model.nodes.length,9);assert.equal(graph.nodes.length,9);assert.equal(model.edges.length,9);
  assert.equal(model.nodes.filter(n=>n.type==='ServiceOperation').length,2);
  assert.equal(model.nodes.filter(n=>n.type==='DataProductType').length,2);
  assert.equal(model.nodes.filter(n=>n.type==='ServiceOperationParameter').length,3);
  assert.deepEqual(model.edges.filter(e=>e.target==='geographicLocation').map(e=>e.source),['submitLocation','setArea']);
  assert.equal(model.nodes.find(n=>n.id==='resource').attributes?.resource,undefined);
  assert.equal(model.edges.some(e=>e.source==='resource'&&e.type==='InvolvesPhysicalResource'),false);
  assert.deepEqual(model.edges.map(e=>[e.type,e.source,e.target]),[
    ['SpecifiesServiceInterface','situation','picture'],['SpecifiesServiceOperation','picture','submitLocation'],['SpecifiesServiceOperation','picture','setArea'],
    ['HasServiceOperationParameter','submitLocation','geographicLocation'],['HasServiceOperationParameter','setArea','geographicLocation'],
    ['HasServiceOperationParameter','submitLocation','resource'],['HasServiceOperationParameter','submitLocation','track'],
    ['InvolvesPhysicalResource','geographicLocation','positionReport'],['InvolvesPhysicalResource','track','targetTrackRecord']
  ]);
  const expected=arch.renderToString(source,{idPrefix:'s3'});assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'s3'}),expected);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);vm.runInContext(await readFile('profiles/profiles.js','utf8'),context);
    assert.equal(context.arch.renderToString(source,{idPrefix:'s3'}),expected);
  }
});

test('S3 aliases operations, specializes data products and validates has/involves directions without changing native UAF',async()=>{
  const p=arch.getProfile('naf41-uaf');assert.equal(p.nodeTypes.ServiceOperation.aliasOf,'ServiceMethod');
  assert.deepEqual(p.nodeTypes.DataProductType.extends,['DataElement','PhysicalPassiveResource']);assert.equal(p.nodeTypes.DataProductType.abstract,false);
  for(const name of ['ServiceOperation','DataProductType'])assert.equal(arch.getProfile('uaf').nodeTypes[name],undefined);
  const source=await readFile('examples/naf41-service-interfaces.arch','utf8');
  assert.equal(arch.validate(source.replaceAll('ServiceOperation submit','ServiceMethod submit').replaceAll('ServiceOperation set','ServiceMethod set')).valid,true);
  for(const [from,to,type]of [['submitLocation','geographicLocation','HasServiceOperationParameter'],['geographicLocation','positionReport','InvolvesPhysicalResource']])
    assert.match(errors(source.replace(`${from} -> ${to}`,`${to} -> ${from}`)),new RegExp(`not allowed for ${type}`));
  assert.match(errors(source.replace('DataProductType positionReport','DataModel positionReport')),/not allowed for InvolvesPhysicalResource/);
  const drop=id=>source.replace(new RegExp(`relation ${id} [^}]*}`),'').replace(new RegExp(`route ${id} [^}]*}`),'');
  assert.match(errors(drop('specifiesArea')),/setArea requires.*SpecifiesServiceOperation/);
  assert.match(errors(drop('submitResource')),/resource requires.*HasServiceOperationParameter/);
  for(const query of ['types naf41-uaf ServiceOperation','connections naf41-uaf ServiceOperation','types naf41-uaf DataProductType','viewpoints naf41-uaf S3'])assert.ok(arch.help(query).length>50);
  assert.equal(arch.validate(source.replace('viewpoint S3','viewpoint S7')).valid,false,'S7 still requires a resource association for every operation parameter');
  const dataModel=source.replace('model {','model { DataModel dataModel "Report model" {kind Physical} relation schema dataModel -> positionReport "specifies" {type SpecifiesData}');
  assert.equal(arch.validate(dataModel).valid,true,'DataModel trace passes through the DataProductType');
});

test('S3/S7 retain legacy owner/resource syntax as alternative evidence with visible typed targets',()=>{
  const body='Service s "S" ServiceInterface i "I" ServiceMethod op "Op" DataProductType product "Product" ServiceOperationParameter p "Parameter" {owner op resource product} relation specifies s -> i "" {type SpecifiesServiceInterface} relation operation i -> op "" {type SpecifiesServiceOperation}';
  for(const viewpoint of ['S3','S7'])assert.equal(arch.validate(document(viewpoint,body)).valid,true,viewpoint);
  const mixed=body+' relation parameter op -> p "has" {type HasServiceOperationParameter} relation payload p -> product "involves" {type InvolvesPhysicalResource}';
  assert.equal(arch.validate(document('S3',mixed)).valid,true);
  assert.match(errors(document('S3',body.replace('owner op','owner product'))),/Reference type DataProductType is not allowed/);
  assert.match(errors(document('S3',body,'include s, i, p, product')),/owner references op.*must be visible/);
  assert.equal(arch.validate(document('S3',body.replace(' resource product',''))).valid,true,'resource association is optional in S3');
  assert.equal(arch.validate(document('S7',body.replace(' resource product',''))).valid,false,'resource association remains required in S7');
  const missingOwner=arch.validate(document('S3',body.replace('owner op ','')),{validation:'draft'});
  assert.equal(missingOwner.valid,true);assert.equal(missingOwner.conformant,false);
  assert.match(missingOwner.diagnostics[0].message,/HasServiceOperationParameter.*reference attributes: owner/);
});

test('S2 reproduces p.108 with a logical Node, five services, an interface, function and physical realization',async()=>{
  const source=await readFile('examples/naf41-service-structure.arch','utf8');
  for(const validation of ['strict','draft'])assert.deepEqual(arch.validate(source,{validation}).diagnostics,[]);
  const model=arch.parse(source),graph=arch.layout(model);
  assert.equal(model.nodes.length,9);assert.equal(graph.nodes.length,9);assert.equal(graph.edges.length,8);
  assert.equal(model.nodes.find(n=>n.id==='controller').type,'Node');
  assert.equal(model.nodes.find(n=>n.id==='airTraffic').type,'PhysicalActiveResource');
  assert.equal(model.nodes.filter(n=>n.type==='Service').length,5);
  assert.deepEqual(model.edges.map(e=>[e.type,e.source,e.target]),[
    ['ConsumesService','controller','situation'],['ServiceDependency','situation','position'],['ServiceDependency','situation','documents'],
    ['SpecifiesServiceInterface','position','getArea'],['EnablesService','getAreaOfInterest','position'],
    ['ServiceAggregation','documents','platform'],['ServiceAggregation','documents','storage'],['RealizesService','airTraffic','situation']
  ]);
  const expected=arch.renderToString(source,{idPrefix:'s2'});
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'s2'}),expected);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);vm.runInContext(await readFile('profiles/profiles.js','utf8'),context);
    assert.equal(context.arch.renderToString(source,{idPrefix:'s2'}),expected);
  }
});

test('Node is a vocabulary alias of LogicalNode, retaining logical type compatibility and source spelling',()=>{
  const p=arch.getProfile('naf41-uaf');assert.equal(p.nodeTypes.Node.aliasOf,'LogicalNode');
  assert.deepEqual(p.nodeTypes.Node.extends,['OperationalArchitecture']);
  for(const id of ['L1','L2'])assert.equal(arch.validate(document(id,cases[id].replaceAll('OperationalArchitecture','Node'))).valid,true,id);
  for(const type of ['Node','LogicalNode','OperationalArchitecture']) {
    const body=`${type} node "Controller" Service a "A" Service b "B" relation dep a -> b "depends" {type ServiceDependency} relation uses node -> a "consumes" {type ConsumesService}`;
    assert.equal(arch.validate(document('S2',body)).valid,true,type);
  }
  for(const query of ['aliases naf41-uaf','types naf41-uaf Node'])assert.match(arch.help(query),/LogicalNode/);
  assert.match(arch.help('connections naf41-uaf Node'),/ConsumesService/);
  assert.match(arch.help('viewpoints naf41-uaf S2'),/107–108|p\.108/);
  assert.equal(arch.getProfile('uaf').nodeTypes.Node,undefined);
});

test('S2 ServiceAggregation is a separate directed whole-to-member relationship with reusable members and acyclic grouping',async()=>{
  const body='Service a "A" ServiceSpecification b "B" Service member "Member" relation dependency a -> b "depends" {type ServiceDependency} relation first a -> member "aggregates" {type ServiceAggregation} relation second b -> member "aggregates" {type ServiceAggregation}';
  assert.equal(arch.validate(document('S2',body)).valid,true,'a member may belong to multiple aggregations');
  const p=arch.getProfile('naf41-uaf'),rule=p.relationTypes.ServiceAggregation;
  assert.equal(rule.aliasOf,undefined);assert.equal(rule.extends,undefined);assert.equal(rule.style,'flow');assert.equal(rule.acyclic,true);assert.equal(rule.allowSelf,false);
  assert.equal(p.relationTypes.ServiceComposition.style,'composition');
  assert.equal(arch.getProfile('uaf').relationTypes.ServiceAggregation,undefined);
  assert.match(errors(document('S2',body+' relation back member -> a "cycle" {type ServiceAggregation}')),/ServiceAggregation: Cycles are not allowed/);
  assert.match(errors(document('S2',body.replace('a -> member','a -> a'))),/Self-relationships/);
  assert.match(errors(document('S2',body.replace('Service member','Node member'))),/not allowed for ServiceAggregation/);
  const source=await readFile('examples/naf41-service-structure.arch','utf8');
  assert.equal(arch.validate(source.replaceAll('type ServiceAggregation','type ServiceComposition')).valid,true,'older composition models remain supported');
  const graph=arch.layout(source),aggregation=graph.edges.find(e=>e.type==='ServiceAggregation');
  assert.equal(aggregation.style,'flow');assert.ok(graph.sharedPaths.some(p=>p.types.includes('ServiceAggregation')));
  assert.match(arch.help('connections naf41-uaf Service'),/ServiceAggregation/);
  assert.match(arch.help('relations naf41-uaf ServiceAggregation'),/not an alias/);
});

test('S2 application links enforce their directions and retain native UAF endpoints and mandatory structural connections',async()=>{
  const source=await readFile('examples/naf41-service-structure.arch','utf8');
  for(const [from,to,type]of [['controller','situation','ConsumesService'],['getAreaOfInterest','position','EnablesService'],['airTraffic','situation','RealizesService']]) {
    assert.match(errors(source.replace(`${from} -> ${to}`,`${to} -> ${from}`)),new RegExp(`not allowed for ${type}`));
  }
  for(const [replacement,native]of [['ConsumesService','Consumes'],['EnablesService','IsCapableToPerform'],['RealizesService','Implements']]) {
    assert.match(errors(source.replace(`type ${replacement}`,`type ${native}`)),/not allowed/);
  }
  assert.match(errors(source.replace('isStandardConfiguration false','')),/Missing required attribute isStandardConfiguration/);
  assert.match(errors(document('S2','Node n "N" Service s "S" relation consume n -> s "consumes" {type ConsumesService}')),/Missing required relationship type ServiceDependency/);
  for(const id of ['ConsumesService','EnablesService','RealizesService'])assert.equal(arch.getProfile('uaf').relationTypes[id],undefined);
  assert.deepEqual(arch.getProfile('uaf').relationTypes.Consumes.from,['OperationalActivity']);
  const physical=arch.getProfile('naf41-uaf').nodeTypes.PhysicalActiveResource;
  assert.equal(physical.abstract,false);assert.deepEqual(physical.extends,['ResourcePerformer']);
  assert.equal(physical.attributes.isStandardConfiguration.required,true);
  assert.equal(arch.getProfile('uaf').nodeTypes.PhysicalActiveResource,undefined);
  assert.equal(arch.getProfile('uaf').nodeTypes.ResourcePerformer.abstract,true);
  assert.equal(arch.validate(source.replace('PhysicalActiveResource airTraffic','System airTraffic')).valid,true,'specific native resource remains supported');
  assert.match(errors(source.replace('PhysicalActiveResource airTraffic','Node airTraffic').replace('isStandardConfiguration false','')),/not allowed for RealizesService/);
});

test('S1 accepts p.105 Service vocabulary, specialization and the service-to-policy direction',async()=>{
  const source=await readFile('examples/naf41-service-taxonomy.arch','utf8');
  for(const validation of ['strict','draft']) {
    const report=arch.validate(source,{validation});assert.equal(report.valid,true);assert.deepEqual(report.diagnostics,[]);
  }
  const model=arch.parse(source),graph=arch.layout(model);
  assert.equal(model.nodes.length,5);assert.equal(model.nodes.filter(n=>n.type==='Service').length,4);assert.equal(graph.edges.length,4);
  assert.deepEqual(graph.treeGroups[0].roots,['service_maritimeRescue']);assert.deepEqual(graph.sharedPaths[0].edgeIds,['s1.1','s1.2','s1.3']);
  assert.deepEqual(model.edges.map(e=>[e.type,e.source,e.target]),[
    ...['inshore','offshore','underwater'].map(kind=>['ServiceGeneralization',`service_${kind}Rescue`,'service_maritimeRescue']),
    ['SatisfiesServicePolicy','service_inshoreRescue','policy_inMissionOperation']
  ]);
  assert.equal(arch.validate(source.replace('service_inshoreRescue -> policy_inMissionOperation','policy_inMissionOperation -> service_inshoreRescue').replace('type SatisfiesServicePolicy','type ServicePolicySatisfiedBy')).valid,true,'inverse remains compatible');
  assert.match(errors(source.replace('service_inshoreRescue -> policy_inMissionOperation','policy_inMissionOperation -> service_inshoreRescue')),/not allowed for SatisfiesServicePolicy/);
  assert.match(errors(source.replace(' { ruleKind Constraint }','')),/Missing required attribute ruleKind/);
  const expected=arch.renderToString(source,{idPrefix:'s1'});
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'s1'}),expected);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);vm.runInContext(await readFile('profiles/profiles.js','utf8'),context);
    assert.equal(context.arch.renderToString(source,{idPrefix:'s1'}),expected);
  }
});

test('Service aliases native ServiceSpecification without changing UAF or conflating ActualService',()=>{
  const type=arch.getProfile('naf41-uaf').nodeTypes.Service;
  assert.equal(type.aliasOf,'ServiceSpecification');assert.deepEqual(type.extends,arch.getProfile('naf41-uaf').nodeTypes.ServiceSpecification.extends);assert.equal(type.abstract,false);assert.equal(type.template,'service');
  assert.equal(arch.getProfile('uaf').nodeTypes.Service,undefined);
  const mixed=cases.S1.replace('ServiceSpecification service','Service service');assert.equal(arch.validate(document('S1',mixed)).valid,true);
  for(const id of ['S2','S3','S4','S6','C1-S1'])assert.equal(arch.validate(document(id,cases[id].replaceAll('ServiceSpecification','Service'))).valid,true,id);
  assert.match(errors(document('S1',mixed+' ActualService instance "Instance" relation wrong instance -> service "is a kind of" {type ServiceGeneralization}')),/not allowed for ServiceGeneralization/);
  assert.match(errors(document('S1',mixed+' relation back service -> specialized "cycle" {type ServiceGeneralization}')),/Cycles are not allowed/);
  assert.match(arch.help('types naf41-uaf Service'),/ServiceSpecification/);
  const connections=arch.help('connections naf41-uaf Service');for(const name of ['ServiceGeneralization','SatisfiesServicePolicy','GroupsService'])assert.match(connections,new RegExp(name));
  assert.match(arch.help('viewpoints naf41-uaf S1'),/p\.105|pp\.104|ServiceSpecification/);
});

test('S1 cut-out supports nested service groups with acyclic group membership and separate service membership',()=>{
  const body='Service service "Rescue" ServiceGroup all "All services" ServiceGroup rescue "Rescue group" relation subgroup all -> rescue "aggregates" {type AggregatesServiceGroup} relation member rescue -> service "aggregates" {type GroupsService}';
  assert.equal(arch.validate(document('S1',body)).valid,true);
  assert.match(errors(document('S1',body+' relation back rescue -> all "cycle" {type AggregatesServiceGroup}')),/Cycles are not allowed/);
  assert.match(errors(document('S1',body.replace('all -> rescue','all -> all'))),/Self|self/);
  assert.match(errors(document('S1',body.replace('all -> rescue','all -> service'))),/not allowed for AggregatesServiceGroup/);
  assert.match(errors(document('S1',body.replace('rescue -> service','rescue -> all'))),/not allowed for GroupsService/);
  assert.equal(arch.getProfile('uaf').relationTypes.AggregatesServiceGroup,undefined);
});

test('Cr reproduces all six elements and seven relationships of the p.103 example without visible milestones',async()=>{
  const source=await readFile('examples/naf41-capability-roadmap.arch','utf8');
  for(const validation of ['strict','draft']) {
    const report=arch.validate(source,{validation});assert.equal(report.valid,true);assert.deepEqual(report.diagnostics,[]);
  }
  const model=arch.parse(source),graph=arch.layout(model);
  assert.equal(model.nodes.length,6);assert.equal(graph.nodes.length,6);assert.equal(graph.edges.length,7);
  assert.equal(model.nodes.filter(n=>n.type==='EnterprisePhase').length,4);
  assert.deepEqual(model.edges.map(e=>[e.type,e.source,e.target]),[
    ['DeliversCapability','capabilityIncrement_maritimeRescueByAircraft','c_maritimeSAR'],
    ['RelatesToEnterprisePhase','capabilityIncrement_maritimeRescueByAircraft','enterprisePhase_IOC'],
    ...['IOC','MOC','FOC'].map(p=>['AggregatesEnterprisePhase','enterprisePhase_Horizon2030',`enterprisePhase_${p}`]),
    ['TriggersEnterprisePhase','enterprisePhase_IOC','enterprisePhase_MOC'],
    ['TriggersEnterprisePhase','enterprisePhase_MOC','enterprisePhase_FOC']
  ]);
  assert.deepEqual(graph.sharedPaths[0].edgeIds,['cr.3','cr.4','cr.5']);
  const expected=arch.renderToString(source,{idPrefix:'cr'});
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'cr'}),expected);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    vm.runInContext(await readFile('profiles/profiles.js','utf8'),context);
    assert.equal(context.arch.renderToString(source,{idPrefix:'cr'}),expected);
  }
  const help=arch.help('connections naf41-uaf EnterprisePhase');
  for(const type of ['AggregatesEnterprisePhase','TriggersEnterprisePhase'])assert.match(help,new RegExp(type));
  assert.match(arch.help('viewpoints naf41-uaf Cr'),/implicit|properties/);
});

test('Cr phase adapters enforce endpoint types, directed self-link/cycle rules and retain optional phase context',()=>{
  for(const type of ['AggregatesEnterprisePhase','TriggersEnterprisePhase']) {
    const body=cases.Cr+` EnterprisePhase horizon "Horizon 2030" EnterprisePhase ioc "IOC" EnterprisePhase moc "MOC"
      relation first horizon -> ioc "phase link" {type ${type}} relation next ioc -> moc "phase link" {type ${type}}`;
    assert.equal(arch.validate(document('Cr',body)).valid,true);
    assert.match(errors(document('Cr',body+` relation back moc -> horizon "cycle" {type ${type}}`)),/Cycles are not allowed/);
    assert.match(errors(document('Cr',body.replace('horizon -> ioc','horizon -> horizon'))),/Self|self/);
    assert.match(errors(document('Cr',body.replace('horizon -> ioc','cap -> ioc'))),new RegExp(`not allowed for ${type}`));
    assert.match(errors(document('Cr',body.replace('horizon -> ioc','horizon -> increment'))),new RegExp(`not allowed for ${type}`));
    assert.equal(arch.validate(document('Cr',body+` relation shared horizon -> moc "also includes" {type ${type}}`)).valid,true,'no single-parent restriction is inferred');
    assert.equal(arch.getProfile('uaf').relationTypes[type],undefined,'application adapter does not modify UAF');
  }
  assert.equal(arch.validate(document('Cr')).valid,true,'minimal roadmap needs no phase grouping or triggers');
  assert.match(errors(without('Cr','delivers')),/DeliversCapability/);
});

test('Cr accepts implicit or hidden milestone properties, checks explicit milestones and validates milestone references',()=>{
  const noDefines=cases.Cr.replace(/relation defines [^}]*}/,'');
  assert.match(errors(document('Cr',noDefines)),/milestone requires.*DefinesIncrement/);
  assert.equal(arch.validate(document('Cr',noDefines,'include cap, increment')).valid,true,'milestone projection is optional');
  const asProperty=noDefines.replace('CapabilityIncrement increment "Initial capability"','CapabilityIncrement increment "Initial capability" {milestones [milestone]}');
  assert.equal(arch.validate(document('Cr',asProperty,'include cap, increment propertyFields [milestones]')).valid,true);
  assert.match(arch.renderToString(document('Cr',asProperty,'include cap, increment propertyFields [milestones]')),/milestones: \[milestone\]/);
  assert.match(errors(document('Cr',asProperty.replace('[milestone]','[cap]'),'include cap, increment')),/Reference type Capability.*not allowed/);
  assert.match(errors(document('Cr',asProperty.replace('[milestone]','[missing]'),'include cap, increment')),/unknown reference missing/);
  assert.match(errors(document('Cr',cases.Cr+' CapabilityMilestone orphan "Disconnected" {date "2030-01-01"}')),/orphan requires.*DefinesIncrement/);
});

test('CapabilityIncrement is a separate planning adapter without ActualEnterprisePhase inheritance; date compatibility remains explicit',()=>{
  const type=arch.getProfile('naf41-uaf').nodeTypes.CapabilityIncrement;
  assert.deepEqual(type.extends,['UAFElement']);
  const help=arch.help('connections naf41-uaf CapabilityIncrement');assert.doesNotMatch(help,/AchievedEffect:/);
  const dates=cases.Cr.replace('CapabilityIncrement increment "Initial capability"','CapabilityIncrement increment "Initial capability" {startDate "2029-01-01T00:00:00Z" endDate "2030-01-01T00:00:00Z"}');
  assert.equal(arch.validate(document('Cr',dates)).valid,true);
  assert.match(errors(document('Cr',dates.replace('2029-01-01T00:00:00Z','2031-01-01T00:00:00Z'))),/startDate|comparison/i);
  assert.match(errors(document('Cr',dates.replace('2029-01-01T00:00:00Z','invalid'))),/date-time/);
});

test('Cr relates capability increments to planning EnterprisePhase without changing AchievedEffect semantics',async()=>{
  const body=cases.Cr+' EnterprisePhase phase "Horizon 2030" relation relates increment -> phase "relates to" {type RelatesToEnterprisePhase}';
  const source=document('Cr',body),report=arch.validate(source);
  assert.equal(report.valid,true);assert.deepEqual(report.diagnostics,[]);
  assert.match(arch.renderToString(source),/Horizon 2030/);
  assert.equal(arch.validate(arch.translate(source)).valid,true);
  assert.match(errors(source.replace('increment -> phase','phase -> increment')),/not allowed for RelatesToEnterprisePhase/);
  assert.match(errors(source.replace('type RelatesToEnterprisePhase','type AchievedEffect')),/not allowed for AchievedEffect/);
  assert.match(errors(source.replace('EnterprisePhase phase','ActualEnterprisePhase phase')),/not allowed for RelatesToEnterprisePhase/);
  assert.match(arch.help('connections naf41-uaf CapabilityIncrement'),/RelatesToEnterprisePhase: CapabilityIncrement -> EnterprisePhase/);
  assert.match(arch.help('viewpoints naf41-uaf Cr'),/RelatesToEnterprisePhase/);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    for(const p of ['uaf','naf41-uaf'])context.arch.registerProfile(p,JSON.parse(await readFile(`profiles/${p}.json`,'utf8')));
    assert.equal(context.arch.validate(source).valid,true);
  }
});

test('C8 accepts p.101 Constraint as a StrategicConstraint subtype and p.100 constraint-to-rationale links',async()=>{
  const source=await readFile('examples/shared-paths.arch','utf8');
  assert.equal(arch.getProfile('uaf').nodeTypes.Constraint,undefined);
  for(const validation of ['strict','draft']) {
    const report=arch.validate(source,{validation});assert.equal(report.valid,true);assert.deepEqual(report.diagnostics,[]);
  }
  assert.deepEqual(arch.getProfile('naf41-uaf').nodeTypes.Constraint.extends,['StrategicConstraint']);
  assert.equal(arch.validate(source.replace('Constraint search','StrategicConstraint search').replace('missions"','missions" {ruleKind Constraint}')).valid,true);
  assert.equal(arch.validate(source.replace('Constraint search','Constraint search').replace('missions"','missions" {ruleKind Constraint}')).valid,true);
  assert.match(errors(source.replace('missions"','missions" {ruleKind Contract}')),/ruleKind/);
  assert.match(errors(source.replace(/relation searchApplies [^}]*}/,'')),/search requires.*ConstrainsCapability/);
  assert.match(errors(source.replace('search -> maritime','maritime -> search')),/not allowed for ConstrainsCapability/);
  const rationale=source.replace('Capability maritime','StrategicRationale rationale "Planning assumptions" relation origin search -> rationale "originates from" {type OriginatesFromRationale} Capability maritime');
  assert.equal(arch.validate(rationale).valid,true);
  assert.match(errors(rationale.replace('search -> rationale','rationale -> search')),/not allowed for OriginatesFromRationale/);
  assert.match(arch.help('types naf41-uaf Constraint'),/StrategicConstraint/);
  assert.match(arch.help('connections naf41-uaf Constraint'),/ConstrainsCapability|OriginatesFromRationale/);
  assert.equal(arch.validate(arch.translate(source)).valid,true);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    for(const p of ['uaf','naf41-uaf'])context.arch.registerProfile(p,JSON.parse(await readFile(`profiles/${p}.json`,'utf8')));
    assert.equal(context.arch.validate(source).valid,true);assert.equal(context.arch.layout(source).sharedPaths.length,2);
  }
});

test('C3 permits specialization/grouping context without a dependency on every capability, as in NAF p.93',async()=>{
  const source=await readFile('tests/fixtures/naf41/c3-specialization.arch','utf8');
  for(const validation of ['strict','draft']) {
    const report=arch.validate(source,{validation});assert.equal(report.valid,true);assert.deepEqual(report.diagnostics,[]);
    const g=arch.layout(source,{validation});assert.equal(g.kind,undefined);assert.equal(g.nodes.length,5);assert.equal(g.edges.length,4);assert.deepEqual(g.treeGroups[0].roots,['c_SAR']);
  }
  assert.equal(arch.validate(source.replace('Capability c_SAR "SAR"','Capability c_SAR "SAR" Capability context "Context only"')).valid,true);
  assert.match(errors(source.replace(/relation c3\.[23] [^}]*}/g,'')),/CapabilityDependency/);
  assert.match(errors(source.replace('c_maritimeSAR -> c_SAR "is kind of"','capabilityGroup_c2 -> c_SAR "is kind of"')),/not allowed for CapabilityGeneralization/);
  assert.match(arch.help('viewpoints naf41-uaf C3'),/Not every displayed capability/);
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    for(const p of ['uaf','naf41-uaf'])context.arch.registerProfile(p,JSON.parse(await readFile(`profiles/${p}.json`,'utf8')));
    assert.equal(context.arch.validate(source).valid,true);
  }
});

test('NAFv4.1 sources are pinned, including the CP1252 ADMBw reference and documented semantic differences', async () => {
  for (const source of coverage.sources) assert.equal(createHash('sha256').update(await readFile(source.file)).digest('hex'), source.sha256);
  assert.equal(coverage.admbwReference.domainStereotypes, 318);
  assert.equal(coverage.admbwReference.declaredFoundation, 'NAF 4.0');
  assert.deepEqual(coverage.admbwReference.comparisons.find(c => c.name === 'Evaluates').endpoints, [
    { role: 'client', types: ['FulfilmentCriterion'] }, { role: 'supplier', types: ['FitCriterion'] },
  ]);
  assert.equal(coverage.counts.viewpoints, 47);
  assert.match(arch.help('profiles naf41-uaf'), /not a claim|No certification/);
  assert.match(arch.help('viewpoints naf41-uaf C7'), /printed page 98/);
});

test('all 47 NAFv4.1 viewpoints accept independently authored scenarios and render valid SVG', () => {
  const expected = 'C1 C2 C3 C4 C5 C7 C8 Cr S1 S2 S3 S4 S5 S6 S7 S8 Sr C1-S1 L1 L2 L2-L3 L3 L4 L5 L6 L7 L8 Lr P1 P2 P3 P4 L4-P4 P5 P6 P7 P8 Pr A1 A2 A3 A4 A5 A6 A7 A8 Ar'.split(' ').sort();
  assert.deepEqual(Object.keys(cases).sort(), expected);
  assert.deepEqual(Object.keys(arch.getProfile('naf41-uaf').viewpoints).sort(), expected);
  for (const id of expected) {
    assert.equal(arch.validate(document(id)).valid, true, `${id}: ${errors(document(id))}`);
    const svg = arch.renderToString(document(id));
    const doc = new DOMParser({ onError: (level, msg) => { throw new Error(`${id}: ${level}: ${msg}`); } }).parseFromString(svg, 'image/svg+xml');
    assert.equal(doc.documentElement.localName, 'svg');
    assert.equal(arch.validate(document(id, '')).valid, id === 'L2-L3', `${id}: mandatory content; concept view intentionally permits no formal content`);
  }
});

test('C7 requires the complete capability-criterion-measure chain for ordinary assessment criteria', () => {
  for (const link of ['characterizes','evaluates']) assert.equal(arch.validate(without('C7',link)).valid, false, link);
  const orphan = document('C7', cases.C7 + ' AssessmentCriterion orphan "Unused criterion" { expression "Must be allocated" }');
  assert.match(errors(orphan), /orphan requires.*CharacterizesCapability/);
  assert.match(errors(document('C7', 'Capability c "C" Measurement m "Disconnected measurement"')), /AssessmentCriterion|Measure/);
  const reversed = document('C7', cases.C7.replace('measure -> criterion', 'criterion -> measure'));
  assert.equal(arch.validate(reversed).valid, false);
  assert.match(errors(document('C7',cases.C7,'include cap, criterion')), /Measure|EvaluatesCriterion/);
});

test('C7 accepts optional effectiveness criteria as on p.99 without weakening mandatory assessment/measure links',async()=>{
  const source=await readFile('tests/fixtures/naf41/c7-effectiveness.arch','utf8');
  for(const validation of ['strict','draft']) {
    const report=arch.validate(source,{validation});assert.equal(report.valid,true);assert.deepEqual(report.diagnostics,[]);
    const graph=arch.layout(source,{validation});assert.equal(graph.kind,undefined);assert.equal(graph.nodes.length,8);assert.equal(graph.edges.length,7);
  }
  for(const view of ['','diagram class'])assert.match(arch.renderToString(source.replace('viewpoint C7',`viewpoint C7 ${view}`)),/Time to find/);
  assert.equal(arch.validate(arch.translate(source)).valid,true);
  const derived=source.replace('config { profile naf41-uaf }','config {extends naf41-uaf type SearchEffectiveness {extends EffectivenessCriterion}}').replace('EffectivenessCriterion timeToFind','SearchEffectiveness timeToFind');
  assert.equal(arch.validate(derived).valid,true,'exemption includes subtypes');
  const plainDerived=source.replace('config { profile naf41-uaf }','config {extends naf41-uaf type SearchAssessment {extends AssessmentCriterion}}').replace('EffectivenessCriterion timeToFind','SearchAssessment timeToFind');
  assert.match(errors(plainDerived),/timeToFind requires.*CharacterizesCapability/);
  for(const [id,pattern]of [['seaCharacterizes',/seaState requires.*CharacterizesCapability/],['seaEvaluates',/seaState requires.*EvaluatesCriterion/]])assert.match(errors(source.replace(new RegExp(`relation ${id} [^}]*}`),'')),pattern);
  assert.match(errors(source.replace('seaStateValue -> seaState "evaluates"','seaState -> seaStateValue "evaluates"')),/not allowed for EvaluatesCriterion/);
  assert.match(arch.help('viewpoints naf41-uaf C7'),/nodesExclude|EffectivenessCriterion/);
  const optional=source.replace('relation specifies', 'Measure searchTime "Search time" {unit "minutes" value 20} relation timeEvaluates searchTime -> timeToFind "evaluates" {type EvaluatesCriterion} relation timeCharacterizes timeToFind -> maritime "characterizes" {type CharacterizesCapability} relation specifies');
  assert.equal(arch.validate(optional).valid,true,'optional links remain legal');
  for(const file of ['arch.js','arch.min.js']) {
    const context=vm.createContext({});vm.runInContext(await readFile(file,'utf8'),context);
    for(const p of ['uaf','naf41-uaf'])context.arch.registerProfile(p,JSON.parse(await readFile(`profiles/${p}.json`,'utf8')));
    assert.equal(context.arch.validate(source).valid,true);assert.deepEqual(Array.from(context.arch.validate(source).diagnostics),[]);
  }
});

test('NAF C2 Goal maps to EnterpriseGoal and all three goals satisfy the inherited viewpoint and relationship rules',()=>{
  const profile=arch.getProfile('naf41-uaf');assert.deepEqual(profile.nodeTypes.Goal.extends,['EnterpriseGoal']);
  assert.equal(profile.nodeTypes.Goal.abstract,false);assert.equal(arch.getProfile('uaf').nodeTypes.Goal,undefined);
  const body=cases.C2.replace('EnterpriseGoal goal "Save lives"','Goal goal "Increase Coverage" {benefits ["Coverage"]}')+
    ' Goal response "Improve Response Times" Goal manpower "Reduce Manpower"'+
    ' relation responseGoal vision -> response "Specifies" {type SpecifiesGoal} relation manpowerGoal vision -> manpower "Specifies" {type SpecifiesGoal}';
  const source=document('C2',body);assert.equal(arch.validate(source).valid,true,errors(source));
  const svg=arch.renderToString(source);for(const title of ['Increase Coverage','Improve Response Times','Reduce Manpower'])assert.ok(svg.includes(title));
  assert.match(errors(document('C2',body.replace('relation manpowerGoal vision -> manpower "Specifies" {type SpecifiesGoal}',''))),/manpower requires.*SpecifiesGoal/);
  assert.match(errors(document('C2',body.replace('vision -> response','response -> vision'))),/not allowed for SpecifiesGoal/);
  assert.match(errors(document('C2',body.replace('["Coverage"]','[1]'))),/expected string/);
  assert.match(arch.help('types naf41-uaf Goal'),/EnterpriseGoal/);assert.match(arch.help('connections naf41-uaf Goal'),/SpecifiesGoal/);
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'same'}),arch.renderToString(source,{idPrefix:'same'}));
});

test('the user C1 taxonomy accepts out-of-view Goals and generated profile scripts work with both library bundles',async()=>{
  const source=await readFile('tests/fixtures/naf41/goal-taxonomy.arch','utf8');
  assert.equal(arch.validate(source).valid,true,errors(source));
  assert.equal(arch.validate(source,{validation:'strict'}).valid,true);
  const model=arch.parse(source),graph=arch.layout(model);assert.equal(model.nodes.filter(n=>n.type==='Goal').length,3);assert.equal(graph.nodes.length,6);assert.equal(graph.edges.length,5);
  const expected=arch.renderToString(source,{idPrefix:'same'});
  for(const bundle of ['arch.js','arch.min.js'])for(const scripts of [['profiles/uaf.js','profiles/naf41-uaf.js'],['profiles/profiles.js']]) {
    const context=vm.createContext({});vm.runInContext(await readFile(bundle,'utf8'),context);
    for(const script of scripts)vm.runInContext(await readFile(script,'utf8'),context);
    assert.equal(context.arch.renderToString(source,{idPrefix:'same'}),expected);
  }
});

test('C2 cut-out supports all three desires targets, and the page 91 phase-to-vision tree needs no direct capability link',async()=>{
  const source=await readFile('examples/naf41-enterprise-vision.arch','utf8');
  assert.equal(arch.validate(source).valid,true,errors(source));
  assert.ok(!source.includes('type DesiresCapability'));
  const graph=arch.layout(source,{view:'tree'}),byId=new Map(graph.nodes.map(n=>[n.id,n]));
  assert.deepEqual(graph.tree.roots,['horizon']);assert.equal(graph.nodes.length,6);assert.equal(graph.edges.length,5);
  assert.equal(byId.get('vision').treeParent,'horizon');assert.equal(byId.get('coverage').treeParent,'vision');
  assert.equal(byId.get('maritime').treeParent,'vision');assert.equal(byId.get('response').treeDepth,2);
  assert.match(errors(source.replace('type DesiresVision','type CapabilityGeneralization')),/source of type EnterprisePhase is not allowed/);
  // Validate legacy direct-capability semantics independently of tree-only options.
  assert.equal(arch.validate(document('C2',cases.C2)).valid,true);
  const goalBody=cases.C2.replace('phase -> cap "DesiresCapability" { type DesiresCapability }','phase -> goal "DesiresGoal" { type DesiresGoal }');
  assert.equal(arch.validate(document('C2',goalBody)).valid,true,errors(document('C2',goalBody)));
  assert.match(errors(source.replace('relation desires horizon -> vision "desires" { type DesiresVision }','').replace('route desires { from top to bottom }','')),/horizon requires.*DesiresCapability, DesiresVision, DesiresGoal/);
  assert.match(errors(source.replace('horizon -> vision','vision -> horizon')),/not allowed for DesiresVision/);
  assert.match(errors(source.replace('horizon -> vision','horizon -> coverage')),/not allowed for DesiresVision/);
  assert.match(arch.help('connections naf41-uaf EnterprisePhase'),/DesiresVision/);
  assert.match(arch.help('connections naf41-uaf Goal'),/DesiresGoal/);
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'same'}),arch.renderToString(source,{idPrefix:'same'}));
});

test('required allocations and roadmaps cannot pass with disconnected look-alike content', () => {
  for (const [id, link] of [['C2','goalLink'],['C3','depends'],['C4','supports'],['C5','desires'],['C8','constraintLink'],['Cr','delivers'],['S2','depends'],['S3','specifies'],['S4','performs'],['S8','groups'],['Sr','fulfils'],['L1','groupsActivity'],['L4','allocation2'],['L8','constrains'],['Lr','defines'],['P2','groupsActive'],['P3','implements2'],['P4','uses'],['L4-P4','implements'],['P8','relates'],['Pr','delivers'],['A2','frames'],['A3','governs'],['A4','extends'],['A5','statusLink'],['A6','succession'],['Ar','defines']])
    assert.equal(arch.validate(without(id,link)).valid, false, `${id}/${link}`);
});

test('needlines and designated structural references must have correctly typed visible targets', () => {
  assert.match(errors(document('L2', cases.L2.replace('source centre','source missing'))), /unknown reference missing/);
  assert.match(errors(document('L2', cases.L2.replace('OperationalArchitecture centre','ServiceSpecification centre'))), /Reference type ServiceSpecification/);
  assert.match(errors(document('L2',cases.L2,'include centre, need')), /need.target references team.*must be visible/);
  assert.match(errors(document('L3',cases.L3,'include performer, centre')), /conveyed references information.*must be visible/);
  assert.match(errors(document('S7',cases.S7,'include parameter, fn')), /resource references report.*must be visible/);
  assert.match(errors(document('S7','ServiceParameter parameter "Untyped"')), /ServiceInterfaceParameter/);
  assert.match(errors(document('S7',cases.S7.replace('owner fn', 'owner report'))), /Reference type PhysicalMaterial/);
});

test('state, sequence and foundation adapters retain typed ownership, values and acyclic versions', () => {
  for (const id of ['S5','L5','P5']) assert.equal(arch.validate(without(id,'transition')).valid, false, id);
  for (const id of ['S6','L6','P6']) assert.match(errors(document(id,cases[id].replace('order 1','order 0'))), /order/);
  assert.match(errors(document('S5',cases.S5.replace('owner service','owner active'))), /Reference type ServiceState/);
  assert.match(errors(document('A6',cases.A6 + ' relation back next -> first "Cycle" { type ArchitectureVersionSuccession }')), /Cycles/);
  assert.match(errors(document('Cr',cases.Cr.replace('2027-01-01','2027-02-30'))), /date/);
  assert.match(errors(document('A1','GlossaryTerm term "SAR"')), /Missing required attribute definition/);
  assert.match(errors(document('A7','Measure m "Response time"')), /Missing required attribute unit/);
});

test('new profile remains separate, has helpful abstract-type candidates and rejects unknown viewpoints', () => {
  assert.equal(arch.getProfile('uaf').nodeTypes.Measure, undefined);
  assert.match(errors(document('L1',cases.L1.replace('OperationalPerformer performer','OperationalAgent performer'))), /Abstract node type.*OperationalAgent/);
  assert.match(arch.help('types naf41-uaf OperationalAgent'), /OperationalArchitecture|OperationalPerformer/);
  assert.match(arch.help('connections naf41-uaf OperationalPerformer'), /LogicalInteraction|FulfilsLogicalReadiness/);
  assert.match(errors(document('C1').replace('viewpoint C1','viewpoint C6')), /Unknown viewpoint/);
});

test('the editable NAFv4.1 example validates as one model across its nine views', async () => {
  const source = await readFile('examples/naf41.arch', 'utf8');
  assert.equal(arch.validate(source).valid, true, errors(source));
  const model = arch.parse(source);
  assert.equal(model.views.length, 9);
  for (const view of model.views) assert.match(arch.renderToString(model, { view: view.id }), /<svg/);
  for (const bundle of ['arch.js','arch.min.js']) for (const scripts of [['profiles/uaf.js','profiles/naf41-uaf.js'],['profiles/profiles.js']]) {
    const context = vm.createContext({});
    vm.runInContext(await readFile(bundle,'utf8'),context);
    for (const script of scripts) vm.runInContext(await readFile(script,'utf8'),context);
    assert.equal(context.arch.validate(source).valid,true,`${bundle}/${scripts.join(',')}`);
    const svg = context.arch.renderToString(source,{view:'structure'});
    assert.ok(svg.includes('source: commandNode'));
    assert.ok(svg.includes('target: rescueNode'));
  }
});
