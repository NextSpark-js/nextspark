#!/usr/bin/env node
/**
 * Verifies browser-observed, route-level JavaScript budgets.
 *
 * This intentionally consumes the JSON emitted by reports/measure-routes.mjs.
 * It never reads build manifests, chunk directories, or diagnostic artifacts:
 * response.body() byte counts from the hardened browser capture are authoritative.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const MEASUREMENT_KIND = "browser-route-measurement";
const SUPPORTED_MEASUREMENT_SCHEMA_VERSIONS = new Set([2, 3]);
const BUDGET_KIND = "route-js-budget";
const BUDGET_SCHEMA_VERSION = 1;
const SUPPORTED_MODES = new Set(["allowed", "blocked"]);

export class BudgetVerificationError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "BudgetVerificationError";
    this.errors = errors;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function addError(errors, message) {
  errors.push(message);
}

function requireObject(value, label, errors) {
  if (!isObject(value)) {
    addError(errors, `${label} must be an object.`);
    return null;
  }
  return value;
}

function requireArray(value, label, errors) {
  if (!Array.isArray(value)) {
    addError(errors, `${label} must be an array.`);
    return null;
  }
  return value;
}

function requireNonNegativeSafeInteger(value, label, errors) {
  if (!isNonNegativeSafeInteger(value)) {
    addError(errors, `${label} must be a non-negative safe integer.`);
    return false;
  }
  return true;
}

function routePathname(result) {
  if (typeof result?.route === "string") return result.route.split(/[?#]/, 1)[0];
  return null;
}

function checkBudgetRule(rule, label, errors) {
  const budget = requireObject(rule, label, errors);
  if (!budget) return null;
  if (!requireNonNegativeSafeInteger(budget.maxUniqueBodyBytes, `${label}.maxUniqueBodyBytes`, errors)) return null;
  for (const key of ["maxFiles", "maxTransferBytes"]) {
    if (Object.hasOwn(budget, key)) requireNonNegativeSafeInteger(budget[key], `${label}.${key}`, errors);
  }
  return budget;
}

/**
 * Validates a source-tracked budget file. `routes` is route -> mode -> limits.
 * maxFiles and maxTransferBytes are optional, but maxUniqueBodyBytes is always
 * required because decompressed browser response bodies are the primary metric.
 */
export function validateBudgetConfig(budget) {
  const errors = [];
  const root = requireObject(budget, "Budget config", errors);
  if (!root) throw new BudgetVerificationError(errors);
  if (root.kind !== BUDGET_KIND) addError(errors, `Budget config.kind must equal ${JSON.stringify(BUDGET_KIND)}.`);
  if (root.schemaVersion !== BUDGET_SCHEMA_VERSION) addError(errors, `Budget config.schemaVersion must equal ${BUDGET_SCHEMA_VERSION}.`);

  const requiredModes = requireArray(root.requiredModes, "Budget config.requiredModes", errors);
  if (requiredModes) {
    if (requiredModes.length === 0) addError(errors, "Budget config.requiredModes must not be empty.");
    const seen = new Set();
    for (const mode of requiredModes) {
      if (!SUPPORTED_MODES.has(mode)) addError(errors, `Unsupported required mode: ${JSON.stringify(mode)}.`);
      else if (seen.has(mode)) addError(errors, `Budget config.requiredModes repeats ${JSON.stringify(mode)}.`);
      else seen.add(mode);
    }
  }

  if (typeof root.requireDashboardEvidence !== "boolean") addError(errors, "Budget config.requireDashboardEvidence must be boolean.");
  const routes = requireObject(root.routes, "Budget config.routes", errors);
  if (routes) {
    const routeNames = Object.keys(routes);
    if (routeNames.length === 0) addError(errors, "Budget config.routes must not be empty.");
    for (const route of routeNames) {
      if (!route.startsWith("/") || route.startsWith("//") || route.includes("?") || route.includes("#")) {
        addError(errors, `Budget route must be an origin-relative pathname: ${JSON.stringify(route)}.`);
      }
      const perMode = requireObject(routes[route], `Budget config.routes[${JSON.stringify(route)}]`, errors);
      if (!perMode || !requiredModes) continue;
      for (const mode of requiredModes) {
        if (!Object.hasOwn(perMode, mode)) addError(errors, `Budget route ${JSON.stringify(route)} is missing required mode ${JSON.stringify(mode)}.`);
        else checkBudgetRule(perMode[mode], `Budget ${route} (${mode})`, errors);
      }
    }
  }

  if (errors.length) throw new BudgetVerificationError(errors);
  return budget;
}

