/**
 * Tests for the client-JS comparison of the generated-host conformance check: module ids are
 * normalized only where the factory's module-system parameter (resolved lexically) uses them,
 * facade artifacts are found by exact shape, and only artifacts on the exact expected list are
 * excused. Includes the review's probes (shadowed `n`, an added `n.r(t),`, an added
 * `t.s([],99),t.i(99)`), which must all be differences. Chunk samples are real Next.js 16.3.5
 * output from the host-conformance fixture.
 *
 * Run: node --test scripts/performance/host-conformance-bytes.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { canonicalText, compareArtifacts, cssDigests, labelModules, normalizedBytes, scanChunk } from './host-conformance-bytes.mjs'
import { loadTypeScriptFor } from '../../packages/core/scripts/build/registry/shared/typescript-compiler.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const ts = await loadTypeScriptFor(join(REPO_ROOT, 'packages/core'))

const scan = text => scanChunk({ text, ts })
/** Normalized size, excusing only the artifacts `excuse` selects. */
const size = (text, excuse = () => false) => normalizedBytes(scan(text), text, excuse)

const webpack = (id, body) => `(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[601],{${id}:(e,t,n)=>{"use strict";${body}}},e=>{e.O(0,[263,946,358],()=>e(e.s=${id})),_N_E=e.O()}]);`
const turbopack = (id, body) => `(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,${id},t=>{"use strict";${body}}]);`

const COUNTER = 'var s=n(6515),r=n(3523);function u(){let[e,t]=(0,r.useState)(0);return(0,s.jsxs)("div",{children:["Count: ",e]})}'
const ERROR = 'var e=t.i(2285);t.s(["default",0,function({reset:t}){return(0,e.jsx)("button",{onClick:()=>t(),children:"Try again"})}]'

// --- module ids --------------------------------------------------------------

test('module ids in module-system positions are normalized, whatever their length', () => {
  // The same graph (a loader module requiring the page module) under other numeric ids.
  const graph = (page, loader) =>
    `(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[601],{${page}:(e,t,n)=>{n.d(t,{default:()=>u});${COUNTER}},${loader}:(e,t,n)=>{Promise.resolve().then(n.bind(n,${page}))}},e=>{e.O(0,[1],()=>e(e.s=${loader}))}]);`
  assert.equal(size(graph(3589, 5719)), size(graph(12, 7)))
  assert.equal(canonicalText(scan(graph(3589, 5719)), graph(3589, 5719)), canonicalText(scan(graph(12, 7)), graph(12, 7)))
  assert.equal(size(turbopack(39455, `${ERROR})`)), size(turbopack(1204, `${ERROR})`)))
})

test('review probe 1: a changed literal under a shadowed `n` is a difference', () => {
  const before = webpack(3589, 'n.d(t,{default:()=>u});[0].map(n=>n.slice(1))')
  const after = webpack(3589, 'n.d(t,{default:()=>u});[0].map(n=>n.slice(99999))')
  assert.equal(size(after) - size(before), 4)
})

test('shadowing through let/var/function/catch/destructuring also keeps literals as code', () => {
  for (const shadow of [
    '{let n=Math;n.max(1)}',
    'function f(){var n=Math;return n.max(1)}',
    'function n(x){return x}n(1)',
    'try{}catch(n){n(1)}',
    '[[1]].map(([n])=>n(1))',
  ]) {
    const before = webpack(3589, shadow)
    const after = webpack(3589, shadow.replace(/\(1\)/, '(12345)'))
    assert.equal(size(after) - size(before), 4, shadow)
  }
})

test('numbers used by unrecognized operations on the module-system parameter are code', () => {
  for (const [a, b] of [
    ['n.slice(1)', 'n.slice(12345)'],
    ['n.x=1', 'n.x=12345'],
    ['n.d(t,1)', 'n.d(t,12345)'],
  ]) {
    assert.equal(size(webpack(3589, b)) - size(webpack(3589, a)), 4, a)
  }
  assert.equal(size(turbopack(1, 't.q(1)'.replace('1)', '12345)'))) - size(turbopack(1, 't.q(1)')), 4)
})

test('a numeric constant elsewhere is code, even when it equals a module id', () => {
  const constant = webpack(3589, COUNTER.replace('useState)(0)', 'useState)(3589)'))
  assert.equal(size(constant) - size(webpack(3589, COUNTER)), 3)
})

// --- artifacts ---------------------------------------------------------------

