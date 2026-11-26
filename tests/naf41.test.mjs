import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import vm from 'node:vm';
import * as arch from '../src/arch.studio.js';
import { cases, document } from './fixtures/naf41/cases.mjs';
for (const file of ['uaf.json', ...Array.from({length:10},(_,i)=>`naf41/revisions/4.1.0-arch.${33+i}.json`), 'naf41-uaf.json']) {
  const definition = JSON.parse(await readFile(`profiles/${file}`, 'utf8'));
  arch.registerProfile(definition.id, definition);
}
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
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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
  const review=arch.validate(source.replace('viewpoint S3','viewpoint S7'));assert.equal(review.valid,true);assert.equal(review.reviewRequired,true);assert.ok(review.diagnostics.some(d=>d.elementId==='resource'&&d.code==='ARCH_MAPPING_REVIEW'));
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
  const review=arch.validate(document('S7',body.replace(' resource product','')));assert.equal(review.valid,true);assert.equal(review.reviewRequired,true);
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
  assert.equal(model.nodes.find(n=>n.id==='airTraffic').type,'System');
  assert.equal(graph.nodes.find(n=>n.id==='airTraffic').stereotype,'Physical Active Resource');
  assert.equal(model.nodes.filter(n=>n.type==='Service').length,5);
  assert.deepEqual(model.edges.map(e=>[e.type,e.source,e.target]),[
    ['ConsumesService','controller','situation'],['ServiceDependency','situation','position'],['ServiceDependency','situation','documents'],
    ['SpecifiesServiceInterface','position','getArea'],['EnablesService','getAreaOfInterest','position'],
    ['ServiceAggregation','documents','platform'],['ServiceAggregation','documents','storage'],['RealizesService','airTraffic','situation']
  ]);
  const expected=arch.renderToString(source,{idPrefix:'s2'});
  assert.equal(arch.renderToString(arch.translate(source),{idPrefix:'s2'}),expected);
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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
  assert.equal(physical.abstract,true);assert.equal(physical.aliasOf,'ResourcePerformer');
  assert.equal(arch.getProfile('naf41-uaf').nodeTypes.PhysicalPassiveResource.abstract,true);
  assert.equal(physical.attributes.isStandardConfiguration.required,true);
  assert.equal(arch.getProfile('uaf').nodeTypes.PhysicalActiveResource,undefined);
  assert.equal(arch.getProfile('uaf').nodeTypes.ResourcePerformer.abstract,true);
  assert.match(errors(source.replace('System airTraffic','Node airTraffic').replace('isStandardConfiguration false','')),/not allowed for RealizesService/);
});

test('physical resource abstract aliases offer concrete candidates and preserve the pinned S2 revision',async()=>{
  const source=await readFile('examples/naf41-service-structure.arch','utf8');
  const old=source.replace('System airTraffic','PhysicalActiveResource airTraffic');
  const diagnostics=arch.validate(old).diagnostics;
  assert.match(diagnostics[0].message,/Abstract node type cannot be instantiated: PhysicalActiveResource/);
  assert.ok(diagnostics[0].candidates.includes('System'));
  assert.ok(diagnostics[0].candidates.includes('EquipmentType'));
  assert.match(arch.help('types naf41-uaf PhysicalActiveResource'),/System ID "Title"/);
  assert.match(arch.help('types naf41-uaf PhysicalActiveResource'),/EquipmentType ID "Title"/);
  const pinned=old.replace('profile naf41-uaf','profile "naf41-uaf@4.1.0-arch.33"');
  assert.deepEqual(arch.validate(pinned).diagnostics,[]);
  for(const scripts of [['profiles/uaf.js','profiles/naf41-uaf.js'],['profiles/profiles.js']]) {
    const context=vm.createContext({});
    for(const file of ['arch.core.min.js',...scripts]) vm.runInContext(await readFile(file,'utf8'),context);
    assert.deepEqual([...context.arch.getProfileVersions('naf41-uaf')],Array.from({length:11},(_,i)=>`4.1.0-arch.${33+i}`));
    assert.equal(context.arch.getProfile('naf41-uaf').version,'4.1.0-arch.43');
    assert.equal(context.arch.validate(pinned).valid,true);
    assert.equal(context.arch.validate(old).valid,false);
    assert.equal(context.arch.validate(source).valid,true);
  }
});

test('NAF A1 accepts ArchitectureDescription as the UAF ArchitecturalDescription type', async () => {
  const source = await readFile('examples/naf41-foundation-viewpoints.arch', 'utf8');
  const model = arch.parse(source);
  assert.equal(model.nodes.find(node => node.id === 'description').type, 'ArchitectureDescription');
  assert.equal(model.profile.nodeTypes.ArchitectureDescription.aliasOf, 'ArchitecturalDescription');
  assert.deepEqual(arch.validate(source).diagnostics, []);
  assert.match(arch.renderToString(model, {view:'a1'}), /data-field="type"><title>ArchitectureDescription<\/title>/);
  assert.match(arch.help('types naf41-uaf ArchitectureDescription'), /ArchitecturalDescription/);
  assert.equal(JSON.parse(arch.translate(source,{format:'json'})).architecture.model.elements.description.type, 'ArchitectureDescription');
  const canonical = source.replace('    ArchitectureDescription description', '    ArchitecturalDescription description');
  assert.deepEqual(arch.validate(canonical).diagnostics, []);
  const historical = source.replace('profile naf41-uaf', 'profile "naf41-uaf@4.1.0-arch.34"');
  assert.match(errors(historical), /Unknown element type .* ArchitectureDescription/);
  assert.equal(Object.hasOwn(arch.getProfile('uaf').nodeTypes,'ArchitectureDescription'), false);
});

