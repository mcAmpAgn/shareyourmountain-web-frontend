/** Split generated SQLite statements without breaking quoted text or SQL comments. */
export function sqlStatements(source: string): string[] {
  const statements: string[] = [];
  let buffer = '',
    quote: string | null = null,
    lineComment = false,
    blockComment = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i],
      next = source[i + 1];
    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        buffer += '\n';
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i++;
        buffer += ' ';
      }
      continue;
    }
    if (quote) {
      buffer += char;
      if (char === quote) {
        if (next === quote) {
          buffer += next;
          i++;
        } else quote = null;
      }
      continue;
    }
    if (char === '-' && next === '-') {
      lineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (["'", '"', '`'].includes(char)) {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === ';') {
      if (buffer.trim()) statements.push(buffer.trim());
      buffer = '';
    } else buffer += char;
  }
  if (quote || blockComment) throw new Error('Unterminated generated SQLite text');
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}
