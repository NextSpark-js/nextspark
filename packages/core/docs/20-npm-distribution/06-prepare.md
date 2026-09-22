# Preparing registry output

`nextspark prepare` runs the same registry/discovery compiler used by the current NextSpark host. It preserves the existing source resolution and writes the current generated registry layout, including `.nextspark/registries` and the generated `app/(templates)` integration owned by the legacy host.

```sh
nextspark prepare
nextspark prepare --production
nextspark prepare --watch
```

Use `--production` before a production build to force the compiler's `NODE_ENV=production`; except for that explicit override, environment variables passed to the command override values in the project `.env`. With `--production`, a successful registry step is followed by the [production auth readiness check](../06-authentication/12-passwordless-preset.md#production-readiness-check), which fails preparation when no configured login method can authenticate (declare runtime-injected providers with `NEXTSPARK_AUTH_RUNTIME_ONLY`; `NEXTSPARK_AUTH_PREFLIGHT=off` is the only bypass). `--watch` keeps the existing core watcher running and forwards Ctrl-C/termination to it after checking the compiler's output destinations are safe.

`nextspark build` invokes this same preparation operation before it starts `next build`, unless explicitly invoked with `--no-registry`, which skips only the registry step: the auth readiness check still runs. A preparation failure prevents Next from starting, while `registry:build` and one-shot `generate` remain compatible callers of the same operation.

There is currently no `prepare --check`: a non-writing freshness check has not been implemented yet. One-shot preparation captures the compiler's stdout and stderr in bounded buffers and shows its warnings or failure diagnostics when it finishes, rather than streaming progress live. The current output layout remains the stable host layout above; a generated `src/app` host and root-first source contract are experimental roadmap work, not implied by this command.