test('NAF A1 allows both Metadata and its ArchitectureMetadata subtype to characterize the description', async () => {
  const source = await readFile('examples/naf41-foundation-viewpoints.arch', 'utf8');
  for (const type of ['Metadata','ArchitectureMetadata']) {
    const input = source.replace('    Metadata metadata', `    ${type} metadata`);
    assert.deepEqual(arch.validate(input).diagnostics, []);
    assert.match(arch.renderToString(input, {view:'a1'}), new RegExp(`data-field="type"><title>${type}</title>`));
  }
  const historical = source.replace('profile naf41-uaf', 'profile "naf41-uaf@4.1.0-arch.35"');
  assert.match(errors(historical), /source of type Metadata is not allowed for CharacterizesArchitectureDescription/);
  const reversed = source.replace('metadata -> description', 'description -> metadata');
  assert.match(errors(reversed), /source of type ArchitectureDescription is not allowed for CharacterizesArchitectureDescription/);
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
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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

test('L6 renders the p.140 timeline links separately from messages and validates one resource per lifeline',async()=>{
  const source=await readFile('examples/naf41-logical-sequence.arch','utf8');
  const options={validation:'strict',idPrefix:'l6'};
  assert.deepEqual(arch.validate(source,options).diagnostics,[]);
  const svg=arch.renderToString(source,options);
  assert.equal(arch.renderToString(arch.translate(source),options),svg);
  assert.deepEqual([...svg.matchAll(/data-edge="([^"]+)" data-message="(\d+)"/g)].map(m=>m.slice(1)),[
    ['request','1'],['control','2'],['vesselStatus','3'],['controllerStatus','4']
  ]);
  for(const [id,x] of [['searchTimeline',170],['controllerTimeline',490],['vesselTimeline',810]])
    assert.match(svg,new RegExp(`class="arch-sequence-context-edge" data-edge="${id}" data-type="RepresentsLogicalResource"><path d="M${x} 195 V115"[^>]+marker-end`));
  const noContext=arch.renderToString(source.replace('showContext true','showContext false'),options);
  assert.doesNotMatch(noContext,/data-edge="searchTimeline"/);
  assert.match(noContext,/data-edge="request" data-message="1"/);
  const missing=source.replace(/relation searchTimeline[^\n]+/,'');
  const searchLine='LogicalLifeline searchLine "Search Lifeline"';
  const compact=`${searchLine} { represents search }`;
  assert.match(errors(missing),/searchLine requires 1–1 outgoing connections.*RepresentsLogicalResource.*found 0/);
  assert.deepEqual(arch.validate(missing.replace(searchLine,compact),options).diagnostics,[]);
  assert.deepEqual(arch.validate(source.replace(searchLine,compact),options).diagnostics,[]);
  assert.match(errors(source.replace(searchLine,`${searchLine} { represents controller }`)),
    /searchLine requires 1–1 outgoing connections.*found 2/);
  assert.match(errors(source.replace('searchLine -> search "represents','search -> searchLine "represents')),
    /source of type Node is not allowed for RepresentsLogicalResource/);
  assert.match(errors(source.replace('viewpoint L6','viewpoint L6 exclude searchTimeline')),
    /searchLine requires 1–1 outgoing connections.*found 0/);
});

test('L7 accepts the p.142 InformationEntity vocabulary and the p.141 cut-out connections',async()=>{
  const source=await readFile('examples/naf41-information-model.arch','utf8');
  const options={validation:'strict',idPrefix:'l7'};
  assert.deepEqual(arch.validate(source,options).diagnostics,[]);
  const example=arch.layout(source,options);
  assert.equal(example.nodes.filter(node=>node.type==='InformationEntity').length,3);
  assert.deepEqual(example.edges.map(({type,source,target})=>[type,source,target]),[
    ['RepresentsInformationProduct','reportTemplate','report'],
    ['SpecifiesInformation','reportTemplate','terrain'],
    ['SpecifiesInformation','reportTemplate','tracks'],
    ['SpecifiesInformation','reportTemplate','reportingUnit'],
  ]);
  assert.equal(arch.renderToString(source,options),arch.renderToString(arch.translate(source),options));
  assert.deepEqual(arch.getProfile('naf41-uaf').nodeTypes.InformationEntity.extends,['InformationElement']);
  assert.equal(arch.getProfile('uaf').nodeTypes.InformationEntity,undefined);

  const cutout=source.replace('relation represents',`InformationAttribute scale "Scale"
    InformationAttributeType decimal "Decimal"
    relation aggregates terrain -> scale "aggregates" { type AggregatesInformationAttribute }
    relation hasType scale -> decimal "has" { type HasInformationAttributeType }
    relation represents`)
    .replace('place report at (0, 0)','place report at (0, 0) place scale at (0, 420) place decimal at (0, 630)');
  assert.deepEqual(arch.validate(cutout,options).diagnostics,[]);
  assert.match(arch.renderToString(cutout,options),/data-edge="hasType"/);
  assert.deepEqual(arch.validate(cutout.replace('viewpoint L7','viewpoint L7 exclude decimal'),options).diagnostics,[]);
  const compact=cutout.replace('InformationAttribute scale "Scale"','InformationAttribute scale "Scale" { owner terrain attributeType decimal }')
    .replace(/relation (?:aggregates|hasType)[^\n]+/g,'');
  assert.deepEqual(arch.validate(compact,options).diagnostics,[]);
  assert.deepEqual(arch.validate(compact.replace('viewpoint L7','viewpoint L7 exclude decimal'),options).diagnostics,[]);
  assert.match(errors(cutout.replace(/relation aggregates[^\n]+/,'')),/scale requires 1–1 incoming connections.*AggregatesInformationAttribute/);
  assert.match(errors(cutout.replace('scale -> decimal "has"','decimal -> scale "has"')),/not allowed for HasInformationAttributeType/);
  const reversed=source.replace('reportTemplate -> report "represents"','report -> reportTemplate "represents"');
  assert.match(errors(reversed),/not allowed for RepresentsInformationProduct/);
  assert.match(errors(reversed.replace('type RepresentsInformationProduct','type RepresentsInformationModel')),
    /Unknown relationship type in profile naf41-uaf: RepresentsInformationModel/);
});

test('L8 accepts the p.144 logical constraints and direct requirement application',async()=>{
  const source=await readFile('examples/naf41-logical-constraints.arch','utf8');
  const options={validation:'strict',idPrefix:'l8'};
  assert.deepEqual(arch.validate(source,options).diagnostics,[]);
  const graph=arch.layout(source,options);
  assert.equal(graph.nodes.filter(node=>node.type==='LogicalConstraint').length,4);
  assert.equal(graph.edges.length,7);
  assert.deepEqual(graph.edges.filter(edge=>edge.source==='access').map(({target,type})=>[target,type]),
    [['search','ConstrainsLogical']]);
  assert.equal(arch.renderToString(arch.translate(source),options),arch.renderToString(source,options));
  assert.match(errors(source.replace('viewpoint L8','viewpoint L8 exclude requiresAccess')),
    /access requires 1–∞ outgoing connections \(LogicalRequirementConstraint, ConstrainsLogical\)/);
  assert.match(errors(source.replace('LogicalConstraint scalable "Must be Scalable"',
    'LogicalConstraint scalable "Must be Scalable" { ruleKind Guidance }')),/Value must be one of "Constraint"/);
  assert.match(errors(source.replace('LogicalConstraint scalable','OperationalConstraint scalable')),/Missing required attribute ruleKind/);
});

test('L8 cut-out admits subject categories, requirement links, grouping and the directed origins chain',()=>{
  const source=document('L8',`
    Node node "Node"
    OperationalActivity activity "Activity"
    LogicalFunction logicalFunction "Logical Function"
    InformationProduct product "Product"
    LogicalRequirement requirement "Requirement"
    LogicalConstraint constraint "Constraint"
    LogicalSpecification specification "Specification"
    LogicalRationale rationale "Rationale"
    StrategicConstraint strategy "Strategic constraint" {ruleKind Constraint}
    relation relates requirement -> constraint "relates to" {type LogicalRequirementConstraint}
    relation groupRequirement specification -> requirement "aggregates" {type GroupsLogicalConstraint}
    relation groupConstraint specification -> constraint "aggregates" {type GroupsLogicalConstraint}
    relation origins constraint -> rationale "originates from" {type OriginatesFromLogicalRationale}
    relation strategySource rationale -> strategy "originates from" {type OriginatesFromStrategicConstraint}
    ${['node','activity','logicalFunction','product'].flatMap(target=>['requirement','constraint'].map(origin=>
      `relation ${origin}.${target} ${origin} -> ${target} "applies to" {type ConstrainsLogical}`)).join('\n')}
  `);
  assert.equal(errors(source),'');
  assert.match(arch.renderToString(source),/data-edge="strategySource"/);
  assert.match(errors(source.replace('constraint -> rationale "originates','rationale -> constraint "originates')),
    /not allowed for OriginatesFromLogicalRationale/);
  assert.match(errors(source.replace('rationale -> strategy "originates','strategy -> rationale "originates')),
    /not allowed for OriginatesFromStrategicConstraint/);
});

test('Lr models all seven p.146 links in the NAF direction and accepts the legacy inverse',async()=>{
  const source=await readFile('examples/naf41-logical-roadmap.arch','utf8');
  const options={validation:'strict',idPrefix:'lr'};
  assert.deepEqual(arch.validate(source,options).diagnostics,[]);
  const graph=arch.layout(source,options);
  const endpoints=type=>graph.edges.filter(edge=>edge.type===type).map(({source,target})=>[source,target]);
  assert.deepEqual(endpoints('LogicalReadinessFulfilsResource'),[['wbrLow','waterborneRescue'],['wbrHigh','waterborneRescue']]);
  assert.deepEqual(endpoints('DefinesLogicalReadiness'),[
    ['maintenance','wbrLow'],['maintenance','wbrHigh'],['personnel','wbrLow'],['personnel','wbrHigh'],['software','wbrHigh'],
  ]);
  assert.ok(graph.sharedPaths.some(path=>path.edgeIds.join(',')==='lowFulfils,highFulfils'));
  assert.equal(arch.renderToString(source,options),arch.renderToString(arch.translate(source),options));
  const reverse=source.replace('wbrLow -> waterborneRescue','waterborneRescue -> wbrLow');
  assert.match(errors(reverse),/not allowed for LogicalReadinessFulfilsResource/);
  assert.deepEqual(arch.validate(reverse.replace('type LogicalReadinessFulfilsResource','type FulfilsLogicalReadiness'),options).diagnostics,[]);
  assert.match(errors(source.replace('viewpoint Lr','viewpoint Lr exclude lowFulfils')),
    /wbrLow requires.*LogicalReadinessFulfilsResource.*found 0/);
});

test('Lr timeline uses milestone dates and retains hidden context for strict viewpoint validation',async()=>{
  const source=await readFile('examples/naf41-logical-roadmap.arch','utf8');
  const style='style waterborneRescue, wbrLow, wbrHigh { display none }';
  const timeline=source.trimEnd().replace(/}$/,`view lr_timeline "Lr dates" {
    include waterborneRescue, wbrLow, wbrHigh, maintenance, personnel, software
    viewpoint Lr
    diagram timeline { startAttribute date endAttribute date }
    ${style}
  } }`);
  const options={view:'lr_timeline',validation:'strict',idPrefix:'lr-timeline'};
  assert.deepEqual(arch.validate(timeline,options).diagnostics,[]);
  const svg=arch.renderToString(timeline,options);
  assert.deepEqual([...svg.matchAll(/data-bar="([^"]+)"/g)].map(match=>match[1]),['maintenance','personnel','software']);
  assert.match(svg,/Trained Personnel: 2030-04-01/);
  assert.equal(arch.renderToString(arch.translate(timeline),options),svg);
  assert.match(errors(timeline.replace(style,'')),/waterborneRescue: Attribute date requires a valid ISO date/);
  assert.match(errors(timeline.replace('viewpoint Lr\n    diagram timeline','viewpoint Lr exclude waterborneRescue\n    diagram timeline')), /Missing required node type OperationalAgent/);
});

test('Lr cut-out supports project scheduling, resource evolution and increment traceability',()=>{
  const model=`${cases.Lr}
    LogicalProject project "Rescue project" { isStandardConfiguration false }
    CapabilityIncrement increment "Rescue increment"
    relation schedule project -> milestone "schedules" {type SchedulesLogical}
    relation evolution project -> performer "defines evolution of" {type DefinesLogicalEvolution}
    relation trace ready -> increment "relates to" {type TracesCapabilityIncrement}`;
  const source=document('Lr',model);
  assert.equal(errors(source),'');
  assert.match(arch.renderToString(source),/data-edge="evolution"/);
  assert.match(errors(source.replace('project -> performer "defines evolution','performer -> project "defines evolution')),
    /not allowed for DefinesLogicalEvolution/);
  assert.match(errors(source.replace('project -> performer "defines evolution','project -> milestone "defines evolution')),
    /not allowed for DefinesLogicalEvolution/);
});

test('P1 renders the p.149 equipment taxonomy with three external context links',async()=>{
  const source=await readFile('examples/naf41-resource-taxonomy.arch','utf8');
  const options={validation:'strict',idPrefix:'p1'};
  assert.deepEqual(arch.validate(source,options).diagnostics,[]);
  const graph=arch.layout(source,options);
  const nodes=new Map(graph.nodes.map(node=>[node.id,node]));
  const root=nodes.get('dsc');
  assert.equal(root.type,'EquipmentType');
  assert.equal(nodes.get('voice').type,'ResourceFunction');
  for(const id of ['vhf','mf','hf'])assert.ok(nodes.get(id).y>root.y,id);
  for(const id of ['squadron','device','voice'])assert.ok(nodes.get(id).y<root.y,id);
  assert.equal(graph.edges.length,6);
  assert.ok(graph.sharedPaths.some(path=>path.edgeIds.slice().sort().join(',')==='kindHf,kindMf,kindVhf'));
  for(const theme of ['light','dark']) {
    const renderOptions={...options,theme};
    assert.equal(arch.renderToString(source,renderOptions),arch.renderToString(arch.translate(source),renderOptions));
  }
  const profile=arch.getProfile('naf41-uaf');
  assert.deepEqual(profile.nodeTypes.EquipmentType.extends,['ResourceArtifact']);
  assert.equal(profile.nodeTypes.EquipmentType.attributes.isStandardConfiguration.required,true);
  assert.equal(profile.nodeTypes.ResourceFunction.aliasOf,'Function');
  assert.match(arch.help('connections naf41-uaf EquipmentType'),/UsesResourceFunction/);
});

test('P1 cut-out accepts physical grouping, use, passive dependencies and each distinct realization target',()=>{
  const nodes=`
    EquipmentType radio "Radio" {isStandardConfiguration false}
    EquipmentType vhf "VHF radio" {isStandardConfiguration false}
    CapabilityConfiguration config "Configuration" {isStandardConfiguration true}
    ResourceFunction voice "Transmit voice"
    Function encode "Encode signal"
    Capability communications "Communication"
    LogicalEquipment device "Device"
    LogicalFunction signal "Exchange signal"
    OperationalActivity coordinate "Coordinate"
    ServiceFunction relay "Relay"
    PhysicalMaterial power "Power supply"`;
  const links=`
    relation specialized vhf -> radio "is a kind of" {type ResourceGeneralization}
    relation groups config -> radio "aggregates" {type GroupsPhysicalResource}
    relation resourceParts radio -> vhf "aggregates" {type ResourceAggregation}
    relation functionParts voice -> encode "aggregates" {type ResourceFunctionAggregation}
    relation performs radio -> voice "performs" {type IsCapableToPerform}
    relation uses vhf -> encode "uses" {type UsesResourceFunction}
    relation depends radio -> power "depends on" {type PhysicalDependency}
    relation realizesCapability config -> communications "realizes" {type Exhibits}
    relation realizesEquipment radio -> device "realizes" {type Implements}
    relation realizesLogical voice -> signal "realizes" {type RealizesLogicalFunction}
    relation realizesOperational voice -> coordinate "realizes" {type Implements}
    relation realizesService voice -> relay "realizes" {type Implements}`;
  const source=document('P1',nodes+links);
  assert.equal(errors(source),'');
  assert.equal(errors(document('P1',nodes)),'','cut-out links are optional');
  assert.match(errors(document('P1','EquipmentType radio "Radio" {isStandardConfiguration false}')), /Missing required node type Function/);
  assert.match(errors(source.replace('radio -> vhf "aggregates"','radio -> voice "aggregates"')), /not allowed for ResourceAggregation/);
  assert.match(errors(source.replace('vhf -> encode "uses"','encode -> vhf "uses"')), /not allowed for UsesResourceFunction/);
  assert.match(errors(source.replace('voice -> signal "realizes"','voice -> coordinate "realizes"')), /not allowed for RealizesLogicalFunction/);
  assert.match(errors(document('P1',nodes+links+' relation cycle encode -> voice "aggregates" {type ResourceFunctionAggregation}')), /ResourceFunctionAggregation: Cycles are not allowed/);
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
  for(const file of ['arch.core.min.js', 'arch.min.js']) {
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
  for(const bundle of ['arch.core.min.js', 'arch.min.js'])for(const scripts of [['profiles/uaf.js','profiles/naf41-uaf.js'],['profiles/profiles.js']]) {
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

test('L4 p.135 validates and renders logical roles, allocations and control flows', async () => {
  const source = await readFile('examples/naf41-logical-activities.arch', 'utf8');
  assert.equal(arch.getProfile('naf41-uaf').nodeTypes.Role.aliasOf, 'OperationalRole');
  assert.deepEqual(arch.validate(source, {validation:'strict'}).diagnostics, []);
  assert.deepEqual(arch.validate(source.replace('Role controller', 'OperationalRole controller')).diagnostics, []);
  const graph = arch.layout(source);
  assert.equal(graph.nodes.length, 9);
  assert.equal(graph.edges.length, 10);
  assert.equal(graph.edges.filter(edge => edge.type === 'OperationalControlFlow').length, 4);
  assert.deepEqual(arch.validate(source.replace('type OperationalControlFlow', 'type LogicalControlFlow')).diagnostics, []);
  assert.deepEqual(graph.edges.filter(edge => edge.type === 'HoldsRole').map(edge => [edge.source, edge.target]), [['centre', 'controller']]);
  assert.deepEqual(graph.edges.filter(edge => edge.type === 'PerformsOperationalActivity').map(edge => [edge.source, edge.target]), [
    ['vessel', 'report'], ['centre', 'log'], ['centre', 'assess'], ['controller', 'deploy'], ['rescue', 'respond']
  ]);
  const svg = arch.renderToString(source, {idPrefix:'l4'});
  assert.match(svg, /data-node="controller" data-type="Role"/);
  assert.equal(arch.renderToString(arch.translate(source), {idPrefix:'l4'}), svg);
  assert.match(errors(source.replace('centre -> controller', 'controller -> centre')), /not allowed for HoldsRole/);
  assert.match(errors(source.replace('controller -> deploy', 'deploy -> controller')), /not allowed for PerformsOperationalActivity/);
  assert.match(arch.help('connections naf41-uaf Role'), /HoldsRole: .* -> Role/);
  assert.match(arch.help('connections naf41-uaf Role'), /PerformsOperationalActivity: Role -> OperationalActivity/);
});

test('L4 permits a role-focused view and checks visible allocations per activity', () => {
  const model = `Role controller "Controller"
    OperationalActivity first "First"
    OperationalActivity second "Second"
    relation firstAllocation controller -> first "performs" {type PerformsOperationalActivity}
    relation secondAllocation controller -> second "performs" {type PerformsOperationalActivity}
    relation flow first -> second "control flow" {type LogicalControlFlow}`;
  assert.deepEqual(arch.validate(document('L4', model)).diagnostics, []);
  assert.match(errors(document('L4', model, 'exclude secondAllocation')), /second requires.*incoming connections.*PerformsOperationalActivity/);
  assert.match(errors(document('L4', model, 'exclude flow')), /first requires.*either connections.*OperationalControlFlow, LogicalControlFlow/);
});

test('L5 p.138 renders four ownership edges and all three triggers on their state transitions', async () => {
  const source = await readFile('examples/naf41-logical-states.arch','utf8');
  assert.deepEqual(arch.validate(source,{validation:'strict'}).diagnostics,[]);
  const graph = arch.layout(source);
  assert.equal(graph.edges.filter(edge=>edge.type==='HasLogicalState').length,4);
  assert.equal(graph.edges.filter(edge=>edge.type==='LogicalStateTransition').length,5);
  assert.deepEqual(graph.referenceNodes.map(ref=>[ref.nodeId,ref.edgeId,ref.connectorLabelText]),[
    ['searchStart','receive','triggers'],['searchExit','noAssistance','triggers'],['searchExit','secure','triggers'],
  ]);
  for (const ref of graph.referenceNodes) {
    const end = ref.points.at(-1);
    assert.deepEqual([end.x,end.y],[ref.anchor.x,ref.anchor.y]);
  }
  const secure=graph.edges.find(edge=>edge.id==='secure');
  const [from,to]=secure.points, length=Math.hypot(to.x-from.x,to.y-from.y);
  const midpointY=(from.y+to.y)/2;
  assert.ok(secure.label.y<midpointY);
  const clear=arch.layout(source.replace('route searchExit -> secure { from top to 2/5 }',
    'route searchExit -> secure { from top to 1/5 }')).edges.find(edge=>edge.id==='secure');
  assert.deepEqual(clear.label,{x:(from.x+to.x)/2,y:midpointY});
  const shifted=arch.layout(source.replace('route secure { from left to right curve straight }',
    'route secure { from left to right curve straight sideOffset -24 }')).edges.find(edge=>edge.id==='secure');
  assert.equal(shifted.d,secure.d);
  assert.ok(Math.abs(shifted.label.x-secure.label.x+24*(to.y-from.y)/length)<1e-8);
  assert.ok(Math.abs(shifted.label.y-secure.label.y-24*(to.x-from.x)/length)<1e-8);
  for (const theme of ['light','dark']) {
    const options={theme,idPrefix:'l5'};
    const svg=arch.renderToString(source,options);
    assert.equal((svg.match(/class="arch-reference-connector"/g)??[]).length,3);
    assert.equal((svg.match(/data-node="searchExit"/g)??[]).length,1);
    assert.equal(arch.renderToString(arch.translate(source),options),svg);
  }
  assert.deepEqual(arch.validate(source.replace('LogicalState waiting "Waiting for Distress Signal"',
    'LogicalState waiting "Waiting for Distress Signal" { owner centre }')).diagnostics,[]);
  assert.match(errors(source.replace('LogicalState waiting "Waiting for Distress Signal"',
    'LogicalState waiting "Waiting for Distress Signal" { owner crew }')),/waiting requires 1–1 incoming connections.*HasLogicalState.*found 2/);
});

test('L5 state view projects four states and places compact triggers on distinct transitions', async () => {
  const source = await readFile('examples/naf41-logical-states.arch','utf8');
  const options = {view:'l5State',validation:'strict',idPrefix:'l5-state'};
  assert.deepEqual(arch.validate(source,options).diagnostics,[]);
  const graph=arch.layout(source,options);
  assert.deepEqual(graph.nodes.map(node=>node.id),['waiting','located','inNeed','rescued']);
  assert.equal(graph.edges.length,5);
  const svg=arch.renderToString(source,options);
  const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
  const edges=[...doc.getElementsByTagName('g')].filter(g=>g.hasAttribute('data-edge'));
  const rendered=id=>edges.find(group=>group.getAttribute('data-edge')===id);
  const path=id=>rendered(id).getElementsByTagName('path')[0].getAttribute('d').split(' ');
  for (const [id,event,title] of [['receive','Search Start','receive signal'],
    ['secure','Search Exit','crew secure'],['noAssistance','Search Exit','no assistance required']]) {
    const group=rendered(id), badge=[...group.getElementsByTagName('g')].find(item=>item.hasAttribute('data-state-event'));
    assert.equal(badge.getElementsByTagName('tspan')[0].textContent,event);
    assert.equal(badge.getAttribute('aria-label'),`Event: ${event}`);
    assert.equal(badge.nextSibling.getElementsByTagName('tspan')[0].textContent,title);
  }
  assert.equal(rendered('stable').getElementsByTagName('g').length,0);
  assert.notEqual(path('secure')[4],path('noAssistance')[4],'different vertical tracks');
  assert.notEqual(path('secure').at(-1),path('noAssistance').at(-1),'different destination ports');
  assert.equal(arch.renderToString(arch.translate(source),options),svg);
});

test('L5 cut-out covers objectified transitions, modes, nested groups and endpoint rules', async () => {
  const source = await readFile('examples/naf41-logical-states-cutout.arch','utf8');
  assert.deepEqual(arch.validate(source,{validation:'strict'}).diagnostics,[]);
  const graph=arch.layout(source);
  assert.equal(graph.edges.length,11);
  assert.deepEqual(graph.referenceNodes.map(ref=>[ref.nodeId,ref.edgeId,ref.connectorLabelText]),[['begin','receive','is equal to']]);
  const options={idPrefix:'l5-cutout'};
  assert.equal(arch.renderToString(arch.translate(source),options),arch.renderToString(source,options));
  assert.match(errors(source.replace('signal -> begin','signal -> locating')),/target of type LogicalState is not allowed for TriggersLogicalTransition/);
  assert.match(errors(source.replace('locating -> locate','assess -> locate')),/source of type OperationalActivity is not allowed for StateEnablesLogicalFunction/);
  const unbound = source.replace('transition begin','').replace(/^    route begin -> receive.*\n/m,'');
  assert.match(errors(unbound),/begin: Requires a selected LogicalStateTransition relationship/);
  const add = relation => source.replace('relation receive',`${relation}\n    relation receive`);
  assert.match(errors(add('relation duplicate locating -> waiting "again" { type LogicalStateTransition transition begin }')),
    /begin: Object must bind exactly one LogicalStateTransition relationship; found 2/);
  assert.match(errors(add('relation cycle active -> lifecycle "aggregates" { type AggregatesLogicalStateGroup }')),
    /AggregatesLogicalStateGroup: Cycles are not allowed/);
  const compact = source.replace('LogicalMode assessment "Assessment mode"','LogicalMode assessment "Assessment mode" { activity assess }')
    .replace(/^    relation assessMode.*\n/m,'');
  assert.deepEqual(arch.validate(compact).diagnostics,[]);
  assert.deepEqual(arch.validate(document('L5',cases.L5)).diagnostics,[]);
});

test('L4 swimlanes follow both NAF control-flow types in a lexically ordered model', async () => {
  const example = await readFile('examples/naf41-logical-activities.arch','utf8');
  const lane = {assess:'centre',deploy:'controller',log:'centre',report:'vessel',respond:'rescue'};
  const declarations = [...example.matchAll(/^    OperationalActivity (\w+) "([^"\n]+)"$/gm)];
  const activities = declarations.sort((a,b)=>a[1].localeCompare(b[1])).map(([,id,title])=>`    OperationalActivity ${id} "${title}" {tags ${lane[id]}}`);
  const input = example.split('  view l4 ')[0]
    .replace(/^    OperationalActivity [^\n]+(?:\n    OperationalActivity [^\n]+)*/m,activities.join('\n'))
    .replace('profile naf41-uaf','profile naf41-uaf validation draft')
    .replace('relation logToAssess log -> assess "Operational Control Flow" {type OperationalControlFlow}',
      'relation logToAssess log -> assess "Logical Control Flow" {type LogicalControlFlow}')+`  view swimlane "L4" {
      viewpoint L4
      exclude holds, performReport, performLog, performAssess, performDeploy, performRespond
      diagram activity { lanes [vessel,centre,controller,rescue] laneAttribute tags }
    }
  }`;
  const graph = arch.layout(input);
  const activitiesIn = graph => graph.nodes.filter(node=>node.type==='OperationalActivity');
  assert.deepEqual(activitiesIn(graph).map(n=>n.id),Object.keys(lane));
  const order = graph => activitiesIn(graph).sort((a,b)=>a.y-b.y).map(n=>n.id);
  assert.deepEqual(order(graph),['report','log','assess','deploy','respond']);
  assert.deepEqual(order(arch.layout(input.replace('laneAttribute tags','laneAttribute tags layout model'))),Object.keys(lane));
  assert.match(arch.renderToString(input),/data-edge="reportToLog"><path d="M 175 175 L 175 207.5 L 505 207.5 L 505 240"/);
});

test('NAF OperationalControlFlow preserves UAF action endpoints and rejects mixed endpoint representations', () => {
  const endpoints = `OperationalActivity activity "Activity"
    OperationalActivityAction first "First action" {behavior activity}
    OperationalActivityAction second "Second action" {behavior activity}`;
  const link = (from, to) => `${endpoints} relation flow ${from} -> ${to} "Control flow" {type OperationalControlFlow URI "urn:naf:flow"}`;
  assert.deepEqual(arch.validate(document('L2-L3', link('first', 'second'))).diagnostics, []);
  for (const [from, to] of [['activity', 'first'], ['first', 'activity']])
    assert.match(errors(document('L2-L3', link(from, to))), /Type combination .* not allowed for OperationalControlFlow/);
  assert.deepEqual(arch.getProfile('uaf').relationTypes.OperationalControlFlow.from, ['OperationalActivityAction']);
  assert.match(arch.help('connections naf41-uaf OperationalActivity'), /OperationalControlFlow: OperationalActivity -> OperationalActivity/);
});

test('L4 p.134 renders the complete cut-out with a routed flow object and separate payload link', async () => {
  const source = await readFile('examples/naf41-logical-activities-cutout.arch', 'utf8');
  assert.deepEqual(arch.validate(source, {validation:'strict'}).diagnostics, []);
  const full = arch.layout(source, {view:'full'});
  assert.equal(full.nodes.length, 10);
  assert.equal(full.edges.length, 13);
  const [attachment] = full.referenceNodes;
  assert.equal(full.referenceNodes.length, 1);
  assert.equal(attachment.edgeId, 'transfer');
  assert.equal(attachment.nodeId, 'handover');
  assert.equal(attachment.connectorLabelText, 'is equal to');
  assert.equal(attachment.route.to, 0.5);
  assert.equal(attachment.node, full.nodes.find(node => node.id === 'handover'));
  assert.ok(full.edges.some(edge => edge.type === 'ConveysLogicalResource' && edge.source === 'handover' && edge.target === 'report'));
  const compact = arch.layout(source, {view:'compact'});
  assert.ok(compact.edges.some(edge => edge.id === 'transfer'));
  assert.equal(compact.referenceNodes.length, 0);
  for (const theme of ['light', 'dark']) {
    const options = {view:'full', theme, idPrefix:'l4-cutout'};
    const svg = arch.renderToString(source, options);
    assert.match(svg, />is equal to</);
    assert.match(svg, />conveys</);
    assert.equal(arch.renderToString(arch.translate(source), options), svg);
  }
  assert.match(arch.help('connections naf41-uaf OperationalFlow'), /ConveysLogicalResource/);
  assert.match(errors(source.replace('assessed -> record', 'record -> assessed')), /not allowed for TriggersOperationalActivity/);
  assert.match(errors(source.replace('handle -> assessed', 'assessed -> handle')), /not allowed for TriggersLogicalEvent/);
});

test('L4 OperationalFlow validates binding and payload types while keeping flow and payload optional in the view', () => {
  const body = `${cases.L4}
    OperationalFlow handover "Handover"
    InformationProduct payload "Report"
    relation transfer assess -> dispatch "Operational Flow" {type OperationalFlow flow handover}
    relation conveys handover -> payload "conveys" {type ConveysLogicalResource}`;
  for (const view of ['', 'exclude payload', 'exclude handover, payload', 'style payload {display none}'])
    assert.deepEqual(arch.validate(document('L4', body, view)).diagnostics, [], view);
  assert.match(errors(document('L4', body, 'exclude transfer')), /handover: Requires a selected OperationalFlow relationship/);
  assert.match(errors(document('L4', body, 'exclude flow')), /assess requires.*OperationalControlFlow, LogicalControlFlow/);
  assert.match(errors(document('L4', body.replace('flow handover', 'flow payload'))), /Reference type InformationProduct is not allowed/);
  assert.match(errors(document('L4', body.replace('InformationProduct payload', 'Capability payload'))), /not allowed for ConveysLogicalResource/);
  const duplicate = `${body} relation returnFlow dispatch -> assess "Return" {type OperationalFlow flow handover}`;
  assert.match(errors(document('L4', duplicate)), /Object must bind exactly one OperationalFlow relationship; found 2/);
  const legacy = `${cases.L4} InformationProduct payload "Report"
    relation compact assess -> dispatch "Operational Flow" {type LogicalObjectFlow conveyed [payload]}`;
  assert.deepEqual(arch.validate(document('L4', legacy)).diagnostics, []);
});

test('required allocations and roadmaps cannot pass with disconnected look-alike content', () => {
  for (const [id, link] of [['C2','goalLink'],['C3','depends'],['C4','supports'],['C5','desires'],['C8','constraintLink'],['Cr','delivers'],['S2','depends'],['S3','specifies'],['S4','performs'],['S8','groups'],['Sr','fulfils'],['L1','groupsActivity'],['L4','allocation2'],['L8','constrains'],['Lr','defines'],['P2','groupsActive'],['P3','implements2'],['P4','control'],['L4-P4','implements'],['P8','relates'],['Pr','delivers'],['A2','frames'],['A3','governs'],['A4','extends'],['A5','statusLink'],['A6','succession'],['Ar','defines']])
    assert.equal(arch.validate(without(id,link)).valid, false, `${id}/${link}`);
});

test('needlines and designated structural references must have correctly typed visible targets', () => {
  assert.match(errors(document('L2', cases.L2.replace('source centre','source missing'))), /unknown reference missing/);
  assert.match(errors(document('L2', cases.L2.replace('OperationalArchitecture centre','ServiceSpecification centre'))), /Reference type ServiceSpecification/);
  assert.match(errors(document('L2',cases.L2,'include centre, need')), /need.target references team.*must be visible/);
  assert.match(errors(document('L3',cases.L3,'include performer, centre')), /conveyed references information.*must be visible/);
  assert.match(errors(document('S7',cases.S7,'include parameter, fn')), /Required mapping is hidden.*report/);
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
  for (const bundle of ['arch.core.min.js', 'arch.min.js']) for (const scripts of [['profiles/uaf.js','profiles/naf41-uaf.js'],['profiles/profiles.js']]) {
    const context = vm.createContext({});
    vm.runInContext(await readFile(bundle,'utf8'),context);
    for (const script of scripts) vm.runInContext(await readFile(script,'utf8'),context);
    assert.equal(context.arch.validate(source).valid,true,`${bundle}/${scripts.join(',')}`);
    const svg = context.arch.renderToString(source,{view:'structure'});
    assert.ok(svg.includes('source: commandNode'));
    assert.ok(svg.includes('target: rescueNode'));
  }
});

test('chapter 3 grid and help cover the same 47 viewpoint identifiers', async () => {
  const {viewpoints,viewpointGrid}=arch.getProfile('naf41-uaf');
  assert.deepEqual(viewpointGrid.cells.map(cell=>cell.id).sort(),Object.keys(viewpoints).sort());
  for (const id of Object.keys(viewpoints)) {
    const help=arch.help(`viewpoints naf41-uaf ${id}`);
    for (const text of ['Required model contents','Representation','NAF formats:','arch.js:','Profile definition (JSON)']) assert.ok(help.includes(text),id+' '+text);
  }
});

test('reference scenarios render every new physical and foundation view in both themes and preserve source round trips',async()=>{
  for(const name of ['naf41-resource-viewpoints','naf41-foundation-viewpoints','naf41-interactions-cutout']) {
    const source=await readFile(`examples/${name}.arch`,'utf8');
    assert.deepEqual(arch.validate(source).diagnostics,[],name);
    const model=arch.parse(source), translated=arch.translate(source);
    for(const {id} of model.views) for(const theme of ['light','dark']) {
      const options={view:id,theme,idPrefix:'naf41-coverage'};
      const svg=arch.renderToString(source,options);
      assert.equal(arch.renderToString(translated,options),svg,id);
      assert.ok(!/NaN|Infinity|undefined/.test(svg),id);
      const xml = new DOMParser().parseFromString(svg,'image/svg+xml');
      assert.equal(xml.documentElement.localName,'svg',id);
      if(id==='a2') assert.equal([...xml.getElementsByTagName('g')].filter(cell=>cell.hasAttribute('data-naf-cell')).length,47);
      if(id==='p5') assert.match(svg,/Extraction Point Arrival/);
      if(id==='p6'||id==='l6') assert.match(svg,/is equal to/);
    }
  }
});

test('A2 grid distinguishes scoped products from declared diagrams, including ordinary Viewpoint titles', async () => {
  const example=await readFile('examples/naf41-foundation-viewpoints.arch','utf8');
  const source=example.replace('profile naf41-uaf views all','profile naf41-uaf views a2')
    .replace('NafViewpoint logical "Logical Structure" { nafViewpoint L2 }',`Viewpoint logical "L2 Logical Scenario" ${cases.L2}`)
    .replace('NafViewpoint resource "Resource Structure" { nafViewpoint P2 }','Viewpoint resource "P2 Resource Structure"')
    .replace(/}\s*$/, `view logicalDiagram "SAR Logical Scenario Diagram" {
      viewpoint L2 include centre,team,need represents logicalView
    }
    view logicalVariant "Alternate scenario" { extends logicalDiagram }
  }`);
  for (const version of ['naf41-uaf','naf41-uaf@4.1.0-arch.41']) {
    const input=source.replace('profile naf41-uaf',`profile "${version}"`);
    assert.deepEqual(arch.validate(input).diagnostics,[]);
    const svg=arch.renderToString(input);
    assert.match(svg,/data-naf-cell="L2" data-product-count="1" data-diagram-count="2"/);
    assert.match(svg,/data-naf-cell="P2" data-product-count="1" data-diagram-count="0"/);
    assert.match(svg,/data-naf-cell="A2" data-product-count="0" data-diagram-count="0"/);
    assert.doesNotMatch(svg,/data-node="logicalView"|data-view-link="logicalVariant"/);
    const detailed=arch.renderToString(input.replace('diagram nafgrid','diagram nafgrid { products list diagrams list }'));
    assert.match(detailed,/data-node="logicalView"/);
    assert.match(detailed,/data-view-link="logicalVariant"/);
  }
  const hidden=source.replace('diagram nafgrid','diagram nafgrid style logicalView {display none}');
  assert.match(arch.renderToString(hidden),/data-naf-cell="L2" data-product-count="0" data-diagram-count="2"/);
});

test('the default grid and named profile layouts support compact, detailed and hidden tile captions', () => {
  const source=`architecture "Example" {
    config { views grid, alpha }
    model {system a "A"}
    view grid "Summary" {include [alpha] diagram viewpointGrid}
    view alpha "Alpha diagram" {}
    view beta "Beta diagram" {}
  }`;
  const compact=arch.renderToString(source);
  assert.match(compact,/data-grid-tile="unassigned:diagrams" data-grid-state="selected"/);
  assert.match(compact,/Diagrams · 2/);
  assert.doesNotMatch(compact,/data-view-link=/);
  const layout={title:'Delivery grid',columns:['Stage'],
    rows:[{title:'Design',color:'#434',darkColor:'#aaa'},{title:'Delivery',color:'#434',darkColor:'#aaa'}],
    cells:[{id:'X1',row:0,col:0},{id:'X2',row:1,col:0,diagrams:'list'}]};
  const profile={nodeTypes:{system:{}},viewpoints:{X1:{},X2:{}},diagrams:{deliveryGrid:{renderer:'viewpointGrid',layout}}};
  const named=source.replace('viewpointGrid','deliveryGrid').replace('"Alpha diagram" {}','"Alpha diagram" {viewpoint X1}')
    .replace('"Beta diagram" {}','"Beta diagram" {viewpoint X2}');
  const svg=arch.renderToString(named,{profile});
  assert.match(svg,/Delivery grid/);
  assert.match(svg,/data-grid-tile="cell:X1" data-grid-state="selected"/);
  assert.match(svg,/data-grid-tile="cell:X2" data-grid-state="available"/);
  assert.doesNotMatch(svg,/data-view-link="alpha"/);
  assert.match(svg,/data-view-link="beta" data-grid-entry-state="available"/);
  const listed=arch.renderToString(named.replace('diagram deliveryGrid','diagram deliveryGrid {diagrams list}'),{profile});
  assert.match(listed,/data-view-link="alpha" data-grid-entry-state="selected"/);
  assert.doesNotMatch(arch.renderToString(named.replace('diagram deliveryGrid','diagram deliveryGrid {diagrams none}'),{profile,view:'grid'}),/Diagrams · 1/);
  assert.match(arch.help('diagrams deliveryGrid',{profile}),/products, diagrams, show/);
});

test('grid include selects diagrams independently of render order and supports an empty NAF selection', () => {
  const source=`architecture "Catalogue" {
    config {profile naf41-uaf views overview,alternate}
    model {${cases.L2} ${cases['L2-L3']}}
    view overview "Overview" {
      viewpoint A2
      include [primary]
      diagram nafgrid {show selected diagrams list}
    }
    view primary "Primary" {viewpoint L2 include centre, team, need}
    view alternate "Alternate" {extends primary}
    view concept "Rescue Concept" {viewpoint L2-L3 include concept}
    view cleared "Cleared" {extends overview include []}
  }`;
  assert.deepEqual(arch.validate(source,{validation:'strict'}).diagnostics,[]);
  const svg=arch.renderToString(source,{view:'overview'});
  assert.equal((svg.match(/data-naf-cell=/g)??[]).length,1);
  assert.match(svg,/data-grid-views="primary" data-selected-views="primary"/);
  assert.match(svg,/class="arch-grid-tile-frame"[^>]*fill="#6a5acd" fill-opacity="0\.2" stroke="#000000"/);
  assert.match(svg,/data-grid-state="selected"[^>]*--grid-ink:#000000/);
  const dark=arch.renderToString(source,{view:'overview',theme:'dark'});
  assert.match(dark,/class="arch-grid-tile-frame"[^>]*fill="#6a5acd" fill-opacity="0\.2" stroke="#ffffff"/);
  assert.match(dark,/data-grid-state="selected"[^>]*--grid-ink:#ffffff/);
  const all=arch.renderToString(source.replace('show selected','show all'),{view:'overview'});
  assert.match(all,/data-view-link="alternate" data-grid-entry-state="available"/);
  assert.match(all,/data-naf-cell="L2-L3"[^>]*data-diagram-count="1"/);
  assert.match(all,/class="arch-grid-tile-frame"[^>]*width="50"/);
  assert.match(all,/transform="rotate\(-90 [^"]+\)">L2-L3<\/text>/);
  assert.match(all,/data-view-link="concept" data-grid-entry-state="available"/);
  const hiddenCaptions = source.replace('show selected diagrams list','products none diagrams none');
  for (const [theme,gray] of [['light','#e3e6ec'],['dark','#2b313c']]) {
    const hidden = arch.renderToString(hiddenCaptions,{view:'overview',theme});
    const root = new DOMParser().parseFromString(hidden,'image/svg+xml').documentElement;
    const tiles = [...root.getElementsByTagName('g')].filter(group=>group.hasAttribute('data-naf-cell'));
    for (const id of ['L2','L2-L3','L1']) {
      const tile = tiles.find(group=>group.getAttribute('data-naf-cell')===id);
      const [frame,...layers] = tile.getElementsByTagName('rect');
      const overlay = layers.find(layer=>layer.getAttribute('class')==='arch-grid-tile-overlay');
      assert.equal(frame.getAttribute('fill'),'#6a5acd');
      assert.equal(frame.getAttribute('fill-opacity'),'0.2');
      assert.equal(overlay?.getAttribute('fill'),id==='L2' ? undefined : gray,`${id} in ${theme} mode`);
      if (overlay) {
        assert.equal(overlay.getAttribute('fill-opacity'),'0.9');
        assert.equal(overlay.parentNode,tile.lastChild,'the overlay follows the tile labels');
      }
    }
    const frameStroke = id => tiles.find(tile=>tile.getAttribute('data-naf-cell')===id)
      .getElementsByTagName('rect')[0].getAttribute('stroke');
    assert.equal(new Set(['C1','S1','L1','P1','A1'].map(frameStroke)).size,5);
    assert.doesNotMatch(hidden,/data-view-link=|>Diagrams · \d/);
  }
  const empty=arch.renderToString(source,{view:'cleared'});
  assert.match(empty,/No products or diagrams selected/);
  assert.doesNotMatch(empty,/data-naf-cell=/);
  const json=arch.translate(source);
  assert.deepEqual(arch.parse(json).views[0].include,['primary']);
  assert.deepEqual(arch.parse(json).views.find(view=>view.id==='cleared').include,[]);
  assert.equal(arch.validate(source.replace('[primary]','[unknown]')).valid,false);
  assert.equal(arch.validate(source.replace('[primary]','[cleared]')).valid,false);
  assert.equal(arch.validate(source.replace('view alternate "Alternate" {extends primary}','view alternate "Alternate" {viewpoint L2 include [primary]}')).valid,false);
});

test('modeled grids show declared diagrams at the required viewpoints', () => {
  const source = `architecture "Modeled grid" {
    config {profile naf41-uaf views overview}
    model {${cases.L2} ${cases['L2-L3']}}
    view overview "Overview" {
      viewpoint A2
      include []
      diagram nafgrid {show modeled viewpoints [L2, L7] diagrams list}
    }
    view structure "Rescue structure" {viewpoint L2 include centre, team, need}
    view detail "Rescue structure detail" {extends structure}
    view conceptDiagram "Rescue concept" {viewpoint L2-L3 include concept}
  }`;
  const options = {idPrefix:'modeled-grid'};
  const render = input => arch.renderToString(input,options);
  assert.deepEqual(arch.validate(source).diagnostics,[]);
  const filtered = render(source);
  assert.equal((filtered.match(/data-naf-cell=/g)??[]).length,1);
  assert.match(filtered,/data-naf-cell="L2" data-product-count="0" data-diagram-count="2"/);
  assert.match(filtered,/data-view-link="structure" data-grid-entry-state="available"/);
  assert.match(filtered,/data-view-link="detail" data-grid-entry-state="available"/);
  assert.doesNotMatch(filtered,/arch-grid-tile-overlay|data-view-link="conceptDiagram"/);
  assert.equal(render(source.replace('viewpoints [L2, L7]','viewpoints L2, L7')),filtered);
  assert.equal(render(arch.translate(source)),filtered);

  const modeled = render(source.replace('viewpoints [L2, L7] ',''));
  assert.equal((modeled.match(/data-naf-cell=/g)??[]).length,2);
  assert.match(modeled,/data-naf-cell="L2-L3"/);
  assert.match(modeled,/data-view-link="conceptDiagram"/);
  const highlighted = render(source.replace('include []','include [structure]'));
  assert.match(highlighted,/data-naf-cell="L2"[^>]*data-grid-state="selected"/);

  const all = render(source.replace('show modeled','show all'));
  assert.equal((all.match(/data-naf-cell=/g)??[]).length,2);
  assert.match(all,/data-naf-cell="L7"[^>]*data-grid-state="empty"/);
  const empty = render(source.replace('[L2, L7]','[P2]'));
  assert.match(empty,/No modeled diagrams match the grid viewpoints/);
  assert.doesNotMatch(empty,/data-naf-cell=/);
  assert.match(render(source.replace('[L2, L7]','[]')), /No modeled diagrams match the grid viewpoints/);
  assert.match(errors(source.replace('[L2, L7]','[L9]')), /L9 has no cell in this grid/);
  assert.match(errors(source.replace('[L2, L7]','[L2, l2]')), /unique viewpoint codes/);
});

test('NAF grid rows match their node cards and follow style-group overrides', () => {
  const samples = {C1:'cap',S1:'service',L2:'centre',P1:'resource',A1:'term'};
  const source = (viewpoint, profile='naf41-uaf') => `architecture "Colors" {
    config {profile ${profile}}
    model {${cases[viewpoint]}}
    view sample "View" {viewpoint ${viewpoint}}
    view grid "Grid" {viewpoint A2 include sample diagram nafgrid {show selected}}
  }`;
  function readPaint(input, view, theme, findShape) {
    const svg = arch.renderToString(input,{view,theme});
    const root = new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
    const shape = findShape(root);
    const rects = [...root.getElementsByTagName('rect')];
    const surface = view==='grid' ? rects.find(rect=>rect.getAttribute('rx')==='14') : rects[0];
    return [surface.getAttribute('fill'),
      ...['fill','fill-opacity','stroke'].map(name=>shape.getAttribute(name))];
  }
  const tile = root => [...root.getElementsByTagName('rect')].find(rect=>rect.getAttribute('class')==='arch-grid-tile-frame');
  const card = id => root => {
    const group = [...root.getElementsByTagName('g')].find(element=>element.getAttribute('data-node')===id);
    return [...group.getElementsByTagName('*')].find(element=>element.hasAttribute('fill-opacity') && element.hasAttribute('stroke'));
  };
  for (const [viewpoint,id] of Object.entries(samples)) {
    for (const theme of ['light','dark']) {
      const input = source(viewpoint);
      assert.deepEqual(readPaint(input,'grid',theme,tile),readPaint(input,'sample',theme,card(id)),`${viewpoint} ${theme}`);
    }
  }
  arch.registerProfile('naf-grid-palette-test',{extends:'naf41-uaf',styleGroups:{logical:{backgroundColor:'OrangeRed'}}});
  const custom = source('L2','naf-grid-palette-test');
  const paint = readPaint(custom,'grid','dark',tile);
  assert.equal(paint[1],'#ff4500');
  assert.deepEqual(paint,readPaint(custom,'sample','dark',card('centre')));
  const allRows = source('L2').replace('show selected','show all');
  for (const [theme,expected] of [['light','#253550'],['dark','#edf4ff']]) {
    const svg = arch.renderToString(allRows,{view:'grid',theme});
    const root = new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
    const labels = [...root.getElementsByTagName('text')].filter(text =>
      text.getAttribute('x')==='14' && text.getAttribute('font-size')==='13');
    assert.ok(labels.some(text=>text.textContent==='Logical'));
    assert.ok(labels.every(text=>text.getAttribute('fill')===expected),`${theme} row headers`);
  }
});

test('nafgrid activation and geometry come from the active profile', () => {
  const profile={nodeTypes:{Thing:{}},viewpoints:{Portfolio:{},X1:{}}};
  const source=`architecture "Example" {model {Thing a "A"}
    view grid "Grid" {viewpoint Portfolio diagram nafgrid}
    view diagram "Local view" {viewpoint X1}
  }`;
  assert.match(arch.validate(source,{profile}).diagnostics[0].message,/profile with a viewpointGrid definition/);
  profile.viewpointGrid={viewpoint:'Portfolio',title:'Custom grid',columns:['Work'],
    rows:[{title:'Topic',color:'#434',darkColor:'#aaa'}],cells:[{id:'X1',row:0,col:0}]};
  assert.match(arch.renderToString(source,{profile}),/data-naf-cell="X1" data-product-count="0" data-diagram-count="1"/);
  assert.match(arch.validate(source.replace('viewpoint Portfolio','viewpoint X1'),{profile}).diagnostics[0].message,/nafgrid requires viewpoint Portfolio/);
});

test('L3 accepts explicit conveyance and reports an incomplete bound flow without a selected payload',async()=>{
  const source=await readFile('examples/naf41-interactions-cutout.arch','utf8');
  assert.match(errors(source.replace(/relation detail[^}]*}/,'')), /exchange: Requires a visible payload.*ConveysLogicalResource/);
  assert.match(arch.renderToString(source,{view:'l3'}),/conveys/);
  assert.match(arch.renderToString(source,{view:'sankey'}),/data-edge="exchange"/);
});

test('A3 correspondence checks explicit and compact counterpart links',()=>{
  const missing=cases.A3.replace('source service target cap','source service');
  assert.match(errors(document('A3',missing)), /correspondence requires 2–∞ outgoing connections/);
  const duplicates=' relation relates correspondence -> service "" { type CorrespondenceRelatesElement } relation duplicate correspondence -> service "" { type CorrespondenceRelatesElement }';
  assert.match(errors(document('A3',missing+duplicates)), /correspondence requires 2–∞ outgoing connections/);
  assert.deepEqual(arch.validate(document('A3',missing+' relation relates correspondence -> cap "" { type CorrespondenceRelatesElement }')).diagnostics,[]);
});

test('A3 accepts generic description elements and complete descriptions as correspondence endpoints', async () => {
  const source = await readFile('examples/naf41-foundation-viewpoints.arch', 'utf8');
  const graph = arch.layout(source, {view:'a3'});
  assert.deepEqual(graph.nodes.filter(node => node.type === 'ArchitectureDescriptionElement').map(node => node.id),
    ['combatSAR', 'referenceArchitecture']);
  assert.deepEqual(graph.edges.filter(edge => edge.type === 'CorrespondenceRelatesElement').map(edge => [edge.source,edge.target]), [
    ['includesCombatSAR','description'], ['includesCombatSAR','combatSAR'],
    ['implementsReference','description'], ['implementsReference','referenceArchitecture'],
  ]);
  const withAggregation = source.replace('    relation inclusionElement',
    '    relation documentsCombatSAR description -> combatSAR "aggregates" { type DocumentsElement }\n    relation inclusionElement');
  assert.deepEqual(arch.validate(withAggregation).diagnostics, []);
  const older = source.replace('profile naf41-uaf', 'profile "naf41-uaf@4.1.0-arch.36"');
  assert.match(errors(older), /Unknown element type in profile naf41-uaf: ArchitectureDescriptionElement/);
  assert.equal(Object.hasOwn(arch.getProfile('uaf').nodeTypes,'ArchitectureDescriptionElement'), false);
});

test('A4 accepts the p.179 Methodology spelling and both links to standards', async () => {
  const source = await readFile('examples/naf41-foundation-viewpoints.arch', 'utf8');
  assert.equal(arch.getProfile('naf41-uaf').nodeTypes.Methodology.aliasOf, 'ArchitectureMethodology');
  assert.deepEqual(arch.validate(source).diagnostics, []);
  const {nodes, edges} = arch.layout(source, {view:'a4'});
  assert.deepEqual(nodes.filter(node => node.type === 'Methodology').map(node => node.id), ['missionThreads','nafMethodology']);
  assert.deepEqual(edges.map(({type,source,target}) => [type,source,target]), [
    ['UsesMethodology','project','missionThreads'],
    ['ExtendsMethodology','missionThreads','nafMethodology'],
    ['DocumentsArchitectureProject','description','project'],
    ['MethodologyExtendsStandard','nafMethodology','togaf'],
    ['MethodologyAppliesStandard','nafMethodology','nafInformationModel'],
  ]);
  assert.deepEqual(arch.validate(source.replaceAll(/^    Methodology /gm, '    ArchitectureMethodology ')).diagnostics, []);
  assert.match(errors(source.replace('nafMethodology -> togaf "extends"','togaf -> nafMethodology "extends"')),
    /source of type Standard is not allowed for MethodologyExtendsStandard/);
});

test('A5 p.181 attaches all six statuses to views and counts them for their work product', async () => {
  const source = await readFile('examples/naf41-foundation-viewpoints.arch','utf8');
  assert.deepEqual(arch.validate(source).diagnostics, []);
  const {edges} = arch.layout(source,{view:'a5'});
  assert.deepEqual(edges.filter(edge => edge.type === 'ArchitectureStatusDescribesProduct').map(edge => edge.target),
    ['deploymentView','deploymentView','deploymentView','resourceView','resourceView','resourceView']);
  const disconnected = source.replace('viewpoint A5','viewpoint A5\n    exclude containsDeployment, containsResource');
  assert.match(errors(disconnected), /a5: product requires .* connections/);
  const legacy = source.replace('profile naf41-uaf','profile "naf41-uaf@4.1.0-arch.38"');
  assert.match(errors(legacy), /target of type View is not allowed for ArchitectureStatusDescribesProduct/);
});

test('A5 does not borrow status from another work product through a shared view', () => {
  const source = document('A5', `
    ArchitectureWorkProduct tracked "Tracked product"
    ArchitectureWorkProduct untracked "Untracked product"
    ArchitectureDescription description "Tracked description" {toBe true architectureFramework "NAFv4.1"}
    View shared "Shared view"
    View trackedView "Tracked view"
    ArchitectureStatus status "Draft"
    relation specializes description -> tracked "is a kind of" {type ArchitectureDescriptionGeneralization}
    relation containsShared description -> shared "contains" {type ContainsView}
    relation containsTracked description -> trackedView "contains" {type ContainsView}
    relation alsoContains untracked -> shared "contains" {type WorkProductContainsView}
    relation describes status -> trackedView "describes" {type ArchitectureStatusDescribesProduct}
  `);
  assert.deepEqual(arch.validate(source).diagnostics.map(d => d.elementId), ['untracked']);
  assert.deepEqual(arch.validate(source.replace('status -> trackedView','status -> shared')).diagnostics, []);
});

test('A6 p.183 accepts architecture descriptions with direct and baseline-mediated version links', async () => {
  const source = await readFile('examples/naf41-foundation-viewpoints.arch','utf8');
  assert.deepEqual(arch.validate(source).diagnostics, []);
  const {nodes, edges} = arch.layout(source,{view:'a6'});
  assert.equal(nodes.filter(({type}) => type === 'ArchitectureDescription').length,3);
  assert.deepEqual(edges.map(({type,source,target}) => [type,source,target]),[
    ['ProductHasVersion','description','baseline2025'],
    ['ProductHasVersion','description2030Draft','version19'],
    ['ProductHasVersion','description2030','baseline2030'],
    ['ArchitectureVersionGeneralization','baseline2025','version18'],
    ['ArchitectureVersionGeneralization','baseline2030','version20'],
    ['ArchitectureVersionSupersedes','version19','version18'],
    ['ArchitectureVersionSupersedes','version20','version19'],
  ]);
  const disconnected = source.replace('viewpoint A6','viewpoint A6\n    exclude baseline2025Version');
  assert.match(errors(disconnected),/a6: version18 requires .* connections/);
  const reverse = source.replace('description2030Draft -> version19 "has" { type ProductHasVersion }',
    'version19 -> description2030Draft "version of" { type VersionOfProduct }');
  assert.deepEqual(arch.validate(reverse).diagnostics, []);
  const canonical = source.replaceAll(/^    ArchitectureDescription /gm,'    ArchitecturalDescription ');
  assert.deepEqual(arch.validate(canonical).diagnostics, []);
});

test('A8 p.188 accepts Profile and all four standards and constraint links', async () => {
  const source = await readFile('examples/naf41-foundation-viewpoints.arch','utf8');
  assert.deepEqual(arch.validate(source).diagnostics, []);
  const {nodes,edges} = arch.layout(source,{view:'a8'});
  assert.equal(nodes.find(node => node.id === 'guidebook').type, 'Profile');
  assert.equal(arch.getProfile('naf41-uaf').nodeTypes.Profile.aliasOf,'StandardProfile');
  assert.deepEqual(edges.map(({type,source,target})=>[type,source,target]),[
    ['GroupsStandard','spiralGroup','spiral6'],
    ['ReferencesStandard','guidebook','spiral6'],
    ['IncludesArchitecturalConstraint','guidebook','uploadConstraint'],
    ['IncludesArchitecturalConstraint','guidebook','unclasConstraint'],
  ]);
  assert.deepEqual(arch.validate(source.replace('Profile guidebook','StandardProfile guidebook')).diagnostics, []);
  assert.match(arch.help('types naf41-uaf Profile'), /StandardProfile/);
  assert.match(errors(source.replace('profile naf41-uaf','profile "naf41-uaf@4.1.0-arch.40"')),
    /Unknown element type in profile naf41-uaf: Profile/);
});
