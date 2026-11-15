// Dependency ordering is generic: no knowledge of particular framework IDs.
export function orderProfiles(definitions, available = ['default']) {
  const known = new Set(available), pending = new Map(), result = [];
  for (const definition of definitions) {
    if (!definition || typeof definition.id !== 'string') throw new Error('Every profile file requires an id');
    if (pending.has(definition.id) || known.has(definition.id)) throw new Error(`Duplicate profile ID: ${definition.id}`);
    pending.set(definition.id, definition);
  }
  while (pending.size) {
    const ready = [...pending.values()].filter(definition => !definition.extends || known.has(definition.extends));
    if (!ready.length) throw new Error(`Missing or cyclic profile dependencies: ${[...pending.keys()].join(', ')}`);
    for (const definition of ready) { pending.delete(definition.id); known.add(definition.id); result.push(definition); }
  }
  return result;
}
