/**
 * Search Result Highlighting Utilities
 * 
 * Provides utilities for highlighting search matches in text
 * Used by the Search Integration system.
 */

/**
 * Highlights search terms in text by wrapping matches with HTML marks
 */
export function highlightSearchMatches(text: string, searchQuery: string): string {
  if (!text || !searchQuery.trim()) {
    return text
  }

  const query = searchQuery.trim().toLowerCase()
  const lowerText = text.toLowerCase()
  
  // Find all match positions
  const matches: { start: number; end: number }[] = []
  let startIndex = 0
  
  while (true) {
    const matchIndex = lowerText.indexOf(query, startIndex)
    if (matchIndex === -1) break
    
    matches.push({
      start: matchIndex,
      end: matchIndex + query.length
    })
    
    startIndex = matchIndex + 1
  }

  if (matches.length === 0) {
    return text
  }

  // Build highlighted text
  let result = ''
  let lastEnd = 0

  for (const match of matches) {
    // Add text before match
    result += text.slice(lastEnd, match.start)
    
    // Add highlighted match
    result += `<mark class="bg-yellow-200 dark:bg-yellow-800/50 px-0.5 rounded">${text.slice(match.start, match.end)}</mark>`
    
    lastEnd = match.end
  }

  // Add remaining text
  result += text.slice(lastEnd)

  return result
}

/**
 * Highlights multiple search terms in text
 */
export function highlightMultipleTerms(text: string, searchTerms: string[]): string {
  if (!text || !searchTerms.length) {
    return text
  }

  let result = text
  
  // Sort terms by length (longest first) to avoid conflicts
  const sortedTerms = searchTerms
    .filter(term => term.trim().length > 0)
    .sort((a, b) => b.length - a.length)

  for (const term of sortedTerms) {
    result = highlightSearchMatches(result, term)
  }

  return result
}

/**
 * Extracts highlighted snippet from text around search matches
 */
export function getSearchSnippet(
  text: string, 
  searchQuery: string, 
  maxLength: number = 150
): string {
  if (!text || !searchQuery.trim()) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '')
  }

  const query = searchQuery.trim().toLowerCase()
  const lowerText = text.toLowerCase()
  const matchIndex = lowerText.indexOf(query)

  if (matchIndex === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '')
  }

  // Calculate snippet boundaries
  const contextLength = Math.floor((maxLength - query.length) / 2)
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(text.length, matchIndex + query.length + contextLength)

  let snippet = text.slice(start, end)

  // Add ellipsis if needed
  if (start > 0) {
    snippet = '...' + snippet
  }
  if (end < text.length) {
    snippet = snippet + '...'
  }

  return snippet
}

/**
 * React component props for highlighted text
 */
export interface HighlightedTextProps {
  text: string
  searchQuery: string
  className?: string
}

/**
 * Escapes HTML in text before highlighting
 */
export function highlightSearchMatchesSafe(text: string, searchQuery: string): string {
  // Escape HTML first
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  return highlightSearchMatches(escapedText, searchQuery)
}

/**
 * Gets match count for a search query in text
 */
export function getMatchCount(text: string, searchQuery: string): number {
  if (!text || !searchQuery.trim()) {
    return 0
  }

  const query = searchQuery.trim().toLowerCase()
  const lowerText = text.toLowerCase()
  
  let count = 0
  let startIndex = 0
  
  while (true) {
    const matchIndex = lowerText.indexOf(query, startIndex)
    if (matchIndex === -1) break
    
    count++
    startIndex = matchIndex + 1
  }

  return count
}

/**
 * Calculates relevance score for search results
 */
export function calculateRelevanceScore(
  title: string,
  description: string | undefined,
  searchQuery: string
): number {
  if (!searchQuery.trim()) {
    return 0
  }

  let score = 0
  const query = searchQuery.trim().toLowerCase()

  // Title scoring
  const titleLower = title.toLowerCase()
  if (titleLower === query) {
    score += 100 // Exact match
  } else if (titleLower.startsWith(query)) {
    score += 75 // Starts with
  } else if (titleLower.includes(query)) {
    score += 50 // Contains
  }

  // Description scoring
  if (description) {
    const descLower = description.toLowerCase()
    if (descLower.includes(query)) {
      score += 25 // Description contains
    }
  }

  // Word boundary bonus
  const titleWords = titleLower.split(/\s+/)
  const queryWords = query.split(/\s+/)
  
  for (const queryWord of queryWords) {
    if (titleWords.includes(queryWord)) {
      score += 10 // Word match bonus
    }
  }

  return score
}

/**
 * Formats search result for display
 */
export function formatSearchResult(
  title: string,
  description: string | undefined,
  searchQuery: string,
  maxDescLength: number = 100
): {
  highlightedTitle: string
  highlightedDescription: string | undefined
  snippet: string | undefined
} {
  const highlightedTitle = highlightSearchMatchesSafe(title, searchQuery)
  
  let highlightedDescription: string | undefined
  let snippet: string | undefined

  if (description) {
    if (description.length > maxDescLength) {
      snippet = getSearchSnippet(description, searchQuery, maxDescLength)
      highlightedDescription = highlightSearchMatchesSafe(snippet, searchQuery)
    } else {
      highlightedDescription = highlightSearchMatchesSafe(description, searchQuery)
    }
  }

  return {
    highlightedTitle,
    highlightedDescription,
    snippet
  }
}