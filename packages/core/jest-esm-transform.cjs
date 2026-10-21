/**
 * Jest transformer for the ESM JavaScript of @nextsparkjs/core's build (used by `@nextsparkjs/core/jest-preset`): it rewrites
 * import/export to CommonJS with TypeScript's own transpiler, which every project that runs ts-jest already has. It does not
 * read the project's tsconfig, so it does not depend on `allowJs`, and it leaves `.ts`/`.tsx` to the project's transform.
 */
const ts = require('typescript')

module.exports = {
  process(source, filename) {
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        allowJs: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    return { code: outputText }
  },
}
