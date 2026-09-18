import assert from "node:assert/strict";
import test from "node:test";
import { BudgetVerificationError, parseArguments, verifyRouteJsBudget } from "./verify-route-js-budget.mjs";

const routes = ["/", "/docs", "/login", "/403"];
const modes = ["allowed", "blocked"];

function result(route, mode, bytes, { files = 2, transferSize = 300_000, dashboard = false } = {}) {
  const perFile = Math.floor(bytes / files);
  const successfulResponses = Array.from({ length: files }, (_, index) => ({ url: `http://localhost:3310/_next/static/${route.replaceAll("/", "_") || "root"}-${mode}-${index}.js`, bodyBytes: index === files - 1 ? bytes - perFile * (files - 1) : perFile }));
  return {
    route,
    prefetchMode: mode,
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

function measurement({ oldFanout = false } = {}) {
  const values = { "/": 1_120_000, "/docs": 1_150_000, "/login": 1_195_000, "/403": 1_170_000 };
  const modeResults = Object.fromEntries(modes.map((mode) => [mode, {
    results: [
      ...routes.map((route) => result(route, mode, oldFanout ? values[route] + 250_000 : values[route])),
      result("/dashboard", mode, 1_180_000, { dashboard: true }),
    ],
  }]));
  return {
    kind: "browser-route-measurement",
    schemaVersion: 2,
    complete: true,
    completedMeasurements: 10,
    totalMeasurements: 10,
    modes: modeResults,
  };
}

function budget({ optionalCaps = false } = {}) {
  const rule = (maxUniqueBodyBytes) => ({ maxUniqueBodyBytes, ...(optionalCaps ? { maxFiles: 2, maxTransferBytes: 300_000 } : {}) });
  return {
    kind: "route-js-budget",
    schemaVersion: 1,
    requiredModes: modes,
    requireDashboardEvidence: true,
    routes: {
      "/": { allowed: rule(1_250_000), blocked: rule(1_250_000) },
      "/docs": { allowed: rule(1_250_000), blocked: rule(1_250_000) },
      "/login": { allowed: rule(1_300_000), blocked: rule(1_300_000) },
      "/403": { allowed: rule(1_250_000), blocked: rule(1_250_000) },
    },
  };
}

test("isolated browser fixture passes source-tracked budgets in both prefetch modes", () => {
  const checks = verifyRouteJsBudget(measurement(), budget({ optionalCaps: true }));
  assert.equal(checks.length, 8);
  assert.equal(checks.find((check) => check.route === "/login" && check.mode === "blocked").uniqueBodyBytes, 1_195_000);
});

test("counterfactual beta.190 old fan-out demonstrably fails the route byte budgets", () => {
  assert.throws(
    () => verifyRouteJsBudget(measurement({ oldFanout: true }), budget()),
    (error) => error instanceof BudgetVerificationError
      && error.message.includes("decoded JavaScript")
      && error.message.includes("/ (allowed)"),
  );
});

test("refuses incomplete, redirected, invalid, missing, and unconfirmed captures", () => {
  const cases = [
    ["incomplete", (input) => { input.complete = false; }, "incomplete"],
    ["counter mismatch", (input) => { input.totalMeasurements = 11; input.completedMeasurements = 11; }, "result rows"],
    ["redirected", (input) => { input.modes.allowed.results[0].navigation.redirected = true; }, "redirected"],
    ["invalid JS", (input) => { input.modes.allowed.results[0].javascript.capture.valid = false; }, "invalid JavaScript capture"],
    ["missing route", (input) => { input.modes.blocked.results = input.modes.blocked.results.filter((entry) => entry.route !== "/403"); }, "missing required route"],
    ["dashboard unconfirmed", (input) => { input.modes.allowed.results.find((entry) => entry.route === "/dashboard").navigation.dashboardEvidence.confirmed = false; }, "unconfirmed dashboard evidence"],
  ];
  for (const [name, mutate, expected] of cases) {
    const input = measurement();
    mutate(input);
    assert.throws(() => verifyRouteJsBudget(input, budget()), new RegExp(expected), name);
  }
});

test("CLI parser rejects implicit update/blessing options", () => {
  assert.deepEqual(parseArguments(["--measurement=a.json", "--budget", "b.json"]), { measurement: "a.json", budget: "b.json", help: false });
  assert.throws(() => parseArguments(["--update", "out.json", "--measurement", "a", "--budget", "b"]), /Unknown option/);
});

test("enforces optional unique-file and transfer-byte ceilings when configured", () => {
  const input = measurement();
  const sample = input.modes.allowed.results.find((entry) => entry.route === "/");
  sample.javascript.successfulResponses.push({ url: "http://localhost:3310/_next/static/extra.js", bodyBytes: 0 });
  sample.resourceTimings.javascriptTotals.transferSize = 300_001;
  assert.throws(
    () => verifyRouteJsBudget(input, budget({ optionalCaps: true })),
    (error) => error instanceof BudgetVerificationError
      && error.message.includes("exceeds maxFiles 2")
      && error.message.includes("exceeds maxTransferBytes 300000"),
  );
});
