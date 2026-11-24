import { ArchError } from './errors.js';

export const topics = {
  syntax: ['Basic syntax and a complete starter example', 0],
  json: ['Equivalent JSON architecture documents and syntax mapping', 0],
  meta: ['Translate DSL/JSON and inspect source correction candidates', 0],
  model: ['Elements, containers, relationships and attributes', 0],
  profiles: ['Registered profiles and profile summaries', 1],
  aliases: ['Alternative names and their canonical types', 1],
  mappings: ['Documented metamodel correspondences (not conversions)', 1],
  types: ['Node types and inherited attribute rules', 2],
  relations: ['Relationship types, endpoints and rules', 2],
  connections: ['Allowed incoming/outgoing relationships for a node type', 2],
  viewpoints: ['Allowed and required contents for each viewpoint', 2],
  iconpacks: ['Registered packs, icon names and search', 3],
  diagrams: ['Diagram types and their options', 1],
  views: ['View selection, filters, direction and theme', 0],
  routing: ['Positions, ports, curves and custom paths', 0],
  styles: ['Templates, icons, colors and fill opacity', 0],
  colors: ['All CSS3 color names and their hex values', 1],
  templates: ['Node templates and edge styles', 0],
  config: ['View selection, profiles and custom inline profiles', 0],
  api: ['Public JavaScript API', 0],
};
const aliases = { icons: 'iconpacks', profile: 'profiles', nodes: 'types', edges: 'relations', diagram: 'diagrams', view: 'views', style: 'styles' };
const usage = {
  profiles: '@help profiles [PROFILE]', aliases: '@help aliases [PROFILE]', mappings: '@help mappings [PROFILE]', types: '@help types [PROFILE [TYPE]]',
  relations: '@help relations [PROFILE [RELATION]]', viewpoints: '@help viewpoints [PROFILE [VIEWPOINT]]',
  connections: '@help connections [PROFILE [TYPE]]',
  iconpacks: '@help iconpacks [PACK [FILTER [PAGE]]]', diagrams: '@help diagrams [TYPE]', colors: '@help colors [FILTER]',
};
const fail = message => { throw new ArchError(message, {}, 'ARCH_HELP'); };
export const syntax = topic => usage[topic] ?? `@help${topic ? ` ${topic}` : ''}`;
export const queryFor = (...parts) => parts.map(part => /[\s"#]/.test(part) ? JSON.stringify(part) : part).join(' ');

export function helpHref(query, base) {
  if (base) {
    try {
      const url = new URL(base);
      if (['https:', 'http:', 'file:'].includes(url.protocol)) {
        url.searchParams.set('help', query);
        return url.href;
      }
    } catch { /* Standalone SVGs can use a host-provided fragment handler. */ }
  }
  return '#arch-help=' + encodeURIComponent(query);
}

function tokens(source) {
  const values = [];
  let rest = source;
  while (rest.length) {
    const skip = rest.match(/^(?:\s+|#[^\n]*|\/\/[^\n]*)/);
    if (skip) { rest = rest.slice(skip[0].length); continue; }
    const token = rest.match(/^"(?:[^"\\]|\\.)*"|^[^\s"#]+/);
    if (!token) fail('Invalid help command. Use @help or @help TOPIC.');
    let value = token[0];
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { fail('Invalid string in help command.'); }
    }
    values.push(value); rest = rest.slice(token[0].length);
    if (values.length > 5) fail('Too many help parameters. Use @help to see valid commands.');
  }
  return values;
}

export function request(topic = '', parameters = []) {
  if (typeof topic !== 'string' || !Array.isArray(parameters) || parameters.some(p => typeof p !== 'string')) fail('Invalid help request.');
  topic = topic.toLowerCase(); topic = Object.hasOwn(aliases, topic) ? aliases[topic] : topic;
  if (topic && !Object.hasOwn(topics, topic)) fail(`Unknown help topic: ${topic}. Use @help. Topics: ${Object.keys(topics).join(', ')}.`);
  if (parameters.length > (topic ? topics[topic][1] : 0)) fail(`Usage: ${syntax(topic)}`);
  return { topic, parameters: [...parameters] };
}

export function parseHelpCommand(source) {
  if (source.length > 2_000_000) fail('Source exceeds 2 MB');
  const [command, topic, ...parameters] = tokens(source);
  if (command !== '@help') fail('Unknown command. Use @help.');
  return request(topic, parameters);
}

export function helpDocument(help) {
  return { kind: 'help', help, title: 'arch.js Help', description: 'Valid inputs and currently registered extensions.',
    nodes: [], edges: [], views: [{ id: 'help', title: syntax(help.topic), theme: 'light' }] };
}
