import type { ApiEnv } from "./env.js";
import type { RateLimitOptions } from "../middleware/rate-limit.js";

export interface AuthConfig {
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  cookieName: string;
  /** Only true when the API is served over HTTPS. */
  cookieSecure: boolean;
  /** bcrypt cost. Lowered only for NODE_ENV=test so suites stay fast. */
  passwordHashRounds: number;
  credentialRateLimit: RateLimitOptions;
  refreshRateLimit: RateLimitOptions;
}

export interface DocumentConfig {
  localStoragePath: string;
  maxUploadBytes: number;
  maxExtractedCharacters: number;
  jobMode: "inline" | "redis" | "manual";
  redisUrl: string;
  jobMaxAttempts: number;
  jobBackoffMs: number;
  dailyAiQuota: number;
  targetQuestionCount: number;
  uploadRateLimit: RateLimitOptions;
  aiRateLimit: RateLimitOptions;
}

export interface AppConfig {
  webOrigin: string;
  auth: AuthConfig;
  documents: DocumentConfig;
}

const PASSWORD_HASH_ROUNDS = 12;
const TEST_PASSWORD_HASH_ROUNDS = 4;

/** Register/login are the cheapest endpoints to abuse, so they are the tightest. */
const CREDENTIAL_RATE_LIMIT: RateLimitOptions = { windowMs: 15 * 60 * 1000, max: 10 };
const REFRESH_RATE_LIMIT: RateLimitOptions = { windowMs: 15 * 60 * 1000, max: 60 };
const DOCUMENT_UPLOAD_RATE_LIMIT: RateLimitOptions = { windowMs: 15 * 60 * 1000, max: 30 };
const DOCUMENT_AI_RATE_LIMIT: RateLimitOptions = { windowMs: 15 * 60 * 1000, max: 20 };

/** Tests exercise many logins from one address, so the limiter is loosened. */
const TEST_RATE_LIMIT: RateLimitOptions = { windowMs: 60 * 1000, max: 10_000 };

export function createAppConfig(env: ApiEnv): AppConfig {
  const isTest = env.NODE_ENV === "test";

  return {
    webOrigin: env.WEB_ORIGIN,
    auth: {
      accessTokenSecret: env.AUTH_ACCESS_TOKEN_SECRET,
      accessTokenTtlSeconds: env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: env.AUTH_REFRESH_TOKEN_TTL_DAYS,
      cookieName: env.AUTH_COOKIE_NAME,
      cookieSecure: env.NODE_ENV === "production",
      passwordHashRounds: isTest ? TEST_PASSWORD_HASH_ROUNDS : PASSWORD_HASH_ROUNDS,
      credentialRateLimit: isTest ? TEST_RATE_LIMIT : CREDENTIAL_RATE_LIMIT,
      refreshRateLimit: isTest ? TEST_RATE_LIMIT : REFRESH_RATE_LIMIT,
    },
    documents: {
      localStoragePath: env.STORAGE_LOCAL_PATH,
      maxUploadBytes: env.DOCUMENT_UPLOAD_MAX_BYTES,
      maxExtractedCharacters: env.DOCUMENT_EXTRACTED_TEXT_MAX_CHARACTERS,
      jobMode: env.DOCUMENT_JOB_MODE,
      redisUrl: env.REDIS_URL,
      jobMaxAttempts: env.DOCUMENT_JOB_MAX_ATTEMPTS,
      jobBackoffMs: env.DOCUMENT_JOB_BACKOFF_MS,
      dailyAiQuota: env.DOCUMENT_AI_DAILY_QUOTA,
      targetQuestionCount: env.DOCUMENT_TARGET_QUESTION_COUNT,
      uploadRateLimit: isTest ? TEST_RATE_LIMIT : DOCUMENT_UPLOAD_RATE_LIMIT,
      aiRateLimit: isTest ? TEST_RATE_LIMIT : DOCUMENT_AI_RATE_LIMIT,
    },
  };
}
