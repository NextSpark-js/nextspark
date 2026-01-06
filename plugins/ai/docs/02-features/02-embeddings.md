---
title: Text Embeddings
description: Generate and use text embeddings for semantic search
---

# Text Embeddings

Text embeddings convert text into high-dimensional vectors that capture semantic meaning, enabling powerful search and recommendation features.

## What are Embeddings?

Embeddings are numerical representations of text where similar concepts are close together in vector space. This enables:

- **Semantic Search**: Find content by meaning, not just keywords
- **Recommendations**: Suggest similar content based on semantic similarity
- **Clustering**: Group related documents automatically
- **Anomaly Detection**: Identify unusual or out-of-place content

## Generating Embeddings

### Basic Example

```typescript
import { openai } from '@/plugins/ai/lib/openai'

async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })

  return response.data[0].embedding
}

// Usage
const embedding = await generateEmbedding(
  'This is a sample text to embed'
)

console.log(embedding) // [0.123, -0.456, 0.789, ...]
```

### Batch Processing

Process multiple texts efficiently:

```typescript
async function batchEmbeddings(texts: string[]) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts
  })

  return response.data.map(d => d.embedding)
}

// Generate embeddings for multiple documents
const embeddings = await batchEmbeddings([
  'First document text',
  'Second document text',
  'Third document text'
])
```

## Semantic Search

Implement semantic search with vector similarity:

```typescript
import { cosineSimilarity } from '@/plugins/ai/lib/utils'

async function semanticSearch(query: string, documents: Document[]) {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query)

  // Calculate similarity scores
  const results = documents.map(doc => ({
    document: doc,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding)
  }))

  // Sort by similarity (highest first)
  results.sort((a, b) => b.similarity - a.similarity)

  return results.slice(0, 10) // Top 10 results
}

// Usage
const results = await semanticSearch(
  'How do I configure authentication?',
  allDocuments
)
```

## Vector Database Integration

Store and query embeddings efficiently using a vector database:

### Pinecone Example

```typescript
import { Pinecone } from '@pinecone-database/pinecone'

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
})

const index = pinecone.index('documentation')

// Upsert embeddings
await index.upsert([
  {
    id: 'doc-1',
    values: embedding,
    metadata: {
      title: 'Getting Started',
      content: 'How to get started...',
      url: '/docs/getting-started'
    }
  }
])

// Query similar vectors
const queryResults = await index.query({
  vector: queryEmbedding,
  topK: 10,
  includeMetadata: true
})
```

### Supabase pgvector Example

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

// Store embedding
await supabase.from('documents').insert({
  content: 'Document content',
  embedding: embedding
})

// Semantic search with pgvector
const { data } = await supabase.rpc('match_documents', {
  query_embedding: queryEmbedding,
  match_threshold: 0.7,
  match_count: 10
})
```

## Use Cases

### 1. Documentation Search

```typescript
// Build searchable documentation
const docs = await getAllDocs()

for (const doc of docs) {
  const embedding = await generateEmbedding(doc.content)
  await saveEmbedding(doc.id, embedding)
}

// Search
const results = await semanticSearch('How to deploy?', docs)
```

### 2. Content Recommendations

```typescript
// Recommend similar articles
async function recommendSimilar(articleId: string, limit = 5) {
  const article = await getArticle(articleId)
  const similar = await semanticSearch(article.content, allArticles)

  return similar
    .filter(r => r.document.id !== articleId)
    .slice(0, limit)
}
```

### 3. Duplicate Detection

```typescript
// Find duplicate or very similar content
async function findDuplicates(threshold = 0.95) {
  const duplicates = []

  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const similarity = cosineSimilarity(
        documents[i].embedding,
        documents[j].embedding
      )

      if (similarity > threshold) {
        duplicates.push([documents[i], documents[j], similarity])
      }
    }
  }

  return duplicates
}
```

## Best Practices

1. **Chunk long documents** into smaller pieces (max 8191 tokens)
2. **Cache embeddings** - they don't change for the same text
3. **Use batch processing** for multiple texts to reduce API calls
4. **Choose the right model**:
   - `text-embedding-3-small`: Faster, cheaper, good for most cases
   - `text-embedding-3-large`: Higher accuracy, more expensive
5. **Store embeddings efficiently** using a vector database
6. **Update embeddings** when content changes

## Performance Tips

```typescript
// Process in parallel with rate limiting
import pLimit from 'p-limit'

const limit = pLimit(5) // Max 5 concurrent requests

const embeddings = await Promise.all(
  documents.map(doc =>
    limit(() => generateEmbedding(doc.content))
  )
)
```

## Cost Optimization

- `text-embedding-3-small`: ~$0.02 per 1M tokens
- `text-embedding-3-large`: ~$0.13 per 1M tokens
- Cache embeddings to avoid regenerating
- Use smaller models when accuracy difference is minimal