function validateJavaScriptCapture(result, label, errors) {
  const javascript = requireObject(result.javascript, `${label}.javascript`, errors);
  if (!javascript) return null;
  const capture = requireObject(javascript.capture, `${label}.javascript.capture`, errors);
  if (!capture) return null;
  if (capture.valid !== true) addError(errors, `${label} has an invalid JavaScript capture.`);
  const invalidReasons = requireArray(capture.invalidReasons, `${label}.javascript.capture.invalidReasons`, errors);
  if (invalidReasons && invalidReasons.length !== 0) addError(errors, `${label} records JavaScript capture invalid reasons.`);

  for (const key of ["nonSuccessfulResponses", "bodyReadErrors", "incompleteRequests"]) {
    const entries = requireArray(javascript[key], `${label}.javascript.${key}`, errors);
    if (entries && entries.length !== 0) addError(errors, `${label} has ${key}; browser JavaScript capture is not usable.`);
  }

  if (!requireNonNegativeSafeInteger(javascript.uniqueBodyBytes, `${label}.javascript.uniqueBodyBytes`, errors)) return null;
  const files = requireArray(javascript.successfulResponses, `${label}.javascript.successfulResponses`, errors);
  if (!files) return null;
  let sum = 0;
  const urls = new Set();
  for (let index = 0; index < files.length; index += 1) {
    const file = requireObject(files[index], `${label}.javascript.successfulResponses[${index}]`, errors);
    if (!file) continue;
    if (typeof file.url !== "string" || file.url.length === 0) addError(errors, `${label} JavaScript response ${index} has no URL.`);
    else if (urls.has(file.url)) addError(errors, `${label} repeats JavaScript response URL ${JSON.stringify(file.url)}.`);
    else urls.add(file.url);
    if (requireNonNegativeSafeInteger(file.bodyBytes, `${label}.javascript.successfulResponses[${index}].bodyBytes`, errors)) sum += file.bodyBytes;
  }
  if (javascript.uniqueBodyBytes !== sum) addError(errors, `${label}.javascript.uniqueBodyBytes (${javascript.uniqueBodyBytes}) does not equal the sum of unique decoded response bodies (${sum}).`);

  const timings = requireObject(result.resourceTimings, `${label}.resourceTimings`, errors);
  const javascriptTotals = timings && requireObject(timings.javascriptTotals, `${label}.resourceTimings.javascriptTotals`, errors);
  if (javascriptTotals) requireNonNegativeSafeInteger(javascriptTotals.transferSize, `${label}.resourceTimings.javascriptTotals.transferSize`, errors);

  return { uniqueBodyBytes: javascript.uniqueBodyBytes, files: files.length, transferSize: javascriptTotals?.transferSize };
}

function validatePrefetchRequests(result, mode, label, errors) {
  if (!Object.hasOwn(result, "prefetchRequests")) {
    addError(errors, `${label}.prefetchRequests must be an object.`);
    return;
  }
  const counters = requireObject(result.prefetchRequests, `${label}.prefetchRequests`, errors);
  if (!counters) return;
  const seenIsValid = requireNonNegativeSafeInteger(counters.seen, `${label}.prefetchRequests.seen`, errors);
  const allowedIsValid = requireNonNegativeSafeInteger(counters.allowed, `${label}.prefetchRequests.allowed`, errors);
  const blockedIsValid = requireNonNegativeSafeInteger(counters.blocked, `${label}.prefetchRequests.blocked`, errors);
  const externalBlockedIsValid = requireNonNegativeSafeInteger(counters.externalBlocked, `${label}.prefetchRequests.externalBlocked`, errors);
  if (!seenIsValid || !allowedIsValid || !blockedIsValid || !externalBlockedIsValid) return;

  if (counters.seen !== counters.allowed + counters.blocked) {
    addError(errors, `${label}.prefetchRequests.seen (${counters.seen}) must equal allowed + blocked (${counters.allowed + counters.blocked}).`);
  }
  if (mode === "allowed" && counters.blocked !== 0) {
    addError(errors, `${label} allowed prefetch mode must have zero blocked requests.`);
  }
  if (mode === "blocked" && counters.allowed !== 0) {
    addError(errors, `${label} blocked prefetch mode must have zero allowed requests.`);
  }
}

