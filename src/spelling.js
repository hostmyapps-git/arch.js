function distance(a, b, allowPrefix) {
  let row = Array.from({length: b.length + 1}, (_, index) => index);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) {
      next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])));
    }
    row = next;
  }
  // A close prefix is useful while typing a compound name. Prefer a
  // complete spelling match of the same edit distance.
  return allowPrefix ? Math.min(row[b.length], 0.5 + Math.min(...row)) : row[b.length];
}

const normalize = value => String(value).slice(0, 100).toLowerCase();

export function similarNames(value, names, limit, maxDistance = Infinity, {allowPrefix = false} = {}) {
  const query = normalize(value);
  return Array.from(new Set(names), name => ({name, distance: distance(query, normalize(name), allowPrefix)}))
    .filter(candidate => candidate.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(candidate => candidate.name);
}