test('webpack ESM marker: found with its exact shape on the factory it belongs to', () => {
  const { artifacts } = scan(webpack(3589, `n.r(t),n.d(t,{default:()=>u});${COUNTER}`))
  assert.deepEqual(artifacts.map(a => [a.type, a.factoryId, a.shape, a.bytes]), [['webpack-esm-marker', 3589, 'n.r(t),', 7]])
})

test('Turbopack empty re-export: registration and group argument are one artifact', () => {
  const { artifacts } = scan(turbopack(1204, 'var e=t.i(2285);t.s([],65385),t.i(65385),t.s(["default",0,1],1204)'))
  assert.deepEqual(artifacts.map(a => [a.type, a.factoryId, a.shape, a.bytes]), [['turbopack-reexport', 1204, 't.s([],#),t.i(#),,#', 30]])
})

test('review probe 2: an added n.r(t), is a byte difference unless it is on the expected list', () => {
  const before = webpack(3589, `n.d(t,{default:()=>u});${COUNTER}`)
  const after = webpack(3589, `n.r(t),n.d(t,{default:()=>u});${COUNTER}`)
  assert.equal(size(after) - size(before), 7)
  assert.equal(size(after, a => a.type === 'webpack-esm-marker') - size(before), 0)
})

test('review probe 3: an added t.s([],99),t.i(99) is a byte difference unless it is on the expected list', () => {
  const before = turbopack(1204, `${ERROR})`)
  const after = turbopack(1204, `var e=t.i(2285);t.s([],99),t.i(99),${ERROR.slice('var e=t.i(2285);'.length)})`)
  assert.ok(size(after) - size(before) > 0)
  assert.equal(size(after, a => a.type === 'turbopack-reexport') - size(before), 0)
})

test('an artifact-shaped call on a shadowed or foreign binding is not an artifact', () => {
  assert.deepEqual(scan(webpack(3589, '[0].map(n=>(n.r(t),1))')).artifacts, [])
  assert.deepEqual(scan(turbopack(1, '[0].map(t=>(t.s([],9),t.i(9),1))')).artifacts, [])
  assert.deepEqual(scan('var n={r(){}};n.r(t),n.d()').artifacts, [])
})

// --- the expected list (fixed data) -----------------------------------------

const MARKER = { host: 'manual', key: 'webpack-esm-marker@route:counter/page.tsx', shape: 'n.r(t),', count: 1 }
const REEXPORT = { host: 'generated', key: 'turbopack-reexport@route:error.tsx', shape: 't.s([],#),t.i(#),,#', count: 1 }
const found = (count, shape) => ({ count, shapes: Array(count).fill(shape), bytes: Array(count).fill(shape.length) })
const host = artifacts => ({ artifacts })
const verdicts = input => Object.fromEntries(compareArtifacts(input).map(result => [result.key, result.equal]))

test('the expected artifacts pass when present exactly as listed', () => {
  assert.deepEqual(
    verdicts({
      expected: [MARKER, REEXPORT],
      manual: host({ [MARKER.key]: found(1, 'n.r(t),'), 'webpack-esm-marker@route:error.tsx': found(1, 'r.r(n),') }),
      generated: host({ [REEXPORT.key]: found(1, 't.s([],#),t.i(#),,#'), 'webpack-esm-marker@route:error.tsx': found(1, 'r.r(n),') }),
    }),
    { [MARKER.key]: true, [REEXPORT.key]: true, 'webpack-esm-marker@route:error.tsx': true }
  )
})

test('review round 3 probe: a duplicated facade (two factories, two artifacts) fails the fixed count', () => {
  assert.equal(verdicts({ expected: [REEXPORT], manual: host({}), generated: host({ [REEXPORT.key]: found(2, 't.s([],#),t.i(#),,#') }) })[REEXPORT.key], false)
  assert.equal(verdicts({ expected: [{ ...REEXPORT, count: 2 }], manual: host({}), generated: host({ [REEXPORT.key]: found(1, 't.s([],#),t.i(#),,#') }) })[REEXPORT.key], false)
})

test('probe 2 via the list: an unexpected marker, a missing one or one in the wrong host fails', () => {
  const extra = verdicts({
    expected: [MARKER],
    manual: host({ [MARKER.key]: found(1, 'n.r(t),') }),
    generated: host({ 'webpack-esm-marker@route:about/page.tsx': found(1, 'n.r(t),') }),
  })
  assert.equal(extra['webpack-esm-marker@route:about/page.tsx'], false)
  assert.equal(verdicts({ expected: [MARKER], manual: host({}), generated: host({}) })[MARKER.key], false)
  assert.equal(verdicts({ expected: [MARKER], manual: host({ [MARKER.key]: found(1, 'n.r(t),') }), generated: host({ [MARKER.key]: found(1, 'n.r(t),') }) })[MARKER.key], false)
})

