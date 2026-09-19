import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BudgetVerificationError, parseArguments, verifyRouteJsBudget } from "./verify-route-js-budget.mjs";

const sourceBudget = JSON.parse(await readFile(new URL("./apps-dev-route-js-budget.json", import.meta.url), "utf8"));
const causalComparison = JSON.parse(await readFile(new URL("./fixtures/registry-causal-comparison.json", import.meta.url), "utf8"));
const routes = Object.keys(sourceBudget.routes);
const modes = sourceBudget.requiredModes;

function prefetchRequests(route, mode) {
  // A route with no prefetch activity is valid: login deliberately covers that case.
  if (route === "/login") return { seen: 0, allowed: 0, blocked: 0, externalBlocked: 0 };
  return mode === "allowed"
    ? { seen: 2, allowed: 2, blocked: 0, externalBlocked: 0 }
    : { seen: 2, allowed: 0, blocked: 2, externalBlocked: 0 };
}

function result(route, mode, bytes, { files = 2, transferSize = 300_000, dashboard = false } = {}) {
  const perFile = Math.floor(bytes / files);
  const successfulResponses = Array.from({ length: files }, (_, index) => ({ url: `http://localhost:3310/_next/static/${route.replaceAll("/", "_") || "root"}-${mode}-${index}.js`, bodyBytes: index === files - 1 ? bytes - perFile * (files - 1) : perFile }));
  return {
    route,
    prefetchMode: mode,
    prefetchRequests: prefetchRequests(route, mode),
    requestedUrl: `http://localhost:3310${route}`,
    navigation: {
      redirected: false,
      redirectChain: [],
      successfulDirectVisit: true,
      dashboardEvidence: route === "/dashboard" ? { confirmed: dashboard, selector: dashboard ? "#dashboard-container" : null } : null,
    },
    javascript: {
      uniqueBodyBytes: bytes,
      successfulResponses,
      nonSuccessfulResponses: [],
      bodyReadErrors: [],
      incompleteRequests: [],
      capture: { valid: true, invalidReasons: [] },
    },
    resourceTimings: { javascriptTotals: { transferSize } },
  };
}

function setBytes(entry, bytes) {
  entry.javascript.uniqueBodyBytes = bytes;
  entry.javascript.successfulResponses[0].bodyBytes = Math.floor(bytes / 2);
  entry.javascript.successfulResponses[1].bodyBytes = bytes - entry.javascript.successfulResponses[0].bodyBytes;
}

function bytesWithin(rule) {
  return rule.maxUniqueBodyBytes - 1;
}

function measurement() {
  const modeResults = Object.fromEntries(modes.map((mode) => [mode, {
    results: [
      ...routes.map((route) => result(route, mode, bytesWithin(sourceBudget.routes[route][mode]))),
      // Synthetic validator-only dashboard row: it is not a historical auth measurement.
      result("/dashboard", mode, 0, { dashboard: true }),
    ],
  }]));
  const completedMeasurements = modes.length * (routes.length + 1);
  return {
    kind: "browser-route-measurement",
    schemaVersion: 3,
    complete: true,
    completedMeasurements,
    totalMeasurements: completedMeasurements,
    modes: modeResults,
  };
}

function sample(input, mode, route) {
  return input.modes[mode].results.find((entry) => entry.route === route);
}

function directCausalRows() {
  return causalComparison.rows.filter((row) => row.direct && routes.includes(row.route) && modes.includes(row.mode));
}

function measurementFromCausalRows(value) {
  const directRows = directCausalRows();
  const modeResults = Object.fromEntries(modes.map((mode) => [mode, {
    results: [
      ...directRows.filter((row) => row.mode === mode).map((row) => result(row.route, mode, row[value])),
      // Historical dashboard rows were redirected; only this synthetic row supplies validator evidence.
      result("/dashboard", mode, 0, { dashboard: true }),
    ],
  }]));
  return {
    kind: "browser-route-measurement",
    schemaVersion: 3,
    complete: true,
    completedMeasurements: modes.length * (routes.length + 1),
    totalMeasurements: modes.length * (routes.length + 1),
    modes: modeResults,
  };
}

