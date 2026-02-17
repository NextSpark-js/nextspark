import path from 'path'
import { assertWithinProject } from './path-security'

// Use a consistent fake project dir (works on both Windows and Unix)
const PROJECT_DIR = path.resolve('/projects/my-app')

describe('assertWithinProject', () => {
  it('allows a normal relative path', () => {
    const result = assertWithinProject('src/index.ts', PROJECT_DIR)
    expect(result).toBe(path.join(PROJECT_DIR, 'src', 'index.ts'))
  })

  it('allows a deeply nested path', () => {
    const result = assertWithinProject('src/lib/utils/helper.ts', PROJECT_DIR)
    expect(result).toBe(path.join(PROJECT_DIR, 'src', 'lib', 'utils', 'helper.ts'))
  })

  it('allows "." (resolves to project dir itself)', () => {
    const result = assertWithinProject('.', PROJECT_DIR)
    expect(result).toBe(PROJECT_DIR)
  })

  it('allows empty string (resolves to project dir)', () => {
    const result = assertWithinProject('', PROJECT_DIR)
    expect(result).toBe(PROJECT_DIR)
  })

  it('allows path with "./" prefix', () => {
    const result = assertWithinProject('./src/file.ts', PROJECT_DIR)
    expect(result).toBe(path.join(PROJECT_DIR, 'src', 'file.ts'))
  })

  it('allows path with double slashes', () => {
    const result = assertWithinProject('src//file.ts', PROJECT_DIR)
    expect(result).toBe(path.join(PROJECT_DIR, 'src', 'file.ts'))
  })

  it('blocks single "../" traversal', () => {
    expect(() => assertWithinProject('../secret', PROJECT_DIR))
      .toThrow('Access denied')
  })

  it('blocks deep "../../etc/passwd" traversal', () => {
    expect(() => assertWithinProject('../../etc/passwd', PROJECT_DIR))
      .toThrow('Access denied')
  })

  it('blocks absolute path outside project', () => {
    // Use a path that's definitely outside the project
    const outsidePath = path.resolve('/etc/passwd')
    expect(() => assertWithinProject(outsidePath, PROJECT_DIR))
      .toThrow('Access denied')
  })

  it('blocks tricky traversal "foo/../../../etc/shadow"', () => {
    expect(() => assertWithinProject('foo/../../../etc/shadow', PROJECT_DIR))
      .toThrow('Access denied')
  })

  it('allows safe relative traversal within project', () => {
    // src/../lib/file.ts stays within project
    const result = assertWithinProject('src/../lib/file.ts', PROJECT_DIR)
    expect(result).toBe(path.join(PROJECT_DIR, 'lib', 'file.ts'))
  })

  it('includes the offending path in error message', () => {
    expect(() => assertWithinProject('../../attack', PROJECT_DIR))
      .toThrow('../../attack')
  })
})
