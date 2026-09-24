/**
 * Install-once project templates and published plugins retain package metadata for their standalone
 * test tooling. Any `next` peer they declare must admit both the oldest Next core supports and the
 * pinned Next installed by create-nextspark-app.
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

function requiredMajors(): number[] {
  const installed = read('packages/create-nextspark-app/src/create.ts').match(/'next@(\d+)\.\d+\.\d+'/)
  assert.ok(installed, 'create-nextspark-app installs a pinned next@X.Y.Z')

  const corePeer = JSON.parse(read('packages/core/package.json')).peerDependencies.next as string
  const floor = corePeer.match(/^>=(\d+)\.\d+\.\d+$/)
  assert.ok(floor, `core's next peer is a floor: ${corePeer}`)

  return [Number(floor[1]), Number(installed[1])]
}

function manifests(): string[] {
  const roots = ['packages/core/templates/projects', 'plugins']
  return roots.flatMap((dir) => fs
    .readdirSync(path.join(REPO, dir))
    .map((name) => `${dir}/${name}/package.json`)
    .filter((file) => fs.existsSync(path.join(REPO, file))))
}

test('the majors to admit are the floor core admits and the one generated projects install', () => {
  const [floor, installed] = requiredMajors()
  assert.ok(floor < installed, `${floor} < ${installed}`)
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
