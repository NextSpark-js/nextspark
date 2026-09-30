/**
 * The contracts package of a project that has a mobile app (#203 stage 7b).
 *
 * `nextspark prepare` generates the API contracts (DTO types and zod schemas of the project's entities)
 * into it, and the mobile app imports it instead of writing the same types by hand. The package.json
 * names the project that feeds it (`nextspark.contractsProject`), which is what lets prepare write
 * here; `src/` is generated and is not written by the scaffold.
 */

import fs from 'fs-extra'
import path from 'path'

/** Fixed for every project: a private workspace package nothing publishes. */
export const CONTRACTS_PACKAGE_NAME = '@project/contracts'

export const CONTRACTS_ZOD_VERSION = '^4.1.5'
export const CONTRACTS_TYPESCRIPT_VERSION = '^5.3.0'

export interface ContractsPackageOptions {
  /** Path from the contracts package to the project that feeds it (`../web`, `../..`). */
  projectPath: string
  zodVersion?: string
}

export async function writeContractsPackage(dir: string, { projectPath, zodVersion = CONTRACTS_ZOD_VERSION }: ContractsPackageOptions): Promise<void> {
  await fs.ensureDir(dir)
  await fs.writeJson(path.join(dir, 'package.json'), {
    name: CONTRACTS_PACKAGE_NAME,
    version: '0.0.0',
    private: true,
    description: "Portable API contracts (DTO types and zod schemas) that nextspark prepare generates from the project's entities. Imports zod only, so the mobile app can use it.",
    main: './src/index.ts',
    types: './src/index.ts',
    exports: { '.': './src/index.ts' },
    sideEffects: false,
    scripts: { typecheck: 'tsc --noEmit' },
    dependencies: { zod: zodVersion },
    devDependencies: { typescript: CONTRACTS_TYPESCRIPT_VERSION },
    nextspark: { contractsProject: projectPath },
  }, { spaces: 2 })
  await fs.writeJson(path.join(dir, 'tsconfig.json'), {
    compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', lib: ['ES2020', 'DOM'], strict: true, skipLibCheck: true, noEmit: true, types: [] },
    include: ['src/**/*'],
  }, { spaces: 2 })
  await fs.writeFile(path.join(dir, 'README.md'), `# ${CONTRACTS_PACKAGE_NAME}

The API contracts of this project: DTO types and zod schemas for its entities, and the API response envelopes.
Everything under \`src/\` is **generated** by \`nextspark prepare\` (run in the web project) and checked by
\`nextspark prepare --check\`; edit the entity configs, not these files. Commit the generated files: the mobile
app builds from them without running the web project.

- it imports \`zod\` and nothing else (no Node built-ins, no server code, no registries), so the mobile app can import it;
- the mobile app imports portable code only: this package, \`@nextsparkjs/ui\` and \`@nextsparkjs/mobile\`.
`)
}