function validateResult(result, mode, index, errors) {
  const label = `Measurement ${mode}.results[${index}]`;
  const item = requireObject(result, label, errors);
  if (!item) return null;
  if (item.prefetchMode !== mode) addError(errors, `${label}.prefetchMode must equal ${JSON.stringify(mode)}.`);
  validatePrefetchRequests(item, mode, label, errors);
  if (typeof item.route !== "string" || !item.route.startsWith("/") || item.route.startsWith("//")) addError(errors, `${label}.route must be an origin-relative route.`);
  const navigation = requireObject(item.navigation, `${label}.navigation`, errors);
  if (navigation) {
    if (navigation.redirected !== false) addError(errors, `${label} redirected; redirected visits cannot establish a route budget.`);
    const chain = requireArray(navigation.redirectChain, `${label}.navigation.redirectChain`, errors);
    if (chain && chain.length !== 0) addError(errors, `${label} records a redirect chain; redirected visits cannot establish a route budget.`);
    if (navigation.successfulDirectVisit !== true) addError(errors, `${label} was not a successful direct visit.`);
  }
  const metrics = validateJavaScriptCapture(item, label, errors);
  const isDashboard = routePathname(item) === "/dashboard";
  if (isDashboard) {
    const evidence = navigation && requireObject(navigation.dashboardEvidence, `${label}.navigation.dashboardEvidence`, errors);
    if (!evidence || evidence.confirmed !== true) addError(errors, `${label} has unconfirmed dashboard evidence.`);
  }
  return { route: item.route, routePathname: routePathname(item), metrics, dashboardConfirmed: isDashboard && navigation?.dashboardEvidence?.confirmed === true };
}

/** Validates browser measurement integrity and returns values indexed by mode/path. */
export function validateMeasurement(measurement, budget) {
  const errors = [];
  const root = requireObject(measurement, "Measurement", errors);
  if (!root) throw new BudgetVerificationError(errors);
  if (root.kind !== MEASUREMENT_KIND) addError(errors, `Measurement.kind must equal ${JSON.stringify(MEASUREMENT_KIND)}.`);
  if (!SUPPORTED_MEASUREMENT_SCHEMA_VERSIONS.has(root.schemaVersion)) addError(errors, "Measurement.schemaVersion must equal 2 or 3.");
  if (root.complete !== true) addError(errors, "Measurement is incomplete (complete must be true).");
  if (!requireNonNegativeSafeInteger(root.completedMeasurements, "Measurement.completedMeasurements", errors)
    || !requireNonNegativeSafeInteger(root.totalMeasurements, "Measurement.totalMeasurements", errors)
    || root.completedMeasurements !== root.totalMeasurements) {
    addError(errors, "Measurement is incomplete (completedMeasurements must equal totalMeasurements).");
  }

  const modes = requireObject(root.modes, "Measurement.modes", errors);
  const byMode = new Map();
  const dashboardModes = new Set();
  let observedMeasurements = 0;
  if (modes) {
    for (const mode of Object.keys(modes)) {
      if (!SUPPORTED_MODES.has(mode)) addError(errors, `Measurement has unsupported mode ${JSON.stringify(mode)}.`);
      const content = requireObject(modes[mode], `Measurement.modes.${mode}`, errors);
      const results = content && requireArray(content.results, `Measurement.modes.${mode}.results`, errors);
      if (!results) continue;
      observedMeasurements += results.length;
      const byRoute = new Map();
      results.forEach((result, index) => {
        const checked = validateResult(result, mode, index, errors);
        if (!checked) return;
        if (byRoute.has(checked.routePathname)) addError(errors, `Measurement.modes.${mode} repeats route ${JSON.stringify(checked.routePathname)}.`);
        else byRoute.set(checked.routePathname, checked);
        if (checked.routePathname === "/dashboard" && checked.dashboardConfirmed) dashboardModes.add(mode);
      });
      byMode.set(mode, byRoute);
    }
  }
  if (isNonNegativeSafeInteger(root.completedMeasurements) && observedMeasurements !== root.completedMeasurements) {
    addError(errors, `Measurement result rows (${observedMeasurements}) do not equal completedMeasurements (${root.completedMeasurements}).`);
  }

  for (const route of Object.keys(budget.routes)) {
    for (const mode of budget.requiredModes) {
      if (!byMode.get(mode)?.has(route)) addError(errors, `Measurement is missing required route ${JSON.stringify(route)} in mode ${JSON.stringify(mode)}.`);
    }
  }
  if (budget.requireDashboardEvidence) {
    for (const mode of budget.requiredModes) {
      if (!dashboardModes.has(mode)) addError(errors, `Measurement is missing confirmed /dashboard evidence in mode ${JSON.stringify(mode)}.`);
    }
  }

  if (errors.length) throw new BudgetVerificationError(errors);
  return byMode;
}