function sourceBudgetWithOptionalCaps() {
  const configured = structuredClone(sourceBudget);
  configured.routes["/"].allowed.maxFiles = 2;
  configured.routes["/"].allowed.maxTransferBytes = 300_000;
  return configured;
}

test("browser fixture passes the tracked apps/dev route budgets in both prefetch modes", () => {
  const checks = verifyRouteJsBudget(measurement(), sourceBudget);
  assert.equal(checks.length, routes.length * modes.length);
  assert.equal(checks.find((check) => check.route === "/login" && check.mode === "blocked").uniqueBodyBytes, bytesWithin(sourceBudget.routes["/login"].blocked));
});

test("preserved direct registry comparison fails before and passes after under tracked budgets", () => {
  const directRows = directCausalRows();
  assert.equal(directRows.length, routes.length * modes.length);
  assert.ok(directRows.every((row) => row.direct && row.markdownOrChatSources.length === 0));
  assert.ok(causalComparison.rows.filter((row) => row.route === "/dashboard").every((row) => !row.direct), "redirected dashboard history is not authentication proof");

  assert.throws(
    () => verifyRouteJsBudget(measurementFromCausalRows("before"), sourceBudget),
    (error) => error instanceof BudgetVerificationError
      && !error.message.includes("/ (allowed): decoded JavaScript")
      && error.message.includes("/docs (allowed): decoded JavaScript")
      && error.message.includes("/ (blocked): decoded JavaScript"),
  );
  assert.doesNotThrow(() => verifyRouteJsBudget(measurementFromCausalRows("after"), sourceBudget));
});

test("enforces the exact tracked boundary and rejects one byte above it", () => {
  const atLimit = measurement();
  const rule = sourceBudget.routes["/"].allowed;
  setBytes(sample(atLimit, "allowed", "/"), rule.maxUniqueBodyBytes);
  assert.doesNotThrow(() => verifyRouteJsBudget(atLimit, sourceBudget));

  const overLimit = measurement();
  const bytes = rule.maxUniqueBodyBytes + 1;
  setBytes(sample(overLimit, "allowed", "/"), bytes);
  assert.throws(
    () => verifyRouteJsBudget(overLimit, sourceBudget),
    (error) => error instanceof BudgetVerificationError
      && error.message.includes(`/ (allowed): decoded JavaScript ${bytes} bytes exceeds maxUniqueBodyBytes ${rule.maxUniqueBodyBytes}`),
  );
});

test("accepts valid prefetch request counters, including zero requests on login", () => {
  const input = measurement();
  assert.deepEqual(sample(input, "allowed", "/login").prefetchRequests, { seen: 0, allowed: 0, blocked: 0, externalBlocked: 0 });
  assert.deepEqual(sample(input, "blocked", "/login").prefetchRequests, { seen: 0, allowed: 0, blocked: 0, externalBlocked: 0 });
  // External blocks are recorded separately and therefore must not change seen.
  sample(input, "allowed", "/").prefetchRequests.externalBlocked = 3;
  assert.doesNotThrow(() => verifyRouteJsBudget(input, sourceBudget));
});

