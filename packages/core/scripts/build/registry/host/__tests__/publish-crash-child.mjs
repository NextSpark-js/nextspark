// Child of the crash test: publishes a generation of many registries, to be SIGKILLed mid-publish.
import { prepareHost } from '../prepare.mjs'
import { hostConfig, manyRegistries } from './host-helpers.mjs'

const [root, countText] = process.argv.slice(2)
await prepareHost(hostConfig(root, { registries: manyRegistries(Number(countText), 'new') }), { mode: 'production' })
