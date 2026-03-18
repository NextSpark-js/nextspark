import { queryWithRLS } from "@nextsparkjs/core/lib/db";
import { withRateLimitTier } from "@nextsparkjs/core/lib/api/rate-limit";
import { isRedisConfigured } from "@nextsparkjs/core/lib/rate-limit-redis";
import { NextResponse } from "next/server";

export const GET = withRateLimitTier(async () => {
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbError: string | undefined;

  try {
    await queryWithRLS('SELECT 1');
    dbStatus = 'connected';
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Unknown error';
    console.error('[health] Database connection failed:', error);
  }

  const redisConfigured = await isRedisConfigured();

  if (!redisConfigured) {
    console.error('[health] CRITICAL: Redis not configured — rate limiting is DISABLED. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment variables.');
  }

  const healthy = dbStatus === 'connected';

  return NextResponse.json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      rateLimit: redisConfigured ? 'redis' : 'disabled',
      api: 'operational',
    },
    ...(dbError ? { error: dbError } : {}),
  }, { status: healthy ? 200 : 503 });
}, 'read');