test('probe 3 via the list: an extra re-export registration or a different exact shape fails', () => {
  const unexpected = verdicts({
    expected: [REEXPORT],
    manual: host({}),
    generated: host({ [REEXPORT.key]: found(1, 't.s([],#),t.i(#),,#'), 'turbopack-reexport@route:counter/page.tsx': found(1, 't.s([],#),t.i(#),') }),
  })
  assert.equal(unexpected['turbopack-reexport@route:counter/page.tsx'], false)
  assert.equal(verdicts({ expected: [REEXPORT], manual: host({}), generated: host({ [REEXPORT.key]: found(1, 'e.s([],#),e.i(#),,#') }) })[REEXPORT.key], false)
})

// --- fix round 3: factories only in the top-level chunk registration ---------

test('review round 3 probe: a lookup table nested in a real factory is application code (+8), both bundlers', () => {
  for (const wrap of [body => webpack(3589, body), body => turbopack(1204, body)]) {
    const before = wrap('var m={1:(a,b,c)=>c(2)};')
    const after = wrap('var m={99999:(a,b,c)=>c(77777)};')
    assert.equal(after.length - before.length, 8)
    assert.equal(size(after) - size(before), 8)
  }
})

test('an [id, fn] pair nested in a real factory is application code, both bundlers', () => {
  for (const wrap of [body => webpack(3589, body), body => turbopack(1204, body)]) {
    assert.equal(size(wrap('var m=[99999,a=>a.i(77777)];')) - size(wrap('var m=[1,a=>a.i(2)];')), 8)
  }
})

test('factories are recognized only in the exact top-level registration', () => {
  const ids = text => scan(text).factoryIds
  assert.deepEqual(ids(webpack(3589, COUNTER)), [3589])
  assert.deepEqual(ids(turbopack(1204, `${ERROR})`)), [1204])
  assert.deepEqual(ids(`"use strict";${webpack(7, 'n(1)')}`), [7], 'a "use strict" prologue is fine')
  for (const text of [
    'var chunk={1:(e,t,n)=>n(2)}',
    'foo.push([[1],{1:(e,t,n)=>n(2)}])',
    '(self.other=self.other||[]).push([[1],{1:(e,t,n)=>n(2)}])',
    '(()=>{(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1],{1:(e,t,n)=>n(2)}])})()',
    'if(x)(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1],{1:(e,t,n)=>n(2)}])',
    '(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1],{1:(e,t,n)=>n(2)}],extra)',
    'foo([0,1,t=>t.i(2)])',
    '(globalThis.OTHER||(globalThis.OTHER=[])).push([0,1,t=>t.i(2)])',
    'x&&(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push([0,1,t=>t.i(2)])',
  ]) {
    assert.deepEqual(ids(text), [], text)
    assert.deepEqual(scan(text).idTokens, [], text)
  }
})

// --- fix round 3: canonical chunk text -----------------------------------------

test('canonical text: same modules under other ids and map order are equal; any code change is not', () => {
  const chunk = (a, b) => `(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[219],{${a}:(e,t,n)=>{n.d(t,{default:()=>r})},${b}:(e,t,n)=>{Promise.resolve().then(n.bind(n,${a}))}},e=>{e.O(0,[1],()=>e(e.s=${b}))}]);`
  const canonical = text => canonicalText(scan(text), text)
  assert.equal(canonical(chunk(2475, 8043)), canonical(chunk(6977, 3912)), 'ids swap the map order')
  const changed = chunk(6977, 3912).replace('default', 'Default')
  assert.notEqual(canonical(chunk(2475, 8043)), canonical(changed))
})

// --- fix round 4: identity-preserving labels -----------------------------------

const webpackMap = (body, entry = '') => `(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[601],{${body}}${entry ? `,${entry}` : ''}]);`
const canonical = text => canonicalText(scan(text), text)

test('review round 4 probe A: retargeting a dependency changes the canonical text and the labels', () => {
  const chunk = target => webpackMap([`1:(e,t,n)=>{t.default=n(${target}).default}`, '2:(e,t)=>{t.default="safe"}', '3:(e,t)=>{t.default="unsafe"}'].join(','))
  assert.notEqual(canonical(chunk(2)), canonical(chunk(3)))
  const labels = text => labelModules([{ scan: scan(text), text }]).labels
  assert.notEqual(labels(chunk(2)).get(1), labels(chunk(3)).get(1))
  assert.equal(labels(chunk(2)).get(2), labels(chunk(3)).get(2), 'the target modules themselves are unchanged')
})

