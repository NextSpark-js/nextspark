/**
 * The native components cannot apply `className` (NativeWind does not style components from an external
 * package). They accept it so shared code type-checks; in development, say once per component that it is
 * ignored and point to `style`.
 */
const warned = new Set<string>();

export function warnIgnoredClassName(component: string, className?: string): void {
  if (!className || !__DEV__ || warned.has(component)) return;
  warned.add(component);
  console.warn(
    `[@nextsparkjs/ui] ${component}: \`className\` is ignored on React Native. Use \`style\` instead.`
  );
}
