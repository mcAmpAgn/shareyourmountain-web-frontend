/** MySQL dump text is data here: no SQL statement from the source is executed. */
export function parseTuples(text: string): unknown[][] {
  const rows: unknown[][] = [];
  let row: unknown[] | null = null,
    token = '',
    quoted = false,
    wasQuoted = false,
    bitLiteral = false;
  function value() {
    if (wasQuoted) {
      if (bitLiteral) {
        if (!/^[01]+$/.test(token)) throw new Error('Invalid BIT literal');
        return Number.parseInt(token, 2);
      }
      return token;
    }
    const t = token.trim();
    return t.toUpperCase() === 'NULL'
      ? null
      : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(t)
        ? Number(t)
        : t;
  }
  function push() {
    row!.push(value());
    token = '';
    wasQuoted = false;
    bitLiteral = false;
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '\\') {
        const n = text[++i];
        if (n === undefined) throw new Error('Incomplete escape');
        token += ({ n: '\n', r: '\r', t: '\t', '0': '\0' } as Record<string, string>)[n] ?? n;
      } else if (c === "'") {
        if (text[i + 1] === "'") {
          token += "'";
          i++;
        } else quoted = false;
      } else token += c;
    } else if (c === "'") {
      if (token) {
        if (token.toLowerCase() !== 'b') throw new Error('Unsupported string literal prefix');
        bitLiteral = true;
        token = '';
      }
      quoted = true;
      wasQuoted = true;
    } else if (c === '(') {
      if (row) throw new Error('Unexpected nested SQL tuple');
      row = [];
      token = '';
      wasQuoted = false;
    } else if (row && c === ',') push();
    else if (row && c === ')') {
      push();
      rows.push(row);
      row = null;
    } else if (row && (!/\s/.test(c) || wasQuoted)) token += c;
  }
  if (quoted || row) throw new Error('Incomplete SQL tuple');
  return rows;
}
export function readTableRows(sql: string, name: string): Record<string, unknown>[] {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid catalog table name');
  const schema = sql.match(
    new RegExp(
      'CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?`' +
        name +
        '`\\s*\\(\\s*\\n([\\s\\S]*?)\\n\\)\\s*ENGINE',
      'i',
    ),
  );
  if (!schema) return [];
  const defaults = [...schema[1].matchAll(/^\s*`([^`]+)`/gm)].map((m) => m[1]);
  const inserts = new RegExp(
    'INSERT INTO\\s+`' + name + '`\\s*(\\([^;]*?\\))?\\s*VALUES\\s*([\\s\\S]*?);\\s*(?:\\r?\\n|$)',
    'gi',
  );
  const records: Record<string, unknown>[] = [];
  for (const match of sql.matchAll(inserts)) {
    const columns = match[1] ? [...match[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]) : defaults;
    for (const tuple of parseTuples(match[2])) {
      if (tuple.length !== columns.length) throw new Error(`Column mismatch in ${name}`);
      records.push(Object.fromEntries(columns.map((c, i) => [c, tuple[i]])));
    }
  }
  return records;
}
