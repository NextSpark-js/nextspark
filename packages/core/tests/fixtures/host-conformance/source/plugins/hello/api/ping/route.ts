export async function GET() {
  return Response.json({ plugin: 'hello', pong: true })
}
