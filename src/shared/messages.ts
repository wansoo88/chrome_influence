import type { ApiKeys, DailyBrief } from './types';

/**
 * UI ↔ Background 메시지 프로토콜.
 * discriminated union으로 타입 좁힘 단순화.
 */

export interface DiscoverCreatorsRequest {
  kind: 'discoverCreators';
  categoryId: string;
}

export interface GenerateBriefRequest {
  kind: 'generateBrief';
  categoryId: string;
  forceRefresh?: boolean;
}

export interface VerifyKeyRequest {
  kind: 'verifyKey';
  target: 'youtube' | 'ai';
  keys: Partial<ApiKeys>;
}

export interface PingRequest {
  kind: 'ping';
}

export type ClientMsg =
  | DiscoverCreatorsRequest
  | GenerateBriefRequest
  | VerifyKeyRequest
  | PingRequest;

export type ErrorCode =
  | 'YT_KEY_MISSING'
  | 'YT_KEY_INVALID'
  | 'YT_QUOTA_EXCEEDED'
  | 'AI_KEY_MISSING'
  | 'AI_KEY_INVALID'
  | 'AI_RATE_LIMIT'
  | 'AI_NO_CREDIT'
  | 'CATEGORY_MISSING'
  | 'UNKNOWN';

export interface DiscoverOk {
  kind: 'discoverOk';
  ok: true;
  added: number; // 신규 추가된 크리에이터 수
  total: number;
}

export interface BriefOk {
  kind: 'briefOk';
  ok: true;
  brief: DailyBrief;
}

export interface VerifyOk {
  kind: 'verifyOk';
  ok: true;
}

export interface Pong {
  kind: 'pong';
  ok: true;
  version: string;
}

export interface ServerErr {
  kind: 'error';
  ok: false;
  code: ErrorCode;
  message: string;
  details?: string;
}

export type ServerMsg = DiscoverOk | BriefOk | VerifyOk | Pong | ServerErr;

export function asServerErr(
  code: ErrorCode,
  message: string,
  details?: string,
): ServerErr {
  return { kind: 'error', ok: false, code, message, details };
}
