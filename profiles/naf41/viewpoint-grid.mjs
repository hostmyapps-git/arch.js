// NAFv4.1 figure 3-17, printed p.79.
const columns = ['Taxonomy','Structure','','Connectivity','Processes','States','Sequences','Information','Constraints','Roadmap'];
const domains = [
  ['Concepts','C','capability','#4d741c','#b5d76f'],
  ['Service specifications','S','service','#974577','#efacd2'],
  ['Logical specifications','L','logical','#21658b','#87cff0'],
  ['Physical resource specifications','P','physical','#a45418','#ffd3a8'],
  ['Architecture foundation','A','foundation','#876317','#f0cb6a'],
];
const cells = domains.flatMap(([,prefix],row) => ['1','2','','3','4','5','6','7','8','r'].flatMap((suffix,col) =>
  !suffix || prefix==='C' && suffix==='6' ? [] : [{id:prefix+suffix,row,col}]));
cells.push({id:'C1-S1',row:0,col:0,bridge:true},{id:'L4-P4',row:2,col:4,bridge:true},{id:'L2-L3',row:2,col:2});

export const naf41LegacyGrid = {
  viewpoint:'A2',
  title:'NAFv4.1 · Viewpoint grid',
  columns,
  rows:domains.map(([title,,,color,darkColor]) => ({title,color,darkColor})),
  cells
};

export const naf41Grid = {
  ...naf41LegacyGrid,
  rows:domains.map(([title,,styleGroup]) => ({title,styleGroup})),
  cells:cells.map(cell => cell.id==='L2-L3' ? {...cell,vertical:true} : cell)
};