export function verifyRouteJsBudget(measurement, budget) {
  validateBudgetConfig(budget);
  const byMode = validateMeasurement(measurement, budget);
  const failures = [];
  const checks = [];
  for (const route of Object.keys(budget.routes).sort()) {
    for (const mode of budget.requiredModes) {
      const rule = budget.routes[route][mode];
      const metrics = byMode.get(mode).get(route).metrics;
      const label = `${route} (${mode})`;
      checks.push({ route, mode, ...metrics, budget: rule });
      if (metrics.uniqueBodyBytes > rule.maxUniqueBodyBytes) failures.push(`${label}: decoded JavaScript ${metrics.uniqueBodyBytes} bytes exceeds maxUniqueBodyBytes ${rule.maxUniqueBodyBytes}.`);
      if (Object.hasOwn(rule, "maxFiles") && metrics.files > rule.maxFiles) failures.push(`${label}: ${metrics.files} unique JavaScript files exceeds maxFiles ${rule.maxFiles}.`);
      if (Object.hasOwn(rule, "maxTransferBytes") && metrics.transferSize > rule.maxTransferBytes) failures.push(`${label}: JavaScript transfer ${metrics.transferSize} bytes exceeds maxTransferBytes ${rule.maxTransferBytes}.`);
    }
  }
  if (failures.length) throw new BudgetVerificationError(failures);
  return checks;
}

export function parseArguments(argv) {
  const options = { measurement: null, budget: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") { options.help = true; continue; }
    const [name, inline] = argument.split(/=(.*)/s, 2);
    if (name !== "--measurement" && name !== "--budget") throw new Error(`Unknown option: ${argument}`);
    const value = inline ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a path.`);
    options[name.slice(2)] = value;
  }
  if (!options.help && (!options.measurement || !options.budget)) throw new Error("--measurement and --budget are required.");
  return options;
}

export function usage() {
  return `Usage: node scripts/performance/verify-route-js-budget.mjs --measurement <measure-routes.json> --budget <route-js-budget.json>\n\nVerifies only completed, direct, valid browser captures. It does not build, measure, update, or bless budgets.`;
}

async function readJson(file, label) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { throw new Error(`Could not read ${label} JSON at ${path.resolve(file)}: ${error.message}`); }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) { process.stdout.write(`${usage()}\n`); return []; }
  const [measurement, budget] = await Promise.all([readJson(options.measurement, "measurement"), readJson(options.budget, "budget")]);
  const checks = verifyRouteJsBudget(measurement, budget);
  for (const check of checks) process.stdout.write(`PASS ${check.route} (${check.mode}): ${check.uniqueBodyBytes} decoded bytes, ${check.files} files, ${check.transferSize} transfer bytes\n`);
  return checks;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`route-js-budget failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
