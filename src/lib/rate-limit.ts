import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Scope = "login" | "register" | "transfer";
const policies = {
  login: { limit: 5, window: "15 m" },
  register: { limit: 3, window: "1 h" },
  transfer: { limit: 10, window: "1 m" }
} as const;
let redis: Redis | null = null;
const limiters = new Map<Scope, Ratelimit>();

export async function enforceRateLimit(request: Request, scope: Scope) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { allowed: process.env.NODE_ENV !== "production", unavailable: true };
  redis ??= new Redis({ url, token });
  let limiter = limiters.get(scope);
  if (!limiter) {
    const policy = policies[scope];
    limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(policy.limit, policy.window), analytics: false, prefix: "nairanest:" + scope });
    limiters.set(scope, limiter);
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const result = await limiter.limit(ip);
  return { allowed: result.success, unavailable: false, remaining: result.remaining, reset: result.reset };
}
