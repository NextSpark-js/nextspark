import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  generateApiDocsRegistry,
  generateApiPresetsRegistry,
} from '../../scripts/build/registry/generators/api-presets-registry.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const coreDirectory = path.resolve(testDirectory, '../..');
const installedDependencies = path.join(coreDirectory, 'node_modules');
const cssLoaderUrl = pathToFileURL(path.join(testDirectory, 'css-loader.mjs')).href;
const packageSpecifier = '@nextsparkjs/core/components/devtools/api-explorer';

async function linkInstalledDependencies(consumerNodeModules) {
  for (const entry of await readdir(installedDependencies, { withFileTypes: true })) {
    if (entry.name === '.pnpm') continue;
    const source = path.join(installedDependencies, entry.name);
    const destination = path.join(consumerNodeModules, entry.name);

    if (!entry.name.startsWith('@')) {
      await symlink(source, destination, 'junction');
      continue;
    }

    await mkdir(destination, { recursive: true });
    for (const scopedEntry of await readdir(source)) {
      if (entry.name === '@nextsparkjs' && scopedEntry === 'core') continue;
      await symlink(path.join(source, scopedEntry), path.join(destination, scopedEntry), 'junction');
    }
  }
}

async function createConsumer({ removeApiExplorerExport = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'nextspark-core-consumer-'));
  const consumerNodeModules = path.join(directory, 'node_modules');
  const installedCore = path.join(consumerNodeModules, '@nextsparkjs', 'core');
  await mkdir(installedCore, { recursive: true });
  await cp(path.join(coreDirectory, 'dist'), path.join(installedCore, 'dist'), { recursive: true });

  const packageJson = JSON.parse(await readFile(path.join(coreDirectory, 'package.json'), 'utf8'));
  if (removeApiExplorerExport) delete packageJson.exports['./components/devtools/api-explorer'];
  await writeFile(path.join(installedCore, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await linkInstalledDependencies(consumerNodeModules);

  const registryPackage = path.join(consumerNodeModules, '@nextsparkjs', 'registries');
  await mkdir(registryPackage, { recursive: true });
  const registryConfig = {
    outputDir: registryPackage,
    activeTheme: 'contract',
    projectRoot: directory,
  };
  const registryData = { presets: [], docs: [] };
  await writeFile(
    path.join(registryPackage, 'api-docs-registry.ts'),
    generateApiDocsRegistry(registryData, registryConfig),
  );
  await writeFile(
    path.join(registryPackage, 'api-presets-registry.ts'),
    generateApiPresetsRegistry(registryData, registryConfig),
  );
  await writeFile(path.join(registryPackage, 'package.json'), JSON.stringify({
    name: '@nextsparkjs/registries',
    type: 'module',
    exports: {
      './api-docs-registry': './api-docs-registry.ts',
      './api-presets-registry': './api-presets-registry.ts',
    },
  }));
  return directory;
}

async function runConsumer(directory, source) {
  const entry = path.join(directory, 'consumer.mjs');
  await writeFile(entry, source);
  return spawnSync(process.execPath, [entry], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('the built package resolves and evaluates the api-explorer consumer entrypoint', async (t) => {
  const directory = await createConsumer();
  t.after(() => rm(directory, { recursive: true, force: true }));

  const result = await runConsumer(directory, `
    import assert from 'node:assert/strict';
    import { writeFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { build } from 'esbuild';
    import { cssOnlyLoader } from ${JSON.stringify(cssLoaderUrl)};

    const specifier = ${JSON.stringify(packageSpecifier)};
    assert.equal(
      fileURLToPath(import.meta.resolve(specifier)),
      fileURLToPath(new URL('./node_modules/@nextsparkjs/core/dist/components/devtools/api-explorer/index.js', import.meta.url)),
    );
    await assert.rejects(
      import('@nextsparkjs/core/components/devtools/not-a-real-entrypoint'),
      (error) => error?.code === 'ERR_MODULE_NOT_FOUND',
    );

    await writeFile(new URL('./bundle-entry.mjs', import.meta.url), \`export * from '\${specifier}';\`);
    const result = await build({
      absWorkingDir: fileURLToPath(new URL('.', import.meta.url)),
      entryPoints: ['bundle-entry.mjs'],
      outfile: 'bundle.mjs',
      bundle: true,
      format: 'esm',
      platform: 'browser',
      metafile: true,
      plugins: [cssOnlyLoader],
    });
    const inputs = Object.keys(result.metafile.inputs);
    assert(inputs.some((input) => input.endsWith('node_modules/@nextsparkjs/core/dist/components/devtools/api-explorer/index.js')));
    assert(!inputs.some((input) => input.includes('packages/core/src/')));

    const apiExplorer = await import('./bundle.mjs');
    for (const name of ['ApiExplorer', 'ApiEndpointsSidebar', 'ApiRequestPanel', 'ApiResponsePanel', 'JsonViewer']) {
      assert.equal(typeof apiExplorer[name], 'function', name + ' must be a runtime export');
    }
  `);

  assert.equal(result.status, 0, `consumer failed:\n${result.stdout}\n${result.stderr}`);
});

test('the explicit api-explorer export is required by a real consumer', async (t) => {
  const directory = await createConsumer({ removeApiExplorerExport: true });
  t.after(() => rm(directory, { recursive: true, force: true }));

  const result = await runConsumer(directory, `
    import assert from 'node:assert/strict';
    import { writeFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { build } from 'esbuild';
    import { cssOnlyLoader } from ${JSON.stringify(cssLoaderUrl)};

    await writeFile(new URL('./bundle-entry.mjs', import.meta.url), ${JSON.stringify(`export * from '${packageSpecifier}';`)});
    await assert.rejects(
      build({
        absWorkingDir: fileURLToPath(new URL('.', import.meta.url)),
        entryPoints: ['bundle-entry.mjs'],
        outfile: 'bundle.mjs',
        bundle: true,
        format: 'esm',
        platform: 'browser',
        plugins: [cssOnlyLoader],
        logLevel: 'silent',
      }),
      (error) => error?.errors?.some(({ text }) => text.includes('Could not resolve')),
    );
  `);

  assert.equal(result.status, 0, `negative consumer failed:\n${result.stdout}\n${result.stderr}`);
});
