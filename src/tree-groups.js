import {ArchError} from './errors.js';
import {treeStructure,validateTreeOptions,TREE_OPTIONS} from './tree.js';

export function validateTreeGroups(profile,view,graph) {
  if(view.trees===undefined)return;
  const fail=message=>{throw new ArchError(`View ${view.id}: ${message}`,view.loc,'ARCH_VALIDATION');};
  if((view.diagram?.type??'connected')!=='connected')fail('Named tree groups require the connected renderer');
  if(!view.trees||typeof view.trees!=='object'||Array.isArray(view.trees)||Object.keys(view.trees).length>128)fail('Expected at most 128 named tree groups');
  const { nodesById: nodes, edgesById } = graph, members = new Set();
  const semantic = graph.project(view, false).ids, display = graph.project(view);
  for(const [id,tree]of Object.entries(view.trees)) {
    if(tree._embed) {if(view.places[id]?.size)fail(`Embedded view ${id} has automatic dimensions`);continue;}
    if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)||nodes.has(id)||edgesById.has(id))fail(`Invalid or conflicting tree group ID: ${id}`);
    if(!tree||typeof tree!=='object'||Array.isArray(tree))fail(`Tree ${id} requires an options object`);
    if(Object.keys(tree).some(k=>!['nodes','loc',...TREE_OPTIONS].includes(k)))fail(`Tree ${id} accepts nodes and tree layout options only`);
    validateTreeOptions(tree,profile,view);
    if(!Array.isArray(tree.nodes)||!tree.nodes.length||new Set(tree.nodes).size!==tree.nodes.length)fail(`Tree ${id} requires a nonempty list of unique nodes`);
    let parent;
    for(const nodeId of tree.nodes) {
      const node=nodes.get(nodeId);
      if(!node||!semantic.has(nodeId))fail(`Tree ${id}: unknown or excluded node ${nodeId}`);
      if(members.has(nodeId))fail(`Node ${nodeId} belongs to more than one tree group`);
      members.add(nodeId);
      if(profile.nodeTypes[node.type]?.container)fail(`Tree ${id}: containers cannot be members; group sibling non-container nodes`);
      if(parent===undefined)parent=node.parent??null;else if(parent!==(node.parent??null))fail(`Tree ${id}: members must share the same model container`);
      if(view.places[nodeId])fail(`Tree member ${nodeId} is positioned automatically; place ${id} or an external node instead`);
    }
    if(view.places[id]?.size)fail(`Tree group ${id} has automatic dimensions; place does not accept size`);
    const shown=new Set(tree.nodes.filter(n=>display.ids.has(n)));
    treeStructure(display.nodes.filter(n=>shown.has(n.id)), display.edges.filter(e=>shown.has(e.source)&&shown.has(e.target)), profile, {...view,diagram:tree});
  }
}
