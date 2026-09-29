// Child of the writeOwnedFile crash test: rewrites the dev diagnostic module, to be SIGKILLed
// after the file is replaced and before the record is finalized.
import { writeOwnedFile } from '../generation.mjs'
import { DEV_DIAGNOSTIC_FILE } from '../render.mjs'

writeOwnedFile(process.argv[2], DEV_DIAGNOSTIC_FILE, process.argv[3])
