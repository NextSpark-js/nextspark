/** Members of values that are not modules, which base-path.in-app-urls.test.ts does not take for a module's exports. */
export { default as Picture } from 'next/image'

const tags = { Picture: 'span' } as const

function helpers() {}
helpers.Picture = 'span' as const

export function ObjectMembers({ cover }: { cover: string }) {
  return (
    <>
      <tags.Picture src={cover} />
      <helpers.Picture src={cover} />
    </>
  )
}
