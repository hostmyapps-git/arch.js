import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { compileProfile } from '../src/profiles.js';

const XMI = 'http://www.omg.org/spec/XMI/20131001';
const kind = element => element.getAttributeNS(XMI, 'type');
const children = (element, tag) => Array.from(element.childNodes).filter(node => node.nodeType === 1 && (!tag || node.tagName === tag));
const clone = value => JSON.parse(JSON.stringify(value));
const sha = data => createHash('sha256').update(data).digest('hex');

function presentation(name) {
  if (/Capability|Competence/.test(name)) return { template: 'capability', accent: '#8b5cf6' };
  if (/^(Actual)?(Person|Post|Organization|OperationalPerformer)/.test(name)) return { template: 'person', accent: '#4f46e5' };
  if (/Interface|Port/.test(name)) return { template: 'interface', accent: '#0891b2' };
  if (/Activity|Function|Process|Task/.test(name)) return { template: 'process', accent: '#0d9488' };
  if (/^(Actual)?Service|^ProvidedService|^RequiredService/.test(name)) return { template: 'service', accent: '#0d9488' };
  if (name === 'Software') return { template: 'application', accent: '#6366f1' };
  if (/System|Architecture|Configuration/.test(name)) return { template: 'system', accent: '#6366f1' };
  if (/Element|Model|Information|Standard|Protocol|Metadata|View|Definition|Measurement/.test(name)) return { template: 'artifact', accent: '#64748b' };
  return { template: 'node', accent: '#64748b' };
}

