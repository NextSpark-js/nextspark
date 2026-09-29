Stand-in for the `@nextsparkjs/core` npm package (imported as `@fixture-core/*` through each host's
tsconfig paths, never by the real package name). Route modules here are what core ships as defaults;
`routes.mjs` lists them, and a project `templates/` file at the same path replaces them.
