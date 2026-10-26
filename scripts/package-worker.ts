import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { inventoryFiles } from './package-release.js';
const root = process.cwd(),
  output = path.resolve(root, 'release-cloudflare');
if (path.dirname(output) !== path.resolve(root)) throw new Error('Invalid artifact path');
const parsed = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  await readFile('wrangler.jsonc', 'utf8'),
);
if (parsed.error) throw new Error('Invalid Wrangler configuration');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'worker'), { recursive: true });
await cp('dist/worker/index.js', path.join(output, 'worker/index.js'));
await cp('dist/client', path.join(output, 'client'), { recursive: true });
await cp('d1/migrations', path.join(output, 'migrations'), { recursive: true });
const config = {
  ...parsed.config,
  main: 'worker/index.js',
  assets: { ...parsed.config.assets, directory: 'client' },
  d1_databases: parsed.config.d1_databases.map((binding: Record<string, unknown>) => ({
    ...binding,
    migrations_dir: 'migrations',
  })),
};
delete config.build;
await writeFile(path.join(output, 'wrangler.jsonc'), JSON.stringify(config, null, 2) + '\n');
const files = await inventoryFiles(output),
  manifest = {
    commit: process.env.GITHUB_SHA ?? null,
    files: [] as { path: string; sha256: string }[],
  };
for (const file of files)
  manifest.files.push({
    path: file,
    sha256: createHash('sha256')
      .update(await readFile(path.join(output, file)))
      .digest('hex'),
  });
await writeFile(
  path.join(output, 'release-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `Cloudflare artifact ready: ${files.length} verified files; no native SQLite runtime or catalog seed.`,
);
