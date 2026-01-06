/**
 * Mock for AI SDK (vercel/ai)
 */

module.exports = {
  generateText: jest.fn().mockResolvedValue({
    text: 'Mocked AI response',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
  }),
  streamText: jest.fn().mockImplementation(async function* () {
    yield { text: 'Mocked ', done: false }
    yield { text: 'stream ', done: false }
    yield { text: 'response', done: true }
  }),
  generateObject: jest.fn().mockResolvedValue({
    object: { result: 'mocked' }
  }),
}
