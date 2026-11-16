// Display metadata belongs to profiles; no framework-specific attribute names here.
export function relationshipReferences(edge, rule) {
  return Object.entries(rule.referenceLabels ?? {}).flatMap(([attribute, label]) =>
    [edge.attributes?.[attribute]].flat().filter(id => typeof id === 'string').map(id => ({ id, attribute, label })));
}

export function relationshipLabel(edge, rule, nodes, omit = new Set()) {
  const lines = edge.title ? [edge.title] : [];
  for (const [attribute, label] of Object.entries(rule.referenceLabels ?? {})) {
    const ids = [edge.attributes?.[attribute]].flat().filter(id => typeof id === 'string' && !omit.has(`${attribute}\0${id}`));
    if (ids.length) lines.push(`${label}: ${ids.map(id => `${nodes.get(id)?.title ?? id} [${id}]`).join(', ')}`);
  }
  return lines.join('\n');
}
