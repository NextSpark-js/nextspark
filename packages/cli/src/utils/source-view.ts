/** Text-level helpers for config-shaped source: no TypeScript runtime is needed to find a brace. */

export interface SourceString {
  start: number;
  end: number;
  value: string;
}

export interface SourceView {
  code: string;
  strings: SourceString[];
}

/** Mask comments and string contents so config syntax is never found in prose. */
export function sourceView(source: string): SourceView {
  const code = source.split('');
  const strings: SourceString[] = [];
  const mask = (start: number, end: number) => {
    for (let index = start; index < end; index++) code[index] = ' ';
  };
  for (let index = 0; index < source.length;) {
    if (source[index] === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      mask(index, end === -1 ? source.length : end);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2);
      const end = close === -1 ? source.length : close + 2;
      mask(index, end);
      index = end;
      continue;
    }
    if (!['"', "'", '`'].includes(source[index])) {
      index++;
      continue;
    }
    const start = index;
    const quote = source[index++];
    while (index < source.length && source[index] !== quote) {
      index += source[index] === '\\' ? 2 : 1;
    }
    const end = Math.min(index + 1, source.length);
    strings.push({ start, end, value: source.slice(start + 1, index) });
    mask(start, end);
    index = end;
  }
  return { code: code.join(''), strings };
}

export function closingBrace(code: string, openingBrace: number): number | null {
  let depth = 0;
  for (let index = openingBrace; index < code.length; index++) {
    if (code[index] === '{') depth++;
    else if (code[index] === '}' && --depth === 0) return index;
  }
  return null;
}
