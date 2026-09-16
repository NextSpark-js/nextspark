/**
 * Guards the console of the process that imports it, as `guardConsole` does.
 * The scripts that run the registry build import it before anything else:
 * modules print as they load - config.mjs has dotenv read the project's .env,
 * which logs the path it read - and an import runs before the body of the
 * module that imports it.
 *
 * @module core/scripts/utils/console-guard
 */

import { guardConsole } from './logging.mjs'

guardConsole()
