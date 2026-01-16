import { queryWithRLS } from "@nextsparkjs/core/lib/db";
import { withRateLimitTier } from "@nextsparkjs/core/lib/api/rate-limit";
import { NextResponse } from "next/server";

export const GET = withRateLimitTier(async () => {
  try {
    // Test database connection
    await queryWithRLS('SELECT 1');
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'operational'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      services: {
        database: 'disconnected',
        api: 'operational'
      }
    }, { status: 503 });
  }
}, 'read');

