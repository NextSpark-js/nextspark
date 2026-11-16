// The bash the tests spawn: Git Bash on Windows (plain `bash` there is WSL's), `bash` elsewhere.
import { findGitBash } from './find-git-bash.mjs'

export const BASH = findGitBash() ?? 'bash'
