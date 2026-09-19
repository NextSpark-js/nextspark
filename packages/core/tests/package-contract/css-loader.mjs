import { readFile } from 'node:fs/promises';

// This contract probes JavaScript evaluation. CSS is still resolved from disk,
// but its browser-only contents are intentionally omitted from the JS bundle.
export const cssOnlyLoader = {
  name: 'css-only-loader',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
      await readFile(path);
      return { contents: '', loader: 'css' };
    });
  },
};