test('review round 4 probe B: retargeting the webpack entry callback changes the canonical text', () => {
  const chunk = entry => webpackMap('1:(e,t)=>{t.default="first"},2:(e,t)=>{t.default="second"}', `e=>e(e.s=${entry})`)
  assert.notEqual(canonical(chunk(1)), canonical(chunk(2)))
})

test('retargeting a Turbopack runtime entry (runtimeModuleIds) changes the canonical text', () => {
  const chunk = entry =>
    `(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push([0,{otherChunks:[],runtimeModuleIds:[${entry}]}]),(()=>{})();` +
    '(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push([0,11,t=>{t.v("first")},22,t=>{t.v("second")}]);'
  const single = text => {
    const scans = text.split(';').filter(Boolean).map(part => ({ scan: scan(`${part};`), text: `${part};` }))
    const { labels } = labelModules(scans)
    return scans.map(({ scan: s, text: t }) => canonicalText(s, t, undefined, labels)).join('\n')
  }
  assert.notEqual(single(chunk(11)), single(chunk(22)))
})

test('the same module graph under renumbered ids compares equal; a different graph does not', () => {
  const graph = ([a, b, c], entry) => webpackMap([`${a}:(e,t,n)=>{t.default=n(${b}).default+n(${c}).x}`, `${b}:(e,t)=>{t.default="safe"}`, `${c}:(e,t,n)=>{t.x=n(${b}).default}`].join(','), `e=>e(e.s=${entry})`)
  const original = graph([1, 2, 3], 1)
  assert.equal(canonical(original), canonical(graph([90210, 7, 4455], 90210)))
  assert.equal(size(original), size(graph([90210, 7, 4455], 90210)))
  assert.notEqual(canonical(original), canonical(graph([1, 2, 3], 3)), 'entry moved to another module')
  const swapped = webpackMap(['1:(e,t,n)=>{t.default=n(3).default+n(2).x}', '2:(e,t)=>{t.default="safe"}', '3:(e,t,n)=>{t.x=n(2).default}'].join(','), 'e=>e(e.s=1)')
  assert.notEqual(canonical(original), canonical(swapped), 'dependencies swapped')
})

test('labels span chunks: a reference resolves to a module declared in another chunk of the host', () => {
  const lib = target => webpackMap(`${target}:(e,t)=>{t.default="lib"}`)
  const page = target => webpackMap(`5:(e,t,n)=>{t.default=n(${target}).default}`)
  const host = target => {
    const scans = [lib(target), page(target)].map(text => ({ scan: scan(text), text }))
    const { labels, externals } = labelModules(scans)
    return { canonical: scans.map(({ scan: s, text }) => canonicalText(s, text, undefined, labels)).join('\n'), externals }
  }
  assert.equal(host(100).canonical, host(99999).canonical)
  assert.deepEqual(host(100).externals, [])
})

test('a reference to a module the host does not declare is reported as external', () => {
  const text = webpackMap('1:(e,t,n)=>{t.default=n(424242).default}')
  assert.deepEqual(labelModules([{ scan: scan(text), text }]).externals, [424242])
})

// --- fix round 4: CSS by content ------------------------------------------------

test('CSS: a same-count content change is a difference', () => {
  const read = files => file => files[file] ?? null
  const before = cssDigests(['static/css/a.css'], read({ 'static/css/a.css': '.button{color:red}' }))
  const after = cssDigests(['static/css/a.css'], read({ 'static/css/a.css': '.button{color:blue}' }))
  assert.equal(before.length, after.length)
  assert.notDeepEqual(before, after)
})

test('CSS: identical content under other file names is equal; a missing file is not', () => {
  const css = '[data-probe=core-shell] nav{display:flex;color:#1f4e79}'
  const manual = cssDigests(['static/css/29829957b76d8a74.css'], () => css)
  const generated = cssDigests(['static/css/0f00ba11c0ffee00.css'], () => `${css}\n/*# sourceMappingURL=0f00ba11c0ffee00.css.map*/`)
  assert.deepEqual(manual, generated)
  assert.notDeepEqual(manual, cssDigests(['static/css/gone.css'], () => null))
  assert.deepEqual(cssDigests(['b.css', 'a.css'], file => (file === 'a.css' ? 'x{}' : 'y{}')), cssDigests(['a.css', 'b.css'], file => (file === 'a.css' ? 'x{}' : 'y{}')))
})
