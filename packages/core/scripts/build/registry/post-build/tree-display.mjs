/**
 * Tree Display
 *
 * Displays discovered content structure in console
 *
 * @module core/scripts/build/registry/post-build/tree-display
 */

/**
 * Display discovered contents in a beautiful tree structure
 */
export function displayTreeStructure(plugins, entities, themes) {
  console.log('Discovered Contents Structure:')
  console.log()
  console.log('contents/')

  // Helper function to get tree characters
  const getTreeChars = (isLast, hasItems) => {
    if (!hasItems) return '   (empty)'
    return isLast ? '└──' : '├──'
  }

  const getSubTreeChars = (isLast) => isLast ? '    ' : '│   '

  /**
   * Build entity tree from flat list
   */
  function buildEntityTree(entities) {
    const tree = []
    const entityMap = new Map()

    // Create map for quick lookup
    entities.forEach(entity => {
      entityMap.set(entity.name, { ...entity, children: [] })
    })

    // Build parent-child relationships
    entities.forEach(entity => {
      const entityNode = entityMap.get(entity.name)
      if (entity.parent && entityMap.has(entity.parent)) {
        entityMap.get(entity.parent).children.push(entityNode)
      } else if (!entity.parent) {
        tree.push(entityNode)
      }
    })

    return tree
  }

  /**
   * Recursively display entity tree
   */
  function displayEntityTree(entityNodes, prefix = '') {
    entityNodes.forEach((entity, index) => {
      const isLastItem = index === entityNodes.length - 1
      const features = [
        entity.hasComponents && 'components',
        entity.hasHooks && 'hooks',
        entity.hasMigrations && 'migrations',
        entity.hasMessages && 'messages',
        entity.hasAssets && 'assets'
      ].filter(Boolean)
      const featureInfo = features.length > 0 ? ` (${features.join(', ')})` : ''

      console.log(`${prefix}${isLastItem ? '└──' : '├──'} ${entity.name}${featureInfo}`)

      // Display config file and migrations
      const newPrefix = prefix + (isLastItem ? '    ' : '│   ')
      if (entity.actualConfigFile) {
        const configLine = `${newPrefix}├── ${entity.actualConfigFile}`
        console.log(`${configLine}`)
      }
      if (entity.hasMigrations) {
        const migrationsLine = `${newPrefix}└── migrations/`
        console.log(`${migrationsLine}`)
      }

      // Recursively display children
      if (entity.children && entity.children.length > 0) {
        const childPrefix = newPrefix
        displayEntityTree(entity.children, childPrefix, isLastItem)
      }
    })
  }

  /**
   * Display plugin tree with nested entities
   */
  function displayPluginTree(plugin, prefix = '', isLast = true) {
    const info = [
      plugin.hasAPI && `API [${plugin.routeFiles.length} routes]`,
      plugin.entities?.length > 0 && `${plugin.entities.length} entities`,
      plugin.hasMessages && 'messages',
      plugin.hasAssets && 'assets'
    ].filter(Boolean).join(', ')

    const pluginInfo = info ? ` (${info})` : ''
    console.log(`${prefix}${isLast ? '└──' : '├──'} ${plugin.name}${pluginInfo}`)

    const newPrefix = prefix + (isLast ? '    ' : '│   ')

    // Display assets if present
    if (plugin.hasAssets) {
      console.log(`${newPrefix}├── assets`)
    }

    // Display messages if present
    if (plugin.hasMessages) {
      console.log(`${newPrefix}├── messages`)
    }

    // Display entities
    if (plugin.entities && plugin.entities.length > 0) {
      console.log(`${newPrefix}├── entities`)
      const entityTree = buildEntityTree(plugin.entities)
      displayEntityTree(entityTree, newPrefix + '│   ', false)
    }

    // Display routes
    if (plugin.routeFiles && plugin.routeFiles.length > 0) {
      console.log(`${newPrefix}└── api [${plugin.routeFiles.length} routes]`)
      plugin.routeFiles.forEach((route, routeIndex) => {
        const isLastRoute = routeIndex === plugin.routeFiles.length - 1
        const routePrefix = newPrefix + '    '
        console.log(`${routePrefix}${isLastRoute ? '└──' : '├──'} ${route.path}`)
      })
    }
  }

  // Display plugins
  const hasPlugins = plugins.length > 0
  const hasThemes = themes.length > 0

  const totalSections = [hasPlugins, hasThemes].filter(Boolean).length
  let sectionIndex = 0

  // Plugins section
  if (hasPlugins || plugins.length === 0) {
    sectionIndex++
    const isLastSection = sectionIndex === totalSections
    console.log(`${getTreeChars(isLastSection && !hasThemes, hasPlugins)} plugins/`)

    plugins.forEach((plugin, index) => {
      const isLastPlugin = index === plugins.length - 1
      const subPrefix = getSubTreeChars(isLastSection && !hasThemes)
      displayPluginTree(plugin, subPrefix, isLastPlugin)
    })
  }

  /**
   * Display theme tree with entities, routes, and plugin dependencies
   */
  function displayThemeTree(theme, prefix = '', isLast = true) {
    const info = [
      theme.plugins && theme.plugins.length > 0 && `uses: [${theme.plugins.join(', ')}]`,
      theme.entities?.length > 0 && `${theme.entities.length} entities`,
      theme.routeFiles?.length > 0 && `${theme.routeFiles.length} routes`,
      theme.hasComponents && 'components',
      theme.hasStyles && 'styles',
      theme.hasAssets && 'assets',
      theme.hasMessages && 'messages'
    ].filter(Boolean).join(', ')

    const themeInfo = info ? ` (${info})` : ''
    console.log(`${prefix}${isLast ? '└──' : '├──'} ${theme.name}${themeInfo}`)

    const newPrefix = prefix + (isLast ? '    ' : '│   ')

    // Display plugin dependencies
    if (theme.plugins && theme.plugins.length > 0) {
      console.log(`${newPrefix}├── plugins: [${theme.plugins.join(', ')}]`)
    }

    // Display assets if present
    if (theme.hasAssets) {
      console.log(`${newPrefix}├── assets`)
    }

    // Display messages if present
    if (theme.hasMessages) {
      console.log(`${newPrefix}├── messages`)
    }

    // Display styles if present
    if (theme.hasStyles) {
      console.log(`${newPrefix}├── styles`)
    }

    // Display components if present
    if (theme.hasComponents) {
      console.log(`${newPrefix}├── components`)
    }

    // Display entities
    if (theme.entities && theme.entities.length > 0) {
      console.log(`${newPrefix}├── entities [${theme.entities.length}]`)
      const entityTree = buildEntityTree(theme.entities)
      displayEntityTree(entityTree, newPrefix + '│   ', false)
    }

    // Display routes
    if (theme.routeFiles && theme.routeFiles.length > 0) {
      console.log(`${newPrefix}└── api [${theme.routeFiles.length} routes]`)
      theme.routeFiles.forEach((route, routeIndex) => {
        const isLastRoute = routeIndex === theme.routeFiles.length - 1
        const routePrefix = newPrefix + '    '
        console.log(`${routePrefix}${isLastRoute ? '└──' : '├──'} ${route.path}`)
      })
    }
  }

  // Themes section
  if (hasThemes || themes.length === 0) {
    sectionIndex++
    const isLastSection = sectionIndex === totalSections
    console.log(`${getTreeChars(isLastSection && !hasThemes, hasThemes)} themes/`)

    themes.forEach((theme, index) => {
      const isLastTheme = index === themes.length - 1
      const subPrefix = getSubTreeChars(isLastSection && !hasThemes)
      displayThemeTree(theme, subPrefix, isLastTheme)
    })
  }

  console.log()
}
