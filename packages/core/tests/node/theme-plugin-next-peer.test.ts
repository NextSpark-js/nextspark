/**
 * Install-once project templates and published plugins retain package metadata for their standalone
 * test tooling. Any `next` peer they declare must admit the Next core pins (`~X.Y.Z`: the generated
 * host's route export table is verified against that minor, RFC #203) and the pinned Next installed
 * by create-nextspark-app, which must be one core admits.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

const read = (file: string) => fs.readFileSync(path.join(REPO, file), 'utf8')

/** Majors a range admits, for the forms these manifests use: `^X.Y.Z` and `>=X.Y.Z`, joined by `||`. */
function admits(range: string, major: number): boolean {
  return range.split('||').some((alternative) => {
    const caret = alternative.trim().match(/^\^(\d+)\.\d+\.\d+$/)
    if (caret) return Number(caret[1]) === major
    const floor = alternative.trim().match(/^>=(\d+)\.\d+\.\d+$/)
    if (floor) return major >= Number(floor[1])
    throw new Error(`Unrecognized range: ${range}`)
  })
}

function pins() {
  const installed = read('packages/create-nextspark-app/src/create.ts').match(/'next@(\d+)\.(\d+)\.(\d+)'/)
  assert.ok(installed, 'create-nextspark-app installs a pinned next@X.Y.Z')

  const corePeer = JSON.parse(read('packages/core/package.json')).peerDependencies.next as string
  const pinned = corePeer.match(/^~(\d+)\.(\d+)\.(\d+)$/)
  assert.ok(pinned, `core pins its next peer to one minor (~X.Y.Z): ${corePeer}`)

  return { core: pinned.slice(1).map(Number), installed: installed.slice(1).map(Number) }
}

function requiredMajors(): number[] {
  const { core, installed } = pins()
  return [...new Set([core[0], installed[0]])]
}

function manifests(): string[] {
  const roots = ['packages/core/templates/projects', 'plugins']
  return roots.flatMap((dir) => fs
    .readdirSync(path.join(REPO, dir))
    .map((name) => `${dir}/${name}/package.json`)
    .filter((file) => fs.existsSync(path.join(REPO, file))))
}

test('generated projects install a Next that core\'s pinned peer admits', () => {
  const { core, installed } = pins()
  assert.ok(installed[0] === core[0] && installed[1] === core[1] && installed[2] >= core[2], `next@${installed.join('.')} is inside ~${core.join('.')}`)
})

test("every project template and published plugin admits the project's Next as a peer", () => {
  const majors = requiredMajors()
  const found = manifests()
  assert.ok(found.length >= 4, `found ${found.length} project-template and published-plugin manifests`)

  const rejecting = found.flatMap((file) => {
    const manifest = JSON.parse(read(file))
    const range: string | undefined = manifest.peerDependencies?.next ?? manifest.dependencies?.next
    if (range === undefined) return []
    return majors.filter((major) => !admits(range, major)).map((major) => `${file}: next "${range}" rejects ${major}`)
  })

  assert.deepEqual(rejecting, [])
})

test('the theme and plugin scaffolding skills declare a next range that admits both majors', () => {
  const majors = requiredMajors()
  const skills = [
    '.claude/skills/create-theme/SKILL.md',
    '.claude/skills/create-plugin/SKILL.md',
    '.claude/skills/plugins/SKILL.md',
    '.claude/skills/monorepo-architecture/SKILL.md',
    '.claude/commands/how-to/create-plugin.md',
  ]

  const rejecting = skills.flatMap((file) => {
    const ranges = [...read(file).matchAll(/"next":\s*"([\^>][^"]*)"/g)].map((match) => match[1])
    assert.ok(ranges.length > 0, `${file} declares a next range`)
    return ranges.flatMap((range) =>
      majors.filter((major) => !admits(range, major)).map((major) => `${file}: next "${range}" rejects ${major}`),
    )
  })

  assert.deepEqual(rejecting, [])
})