test("refuses missing, malformed, inconsistent, and mode-incompatible prefetch request counters", () => {
  const cases = [
    ["missing counters", (entry) => { delete entry.prefetchRequests; }, "prefetchRequests must be an object"],
    ["malformed counters", (entry) => { entry.prefetchRequests = null; }, "prefetchRequests must be an object"],
    ["missing seen counter", (entry) => { delete entry.prefetchRequests.seen; }, "prefetchRequests.seen must be a non-negative safe integer"],
    ["negative counter", (entry) => { entry.prefetchRequests.seen = -1; }, "prefetchRequests.seen must be a non-negative safe integer"],
    ["fractional counter", (entry) => { entry.prefetchRequests.allowed = 1.5; }, "prefetchRequests.allowed must be a non-negative safe integer"],
    ["unsafe counter", (entry) => { entry.prefetchRequests.blocked = Number.MAX_SAFE_INTEGER + 1; }, "prefetchRequests.blocked must be a non-negative safe integer"],
    ["missing external counter", (entry) => { delete entry.prefetchRequests.externalBlocked; }, "prefetchRequests.externalBlocked must be a non-negative safe integer"],
    ["negative external counter", (entry) => { entry.prefetchRequests.externalBlocked = -1; }, "prefetchRequests.externalBlocked must be a non-negative safe integer"],
    ["sum mismatch", (entry) => { entry.prefetchRequests.seen = 3; }, "prefetchRequests.seen (3) must equal allowed + blocked (2)"],
    ["allowed mode has blocked request", (entry) => { entry.prefetchRequests = { seen: 2, allowed: 1, blocked: 1, externalBlocked: 0 }; }, "allowed prefetch mode must have zero blocked requests"],
    ["blocked mode has allowed request", (entry) => { entry.prefetchRequests = { seen: 2, allowed: 1, blocked: 1, externalBlocked: 0 }; }, "blocked prefetch mode must have zero allowed requests"],
  ];
  for (const [name, mutate, expected] of cases) {
    const input = measurement();
    const mode = name.includes("blocked mode") ? "blocked" : "allowed";
    mutate(sample(input, mode, "/"));
    assert.throws(
      () => verifyRouteJsBudget(input, sourceBudget),
      (error) => error instanceof BudgetVerificationError && error.message.includes(expected),
      name,
    );
  }
});

test("schema v2 requires prefetch counters just as schema v3 does", () => {
  const validV2 = measurement();
  validV2.schemaVersion = 2;
  assert.doesNotThrow(() => verifyRouteJsBudget(validV2, sourceBudget));

  const missingV2 = measurement();
  missingV2.schemaVersion = 2;
  delete sample(missingV2, "allowed", "/").prefetchRequests;
  assert.throws(() => verifyRouteJsBudget(missingV2, sourceBudget), /prefetchRequests must be an object/);
});

test("refuses incomplete, redirected, invalid, missing, and unconfirmed captures", () => {
  const cases = [
    ["incomplete", (input) => { input.complete = false; }, "incomplete"],
    ["counter mismatch", (input) => { input.totalMeasurements += 1; input.completedMeasurements += 1; }, "result rows"],
    ["redirected", (input) => { sample(input, "allowed", "/").navigation.redirected = true; }, "redirected"],
    ["invalid JS", (input) => { sample(input, "allowed", "/").javascript.capture.valid = false; }, "invalid JavaScript capture"],
    ["missing route", (input) => { input.modes.blocked.results = input.modes.blocked.results.filter((entry) => entry.route !== "/403"); }, "missing required route"],
    ["dashboard unconfirmed", (input) => { sample(input, "allowed", "/dashboard").navigation.dashboardEvidence.confirmed = false; }, "unconfirmed dashboard evidence"],
  ];
  for (const [name, mutate, expected] of cases) {
    const input = measurement();
    mutate(input);
    assert.throws(() => verifyRouteJsBudget(input, sourceBudget), new RegExp(expected), name);
  }
});

test("CLI parser fails closed for implicit update and unknown options", () => {
  assert.deepEqual(parseArguments(["--measurement=a.json", "--budget", "b.json"]), { measurement: "a.json", budget: "b.json", help: false });
  for (const unknown of ["--update", "--bless", "--unknown"]) {
    assert.throws(() => parseArguments([unknown, "out.json", "--measurement", "a", "--budget", "b"]), /Unknown option/);
  }
});

test("enforces optional unique-file and transfer-byte ceilings when configured", () => {
  const input = measurement();
  const route = sample(input, "allowed", "/");
  route.javascript.successfulResponses.push({ url: "http://localhost:3310/_next/static/extra.js", bodyBytes: 0 });
  route.resourceTimings.javascriptTotals.transferSize = 300_001;
  assert.throws(
    () => verifyRouteJsBudget(input, sourceBudgetWithOptionalCaps()),
    (error) => error instanceof BudgetVerificationError
      && error.message.includes("exceeds maxFiles 2")
      && error.message.includes("exceeds maxTransferBytes 300000"),
  );
});
