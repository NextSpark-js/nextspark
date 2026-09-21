import { findSkillGuide, SKILL_GUIDES } from '../guides/skills.js'

export interface SkillsListOptions {
  json?: boolean
}

export interface SkillsGetOptions {
  json?: boolean
}

function catalog() {
  return SKILL_GUIDES.map(({ name, description }) => ({ name, description }))
}

export function skillsListCommand(version: string, options: SkillsListOptions): void {
  const result = { version, skills: catalog() }
  if (options.json) {
    console.log(JSON.stringify(result))
    return
  }

  console.log(`NextSpark skills (${result.version})`)
  for (const skill of result.skills) console.log(`${skill.name}\t${skill.description}`)
}

export function skillsGetCommand(version: string, name: string, options: SkillsGetOptions): void {
  const guide = findSkillGuide(name)
  if (!guide) {
    console.error(`Unknown NextSpark skill: ${JSON.stringify(name)}. Run \`nextspark skills list\` for available skills.`)
    process.exitCode = 1
    return
  }

  if (options.json) {
    console.log(JSON.stringify({ version, ...guide }))
    return
  }
  console.log(guide.content)
}
