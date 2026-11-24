// Presentation lexer. It tolerates fragments and incomplete input, and
// every character is retained so copying produces the original source.
const strings = '"(?:\\\\.|[^"\\\\\\r\\n])*"';
const words = new Set(('architecture model config presentation dashboard view diagram profile viewpoint relation type extends embed as frame '
  + 'include exclude style routes route place at of gap align size tree nodes relations direction theme spacing padding '
  + 'template icon iconPosition backgroundColor backgroundImage opacity description technology stereotype tags '
  + 'from to via curve path label offset sideOffset sharePath dasharray crossings color width height '
  + 'initial final lanes laneAttribute participants messages orderAttribute showContext true false null '
  + 'required attributes attribute enum abstract container contains requiredNodes requiredRelations '
  + 'incoming outgoing defaultRelation propertyFields table fields mode rows columns startAttribute endAttribute '
  + 'all none strict draft auto rounded orthogonal bezier straight virtual references referenceDisplay referenceOccurrences '
  + 'person system application service component database queue interface capability process artifact node package '
  + 'allowSelf min max minLength maxLength valueAttribute parentAttribute ownerAttribute signatureAttribute methods functions interfaces ports parameters '
  + 'returns asyncMessages decisions forks joins finals styleGroup accent showLabel showStereotype showIcon').split(/\s+/));
const patterns = {
  json: new RegExp(`(?<key>${strings})(?=\\s*:)|(?<string>${strings})|(?<number>-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)|(?<word>[A-Za-z_][\\w.-]*)|(?<punctuation>[{}\\[\\]:,])`, 'g'),
  dsl: new RegExp(`(?<string>${strings})|(?<comment>#[^\\n]*|//[^\\n]*)|(?<number>-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)|(?<word>@(?:help|meta)\\b|[A-Za-z_][\\w.-]*)|(?<punctuation><->|->|[{}\\[\\](),])`, 'g'),
};

function makeTokenizer(words, patterns) {
  return function tokenize(text, format = 'dsl') {
    const result = [], pattern = format === 'json' ? patterns.json : patterns.dsl;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) result.push({kind:'plain',text:text.slice(cursor,match.index)});
      const value = match[0];
      let kind = Object.keys(match.groups).find(key => match.groups[key] !== undefined);
      if (kind === 'word') kind = words.has(value) || value.startsWith('@') ? 'keyword' : /^[A-Z][A-Za-z_0-9]+$/.test(value) ? 'type' : 'plain';
      result.push({kind,text:value});
      cursor = match.index + value.length;
    }
    if (cursor < text.length) result.push({kind:'plain',text:text.slice(cursor)});
    return result;
  };
}

export const sourceTokens = makeTokenizer(words,patterns);

// The offline dashboard uses the same tokenizer without loading arch.js.
export function sourceTokenizerScript() {
  const pattern = format => `new RegExp(${JSON.stringify(patterns[format].source)},'g')`;
  return `(${makeTokenizer.toString()})(new Set(${JSON.stringify([...words])}),{dsl:${pattern('dsl')},json:${pattern('json')}})`;
}

export const codePalette = dark => dark ? {
  plain:'#e2e8f0', key:'#93c5fd', keyword:'#c4b5fd', type:'#a5b4fc', string:'#6ee7b7', number:'#fbbf24', comment:'#9baac0', punctuation:'#a4b3c7'
} : {
  plain:'#26344a', key:'#1d4f91', keyword:'#5635a7', type:'#4338a8', string:'#157052', number:'#a74b0a', comment:'#64748b', punctuation:'#52647b'
};
