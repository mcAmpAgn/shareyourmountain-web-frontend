import { cp, mkdir, readdir, readFile, rm, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Source selection is deliberate: never package a working directory wholesale.
export const releaseEntries = [
  'dist/client',
  'src/server',
  'src/core',
  'src/shared',
  'scripts/migrate.ts',
  'scripts/import-legacy.ts',
  'scripts/backup.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'README.md',
  'LICENSE',
  '.env.example',
];
export function isReleasePathAllowed(relative: string) {
  const parts = relative.replaceAll('\\', '/').split('/');
  return (
    !parts.some((part) =>
      ['..', 'node_modules', 'data', 'backups', 'uploads', '.git'].includes(part),
    ) &&
    !parts.some((part) => part.startsWith('.env') && part !== '.env.example') &&
    !/\.(?:sqlite|db)(?:-|$)|\.sql\.zip$/i.test(relative)
  );
}
export async function inventoryFiles(root: string, relative = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (!isReleasePathAllowed(name))
      throw new Error(`Refusing runtime or private release path: ${name}`);
    if ((await lstat(path.join(root, name))).isSymbolicLink())
      throw new Error('Release symlinks are not allowed');
    if (entry.isDirectory()) result.push(...(await inventoryFiles(root, name)));
    else result.push(name);
  }
  return result.sort();
}
export async function packageRelease(root = process.cwd()) {
  const output = path.resolve(root, 'release');
  if (path.dirname(output) !== path.resolve(root)) throw new Error('Invalid release directory');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const entry of releaseEntries)
    await cp(path.resolve(root, entry), path.join(output, entry), { recursive: true });
  const files = await inventoryFiles(output);
  const manifest: { commit: string | null; files: { path: string; sha256: string }[] } = {
    commit: process.env.GITHUB_SHA ?? null,
    files: [],
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
  console.log(`Packaged ${files.length} allowlisted files with SHA-256 checksums.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await packageRelease();
