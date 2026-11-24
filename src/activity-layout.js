// Activity order comes from profile metadata. Keep the visible projection
// separate from the layout graph so context relationships can still be drawn.
export function flowActivityRows(tasks, edges, profile, lanes) {
  const index = new Map(tasks.map((task,i)=>[task.id,i]));
  const count = tasks.length;
  let outgoing, incoming;
  for (const edge of edges) {
    if (!profile.relationTypes[edge.type ?? profile.defaultRelation]?.activityFlow) continue;
    const from = index.get(edge.source), to = index.get(edge.target);
    if (from === undefined || to === undefined) continue;
    outgoing ??= Array.from({length:count},()=>[]);
    incoming ??= Array.from({length:count},()=>[]);
    outgoing[from].push(to);
    incoming[to].push(from);
  }
  if (!outgoing) return null;

  // Compute strongly connected components with two iterative DFS passes.
  // A negative stack entry records the finish of a node in the first pass.
  const visited = new Uint8Array(count), finished = [], stack = [];
  for (let i=0;i<count;i++) {
    if (visited[i] || !(outgoing[i].length || incoming[i].length)) continue;
    stack.push(i);
    while (stack.length) {
      const node = stack.pop();
      if (node < 0) { finished.push(~node); continue; }
      if (visited[node]) continue;
      visited[node] = 1;
      stack.push(~node);
      for (const next of outgoing[node]) if (!visited[next]) stack.push(next);
    }
  }

  const component = new Int32Array(count).fill(-1), groups = [];
  for (let i=finished.length-1;i>=0;i--) {
    const root = finished[i];
    if (component[root] !== -1) continue;
    const id = groups.length;
    groups.push({members:[],successors:[],incoming:0,rank:0});
    component[root] = id;
    stack.push(root);
    while (stack.length) {
      for (const previous of incoming[stack.pop()]) if (component[previous] === -1) {
        component[previous] = id;
        stack.push(previous);
      }
    }
  }

  // Condense loops into groups. Advance each successor past its latest
  // predecessor so joins stay downstream of all incoming branches.
  for (let i=0;i<count;i++) {
    if (component[i] === -1) continue;
    const group = groups[component[i]];
    group.members.push(i);
    for (const next of outgoing[i]) if (component[i] !== component[next]) {
      const successor = groups[component[next]];
      group.successors.push(successor);
      successor.incoming++;
    }
  }
  const ready = groups.filter(group=>group.incoming===0);
  for (let i=0;i<ready.length;i++) for (const next of ready[i].successors) {
    next.rank = Math.max(next.rank,ready[i].rank+1);
    if (--next.incoming === 0) ready.push(next);
  }

  const ranks = [], rows = new Int32Array(count);
  for (let i=0;i<count;i++) {
    const group = groups[component[i]];
    if (group?.members[0] === i) (ranks[group.rank] ??= []).push(group.members);
  }
  let rowCount = 0;
  for (const rank of ranks) {
    const nextRow = new Map();
    let height = 0;
    for (const members of rank) {
      // Independent branches can share a row across lanes. In one lane they
      // need distinct slots. A loop keeps its members together in model order.
      const occupied = new Set();
      let start = 0;
      for (const member of members) {
        const lane = lanes[member];
        occupied.add(lane);
        start = Math.max(start,nextRow.get(lane) ?? 0);
      }
      members.forEach((member,offset)=>{rows[member] = rowCount+start+offset;});
      const end = start+members.length;
      for (const lane of occupied) nextRow.set(lane,end);
      height = Math.max(height,end);
    }
    rowCount += height;
  }
  // Activities without a visible control-flow link keep their relative
  // declaration order after the flow, without delaying its initial steps.
  for (let i=0;i<count;i++) if (component[i] === -1) rows[i] = rowCount++;
  return {rows,rowCount};
}
