import chalk from './colors.js'

/** Project templates that are not yet part of the stable 1.0 surface (starter is). */
export const EXPERIMENTAL_TEMPLATES: readonly string[] = ['blog', 'crm', 'productivity']

/** One line for every experimental surface: README and docs use the same wording. */
export function experimentalNotice(what: string): string {
  return `Experimental: ${what} — not part of the stable 1.0 surface and may change without a deprecation period.`
}

export function printExperimentalNotice(what: string): void {
  console.log(chalk.yellow(`  ${experimentalNotice(what)}`))
}
