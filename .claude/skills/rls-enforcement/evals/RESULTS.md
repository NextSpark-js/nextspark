# rls-enforcement — eval results

Methodology: anthropics-skill-creator (autonomous loop; subagents with-skill vs baseline,
graded against the per-case assertions in evals.json).

## Iteration 1 — core cases (evals.json #0-4)
With-skill completed runs: 4/4 PASS (3/3 assertions each). Baseline (no skill, repo access)
also strong (the code + sibling skills are well-documented), so easy cases SATURATE — no
headroom. Conclusion: measure the skill on HARDER composite/debugging scenarios.

## Iteration 1b — harder gap cases (current skill, pre-improvement)
gap1 tx-pool-binding: not covered by skill. gap2 0-rows: PASS (agent derived). gap3 api-key:
PARTIAL 2/3 — agent explicitly hedged ("skill doesn't specify api-key routing"). gap4
don't-over-service: PASS. gap8 test-as-nextspark_app: PASS (derived).

## Improvements applied (deltas A-F + description)
A tx bound to one pool+GUC / atomicity; B api-key vs session asymmetry; C "0 rows after cutover"
triage + test-as-nextspark_app mechanics; D inverse footgun (don't over-service); E lean checklist;
F webhooks/scheduler actors + related skill; sharper symptom-based description.

## Iteration 2 — same gap cases (improved skill)
5/5 PASS (15/15 assertions). gap1 now a precise PASS; gap3 PASS 3/3 with NO hedge (the
skill-attributable win). Pass-rate on completed runs: ~87.5% -> 100%. Agents now cite the
skill's encoded sections instead of deriving (lower reasoning burden / higher reliability).