export async function buildUafProfiles() {
  const colors = JSON.parse(await readFile('profiles/uaf/presentation.json', 'utf8'));
  const lock = JSON.parse(await readFile('profiles/uaf/sources.lock.json', 'utf8'));
  for (const source of lock.sources) if (sha(await readFile(source.file)) !== source.sha256) throw new Error(`UAF source checksum mismatch: ${source.file}`);
  const xml = await readFile(lock.metamodel.file, 'utf8');
  const doc = new DOMParser({ onError: (level, message) => { throw new Error(`${level}: ${message}`); } }).parseFromString(xml, 'application/xml');
  const elements = Array.from(doc.getElementsByTagName('*'));
  const byId = new Map(elements.filter(e => e.hasAttributeNS(XMI, 'id')).map(e => [e.getAttributeNS(XMI, 'id'), e]));
  const stereotypes = elements.filter(e => kind(e) === 'uml:Stereotype');
  const stereotypeIds = new Set(stereotypes.map(e => e.getAttributeNS(XMI, 'id')));
  const nodeTypes = Object.create(null), attributes = [], constraints = [], normalizations = [];
  const assignments = [];
  for (const element of stereotypes) {
    const name = element.getAttribute('name'), rule = { ...presentation(name), abstract: element.getAttribute('isAbstract') === 'true' };
    const packages = [];
    for (let parent = element.parentNode; parent?.getAttribute; parent = parent.parentNode)
      if (kind(parent) === 'uml:Package') packages.unshift(parent.getAttribute('name'));
    rule.styleGroup = colors.types[name] ?? colors.packages[packages[0]];
    if (!rule.styleGroup) throw new Error(`Missing UAF presentation assignment: ${name}`);
    assignments.push({ name, package: packages.join('/'), styleGroup: rule.styleGroup });
    const parents = children(element, 'generalization').map(g => byId.get(g.getAttribute('general'))).filter(p => p && stereotypeIds.has(p.getAttributeNS(XMI, 'id'))).map(p => p.getAttribute('name'));
    if (parents.length) rule.extends = parents.length === 1 ? parents[0] : parents;
    rule.attributes = Object.create(null);
    for (const property of children(element, 'ownedAttribute')) {
      const originalName = property.getAttribute('name'), attribute = originalName.trim();
      if (attribute.startsWith('base_')) continue; // UML implementation bindings, not domain attributes.
      if (property.getAttribute('isDerived') === 'true') {
        attributes.push({ owner: name, attribute, sourceId: property.getAttributeNS(XMI, 'id'), status: 'derived-not-writable' }); continue;
      }
      if (attribute !== originalName) normalizations.push({ owner: name, originalName, name: attribute, reason: 'trim trailing whitespace in normative XML' });
      const target = byId.get(property.getAttribute('type'));
      const href = children(property, 'type')[0]?.getAttribute('href') ?? '';
      const lower = children(property, 'lowerValue')[0], upper = children(property, 'upperValue')[0];
      const min = lower ? Number(lower.getAttribute('value') || 0) : 1;
      const max = upper ? upper.getAttribute('value') || '0' : '1';
      const schema = { type: 'string', required: min > 0 };
      if (target && kind(target) === 'uml:Enumeration') schema.enum = children(target, 'ownedLiteral').map(literal => literal.getAttribute('name'));
      else if (target?.getAttribute('name') === 'ISO8601DateTime') schema.format = 'date-time';
      else if (target && stereotypeIds.has(property.getAttribute('type'))) { schema.type = 'reference'; schema.targets = [target.getAttribute('name')]; }
      else if (/_(Boolean)$/.test(href)) schema.type = 'boolean';
      else if (/_(Integer|UnlimitedNatural)$/.test(href)) schema.type = 'integer';
      else if (/_(Real)$/.test(href)) schema.type = 'number';
      else if (href && !/_String$/.test(href)) throw new Error(`Unsupported UAF datatype: ${name}.${attribute}: ${href}`);
      if (attribute === 'URI') schema.format = 'uri';
      if (max === '*' || Number(max) > 1) {
        schema.many = true; schema.minItems = min;
        if (max !== '*') schema.maxItems = Number(max);
        schema.uniqueItems = property.getAttribute('isUnique') !== 'false';
      }
      rule.attributes[attribute] = schema;
      attributes.push({ owner: name, attribute, sourceId: property.getAttributeNS(XMI, 'id'), status: 'enforced', schema });
    }
    if (name === 'ActualState') rule.comparisons = [{ left: 'startDate', op: '<=', right: 'endDate' }];
    if (name === 'Standard') rule.comparisons = [{ left: 'mandatedDate', op: '<=', right: 'retiredDate' }];
    nodeTypes[name] = rule;
    for (const constraint of children(element, 'ownedRule')) constraints.push({ owner: name, name: constraint.getAttribute('name'),
      sourceId: constraint.getAttributeNS(XMI, 'id'), body: children(children(constraint, 'specification')[0] ?? constraint, 'body')[0]?.textContent ?? '' });
  }
  const umlAdapters = JSON.parse(await readFile('profiles/uaf/uml-adapters.json', 'utf8'));
  for (const [type, fields] of Object.entries(umlAdapters)) {
    if (!nodeTypes[type]) throw new Error(`Unknown UAF adapter type ${type}`);
    Object.assign(nodeTypes[type].attributes, fields);
    for (const [attribute, schema] of Object.entries(fields)) {
      const suffix = {owner:'class',interfaceType:'type',classifier:'type',ends:'end'}[attribute] ?? attribute;
      const ids = attribute === 'conveyed' ? [] : constraints.filter(c => c.owner === type && c.name.endsWith(`.${suffix}`)).map(c => c.sourceId);
      attributes.push({ owner: type, attribute, schema, status: 'explicit-UML-adapter', sourceConstraintIds: ids });
    }
  }
  // Explicit tool-level adapter types; never presented as native UAF stereotypes.
  nodeTypes.Package = { template: 'package', contains: ['UAFElement', 'Requirement', 'Package'] };
  nodeTypes.Requirement = { extends: 'UAFElement', template: 'artifact', attributes: { text: { type: 'string' } } };
  for (const name of ['Package', 'Requirement']) nodeTypes[name].styleGroup = colors.types[name] ?? 'neutral';
  for (const name of Object.keys(colors.types)) if (!nodeTypes[name]) throw new Error(`Unknown UAF presentation type: ${name}`);
  const raw = { id: 'uaf', title: 'UAF 1.0 domain vocabulary', version: '1.0.0-arch.1', nodeTypes, relationTypes: {}, defaultRelation: null };
  raw.styleGroups = colors.styleGroups;
  const resolvedNodes = compileProfile(raw).nodeTypes;
  const relationTypes = Object.create(null), evidence = [], deferred = [];
  const special = JSON.parse(await readFile('profiles/uaf/relations.json', 'utf8'));
  for (const element of stereotypes) {
    const name = element.getAttribute('name'), rules = constraints.filter(c => c.owner === name);
    const clients = rules.filter(c => /\.(client|informationSource|source)$/.test(c.name));
    const suppliers = rules.filter(c => /\.(supplier|informationTarget|target)$/.test(c.name));
    const namesIn = texts => [...new Set(texts.flatMap(t => [...t.body.matchAll(/«([^»]+)»/g)].map(m => m[1])))];
    if (special[name]) {
      relationTypes[name] = { ...special[name].rule, attributes: clone(resolvedNodes[name].attributes) };
      evidence.push({ name, origin: 'UAF stereotype', sourceIds: [...clients, ...suppliers].map(c => c.sourceId), mode: 'authored-endpoint-pairs', note: special[name].note });
    } else if (clients.length && suppliers.length && ![...clients, ...suppliers].some(c => /In case|except for/.test(c.body))) {
      const from = namesIn(clients), to = namesIn(suppliers);
      if (from.length && to.length && [...from, ...to].every(type => nodeTypes[type])) {
        relationTypes[name] = { from, to, style: ['Exhibits','MapsToCapability'].includes(name) ? 'realization' : /Exchange|Control|Command|Flow/.test(name) ? 'flow' : 'dependency',
          attributes: clone(resolvedNodes[name].attributes) };
        evidence.push({ name, origin: 'UAF stereotype', sourceIds: [...clients, ...suppliers].map(c => c.sourceId), mode: 'literal-endpoint-constraints' });
      } else deferred.push({ name, reason: 'endpoint constraint references types outside this normative vocabulary', referencedTypes: [...from, ...to] });
    }
  }
  for (const [name, entry] of Object.entries(special)) if (!nodeTypes[name]) {
    relationTypes[name] = entry.rule; evidence.push({ name, origin: entry.origin, sourceIds: [], mode: 'explicit-adapter', note: entry.note });
  }
  for (const [name, rule] of Object.entries(relationTypes)) {
    const native = nodeTypes[name], parents = typeof native?.extends === 'string' ? [native.extends] : native?.extends ?? [];
    const edgeParents = parents.filter(parent => relationTypes[parent]);
    if (edgeParents.length) rule.extends = edgeParents.length === 1 ? edgeParents[0] : edgeParents;
  }
  raw.relationTypes = relationTypes;
  compileProfile(raw);
  await writeFile('profiles/uaf.json', JSON.stringify(raw, null, 2) + '\n');
  const definitions = JSON.parse(await readFile('profiles/uaf/naf-viewpoints.json', 'utf8'));
  const viewpoints = Object.fromEntries(definitions.map(({ id, rule }) => [id, { ...rule, nodes: [...new Set(['Package', ...(rule.nodes ?? [])])] }]));
  const naf = { id: 'naf4-uaf', title: 'NAFv4 using UAF 1.0 — structural viewpoints', version: '1.0.0-arch.1',
    extends: 'uaf', requireViewpoint: true, viewpoints };
  await writeFile('profiles/naf4-uaf.json', JSON.stringify(naf, null, 2) + '\n');
  const enforcedIds = new Set([...evidence.flatMap(item => item.sourceIds), ...attributes.flatMap(item => item.sourceConstraintIds ?? [])]);
  const coverage = { sources: lock, nativeStereotypes: stereotypes.length,
    nativeAbstractTypes: stereotypes.filter(e => e.getAttribute('isAbstract') === 'true').length,
    nodeTypes: Object.keys(nodeTypes).length, relationTypes: Object.keys(relationTypes).length,
    adapterTypes: ['Package', 'Requirement'], presentationAssignments: assignments, normalizations, attributes, relations: evidence,
    deferredEndpointMappings: deferred,
    unimplementedNativeConstraints: constraints.filter(c => !enforcedIds.has(c.sourceId)).map(({body, ...data}) => data),
    viewpoints: definitions.map(({ id, title, pages, representation }) => ({ id, title, pages, representation, status: 'declared-structural-rules' })),
    unsupportedGuidelineViewpoints: ['C5','Cr','S5','S6','S7','S8','Sr','L2','L5','L6','L7','L8','Lr','P5','P6','P7','P8','Pr','A1','A2','A3','A4','A5','A6','A7','Ar'],
    limits: ['No UML/SysML editor or lossless XMI import/export', 'No execution of English/OCL constraints',
      'Derived fields are not writable or calculated', 'Only declared binary endpoint constraints are enforced',
      'Specialist renderers need explicit view configuration; no complete UML/BPMN behavior semantics',
      'NAFv4 guideline March 2019; no claim of complete NAFv4.1, UAF 1.3 or tool certification'] };
  await writeFile('profiles/uaf/coverage.json', JSON.stringify(coverage, null, 2) + '\n');
  const countAttributes = status => attributes.filter(item => item.status === status).length;
  const coverageText = [
    '# UAF-/NAF-Abdeckungsnachweis', '',
    'Automatisch durch `npm run build` erzeugt. Quellen und Regeln stehen in',
    '[README.md](README.md); sämtliche Quell-IDs in [coverage.json](coverage.json).', '',
    '## Versionsbindung und Umfang', '',
    '- UAF 1.0; NATO-UAF-Leitlinie Version 1.0.0, März 2019.',
    `- ${coverage.nativeStereotypes} native Stereotypen, davon ${coverage.nativeAbstractTypes} abstrakt; ${coverage.nodeTypes} Knotentypen einschließlich der Adapter Package/Requirement.`,
    `- ${countAttributes('enforced')} native, schreibbare Attributdefinitionen mit Typ-/Multiplizitätsprüfung; ${countAttributes('explicit-UML-adapter')} explizite Adapterfelder.`,
    `- ${countAttributes('derived-not-writable')} abgeleitete Quellfelder werden weder geschrieben noch berechnet.`,
    `- ${coverage.relationTypes} binäre Beziehungsabbildungen; ${definitions.length} ausgewählte strukturelle Viewpoint-Regelsätze.`, '',
    'Der Typkatalog ist vollständig für die nativen Stereotypen dieser XMI-Datei.',
    'Die Validierung des gesamten UAF-/NAF-Metamodells ist es nicht. UML-/SysML-',
    'Basiseigenschaften werden nur durch die ausdrücklich deklarierten Adapter',
    'abgebildet. Quell-IDs an Beziehungen belegen ausschließlich die angegebenen',
    'binären Endpunktprüfungen; sie gelten nicht als vollständige Prüfung des',
    'jeweiligen reifizierten Beziehungsknotens oder sämtlicher UML-Eigenschaften.', '',
    '## Festgeschriebene Quellen', '',
    '| Lokale Quelle | Version | SHA-256 |', '| --- | --- | --- |',
    ...lock.sources.map(source => `| [${source.file}](../../${source.file}) | ${source.version} | \`${source.sha256}\` |`), '',
    'Die NAFv4.1-Datei dient nur zum Abgrenzen des neueren Stands. Sie ist keine',
    'Grundlage für die Behauptung einer vollständigen NAFv4.1-Validierung.', '',
    '## Binäre Beziehungsabbildungen', '',
    '| Relation | Herkunft | Prüfungsart |', '| --- | --- | --- |',
    ...evidence.map(item => `| ${item.name} | ${item.origin} | ${item.mode} |`), '',
    '`literal-endpoint-constraints` übernimmt einfache native Endpunktlisten.',
    '`authored-endpoint-pairs` bildet bedingte Typkombinationen explizit ab.',
    '`explicit-adapter` bezeichnet eine zusätzliche UML-/SysML-/DMM-Abbildung,',
    'keinen nativen UAFP-Stereotyp. Endpunktrichtung und Regeln stehen im JSON.', '',
    '## Unterstützte strukturelle Viewpoints', '',
    'Die Seitenzahlen beziehen sich auf die gedruckten Seiten der NATO-Leitlinie',
    'von 2019. Die Whitelists, Pflichttypen und Allokationsprüfungen sind eine',
    'deklarierte Teilabdeckung, keine vollständige Konformitätsprüfung pro View.', '',
    '| ID | Titel | Seiten | Darstellung / Grenze |', '| --- | --- | --- | --- |',
    ...definitions.map(item => `| ${item.id} | ${item.title} | ${item.pages.join(', ')} | ${item.representation} |`), '',
    '## Offene Quellregeln und Ausnahmen', '',
    ...deferred.map(item => `- **${item.name}:** keine binäre Abbildung; Quellregel verweist auf nicht vorhandene Typen (${item.referencedTypes.join(', ')}).`),
    `- **${coverage.unimplementedNativeConstraints.length} native ownedRule-Einträge** werden nicht als vollständig umgesetzt ausgewiesen. Ihre Namen und stabilen Quell-IDs stehen unter \`unimplementedNativeConstraints\` in coverage.json. Einzelaspekte können durch generische Attribut-/Datumsregeln geprüft sein; weitergehende Pfad-, Aggregations-, Eigentums- und Konsistenzregeln bleiben offen.`,
    '- Pflichtfelder folgen den nativen Multiplizitäten. Metamodell-Defaultwerte werden nicht automatisch eingesetzt.',
    '- Quellnormalisierung: Das Attribut `UAFElement.URI ` mit abschließendem Leerzeichen heißt im DSL `URI`.',
    '- Nicht enthaltene Viewpoint-Regelsätze: ' + coverage.unsupportedGuidelineViewpoints.map(id => `\`${id}\``).join(', ') + '.', '',
    'Die nativen Typen dieser offenen Bereiche können im Basisprofil `uaf`',
    'modelliert werden. Das allein belegt weder die Semantik noch die vollständige',
    'Validierung eines entsprechenden NAF-Viewpoints.', '',
    '## Weitere Grenzen', '', ...coverage.limits.map(limit => `- ${limit}.`), '',
    '## Verifikation', '',
    'Die Tests vergleichen den nativen Typkatalog direkt mit der XMI, prüfen',
    'Quellhashes, Vererbung, gültige/ungültige Endpunktpaare, Referenzen,',
    'Attributformate und jeden der 20 unterstützten Viewpoints mit einer eigenen',
    'positiven Architektur. Negative Tests prüfen insbesondere fehlende',
    'Allokationen und unzulässige Sichttypen. Das editierbare Beispiel enthält',
    'neun Ansichten und wird zusätzlich im Browser geprüft. Diese Tests sind',
    'keine externe Konformitätszertifizierung.', ''
  ].join('\n');
  await writeFile('profiles/uaf/COVERAGE.md', coverageText);
  console.log(`Built UAF: ${coverage.nativeStereotypes} native stereotypes, ${coverage.relationTypes} binary mappings, ${definitions.length} NAF viewpoints`);
  return { uaf: raw, naf, coverage };
}
