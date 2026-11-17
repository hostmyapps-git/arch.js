import {ArchError} from './errors.js';
import {visibleNodeIds} from './profiles.js';
import {treeStructure,validateTreeOptions,TREE_OPTIONS} from './tree.js';

export function validateTreeGroups(model,profile,view) {
  if(view.trees===undefined)return;
  const fail=message=>{throw new ArchError(`View ${view.id}: ${message}`,view.loc,'ARCH_VALIDATION');};
  if((view.diagram?.type??'connected')!=='connected')fail('Named tree groups require the connected renderer');
  if(!view.trees||typeof view.trees!=='object'||Array.isArray(view.trees)||Object.keys(view.trees).length>128)fail('Expected at most 128 named tree groups');
  const nodes=new Map(model.nodes.map(n=>[n.id,n])),allIds=new Set([...nodes.keys(),...model.edges.map(e=>e.id)]),members=new Set();
  const semantic=visibleNodeIds(model,view,false),display=visibleNodeIds(model,view);
  for(const [id,tree]of Object.entries(view.trees)) {
    if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)||allIds.has(id))fail(`Invalid or conflicting tree group ID: ${id}`);
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
    const shown=new Set(tree.nodes.filter(n=>display.has(n)));
    treeStructure(model.nodes.filter(n=>shown.has(n.id)),model.edges.filter(e=>shown.has(e.source)&&shown.has(e.target)&&view.styles[e.id]?.display!=='none'),profile,{...view,diagram:tree});
  }
}
