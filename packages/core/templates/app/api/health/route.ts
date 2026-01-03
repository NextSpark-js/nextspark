import { queryWithRLS } from "@nextsparkjs/core/lib/db";

export async function GET() {
  try {
    // Test database connection
    await queryWithRLS('SELECT 1');
    
    return Response.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'operational'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return Response.json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      services: {
        database: 'disconnected',
        api: 'operational'
      }
    }, { status: 503 });
  }
}

