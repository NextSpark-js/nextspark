# 0.1.0-beta.192 status

**UNRELEASED — work in progress.** This prerelease continues the 0.1.0 beta line; it is not a 1.0 release or a statement that the linked issues are complete.

## Release target

The stable target remains existing web hosts. Generated and mobile hosts remain experimental while their host-specific validation and migration work is completed.

| Issue | Integrated beta.192 slice | Remaining acceptance |
| --- | --- | --- |
| [#201](https://github.com/NextSpark-js/nextspark/issues/201) | `nextspark skills` provides an offline bundled catalog with safe list/get commands; generated projects receive small, non-overwriting onboarding pointers, while the legacy AI workflow remains an explicit opt-in. | Full skill discovery and catalog, an evaluation baseline, and legacy ownership/migration remain pending. |
| [#202](https://github.com/NextSpark-js/nextspark/issues/202) | Runtime readiness gates supported authentication routes without exposing diagnostics; login, signup, invitation signup, and recovery render safe unavailable or fail-closed states when their runtime capability is absent. | Validate a real provider end-to-end and collect/build-start preflight behavior for wizard-auth providers. Existing hosts must apply the [documented readiness and invitation-route upgrade guards](../06-authentication/12-passwordless-preset.md#upgrading-existing-hosts); a missing route makes the new shared UI fail closed. |
| [#203](https://github.com/NextSpark-js/nextspark/issues/203) | `nextspark prepare` is shared by `nextspark build`, `nextspark registry:build`, and one-shot `nextspark generate`, with startup/failure guards and `nextspark prepare --watch` cancellation handling before downstream work starts. | Experimental generated-host roadmap work, including generated/mobile host validation, remains pending. |
| [#204](https://github.com/NextSpark-js/nextspark/issues/204) | The merged theme-proxy boundary preserves core access checks around theme results and fails unsafe rewrite targets closed. | Applicable [#204](https://github.com/NextSpark-js/nextspark/issues/204) follow-up gates and broader host validation remain pending. |

## Upgrade and validation status

Before a stable-web release decision, beta.191 upgrade validation, clean-install artifact validation, real-provider web end-to-end coverage, wizard provider collection/build-start preflight, and applicable [#204](https://github.com/NextSpark-js/nextspark/issues/204) gates remain pending. Optional catalog breadth and the full experimental generated/mobile-host roadmap are not automatic stable-web blockers. The known baseline CLI pnpm 9 extglob test failure remains unresolved; this status does not claim an all-green suite.
