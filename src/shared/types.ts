/**
 * 도메인 타입. chrome.storage.local에 버저닝되어 있다 (storage.ts의 SCHEMA_VERSION).
 * 스키마 변경 시 storage.ts의 mergeState에 migration 분기 추가.
 */

export type Platform = 'youtube' | 'instagram' | 'x' | 'tiktok';

export type AiProvider = 'openai' | 'gemini' | 'claude' | 'openrouter';

export interface ApiKeys {
  // YouTube Data API v3 키 — BYOK (사용자가 Google Cloud Console에서 발급).
  youtube: string | null;
  youtubeVerifiedAt: number | null;

  // AI 제공자 (요약·클러스터링용).
  aiProvider: AiProvider;
  aiKey: string | null;
  aiModel: string;
  aiVerifiedAt: number | null;

  // 확장 플랫폼용 (S/L 단계) — 3자 서비스 키.
  xpoz: string | null; // Instagram/X/TikTok 통합
}

export interface NicheCategory {
  id: string;
  label: string;
  emoji: string;
  isPreset: boolean;
  keywords: string[]; // 실제 YouTube 검색에 사용
  language: string; // 'en' | 'ko' | 'ja' | 'zh' | 'auto'
  regionCode?: string; // 예: 'KR', 'US' — YouTube 검색 지역 편향
}

export interface CreatorRef {
  platform: Platform;
  platformId: string; // YouTube channel ID, IG handle 등
  handle: string;
  title: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  addedAt: number;
  source: 'auto' | 'manual'; // 발굴 방식
}

export interface VideoMeta {
  platform: Platform;
  platformId: string; // YouTube videoId
  creatorId: string; // CreatorRef.platformId 참조
  title: string;
  description?: string;
  publishedAt: string; // ISO
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  thumbnailUrl?: string;
  url: string;
  fetchedAt: number;
}

export interface BriefCluster {
  id: string;
  label: string; // AI가 생성한 2~4 단어 라벨
  videoIds: string[]; // VideoMeta.platformId 참조
  isGap: boolean; // 내 채널에서 다루지 않은 주제
}

export interface DailyBrief {
  categoryId: string;
  generatedAt: number;
  summary: string; // 5문장 AI 요약
  clusters: BriefCluster[];
}

export interface License {
  paid: boolean;
  purchasedAt: number | null;
  // 차기: 멀티 플랫폼 애드온($49)
  addonMultiPlatform: boolean;
}

export interface Settings {
  activeCategoryId: string | null;
  autoRefreshHour: number; // 0~23 — chrome.alarms 스케줄
  language: string; // UI 언어
}

export interface StorageSchema {
  version: number;
  apiKeys: ApiKeys;
  categories: NicheCategory[];
  watchlist: CreatorRef[];
  videoCache: VideoMeta[];
  briefs: DailyBrief[]; // 최근 7일치만 유지
  license: License;
  settings: Settings;
}
