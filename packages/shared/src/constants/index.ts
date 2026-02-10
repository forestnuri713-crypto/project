/**
 * 환불 정책 비율
 * 활동 2일 전: 100% 환불
 * 활동 1일 전: 50% 환불
 * 당일: 환불 불가
 */
export const REFUND_POLICY = {
  DAYS_BEFORE_2: 1.0,
  DAYS_BEFORE_1: 0.5,
  SAME_DAY: 0,
} as const;

/** 가예약(Soft-lock) 유효 시간 (밀리초) */
export const SOFT_LOCK_DURATION_MS = 5 * 60 * 1000;

/** 활동 전 알림 발송 시간 (시간 단위) */
export const PRE_ACTIVITY_NOTIFICATION_HOURS = 24;

/** Redis 분산 락 TTL (밀리초) */
export const REDIS_LOCK_TTL_MS = 5000;

/** Redis 분산 락 재시도 간격 (밀리초) */
export const REDIS_LOCK_RETRY_INTERVAL_MS = 100;

/** Redis 분산 락 최대 재시도 횟수 */
export const REDIS_LOCK_MAX_RETRIES = 50;

/** 갤러리 Signed URL 만료 시간 (초) */
export const GALLERY_SIGNED_URL_EXPIRES_IN = 3600;

/** 갤러리 업로드 Pre-signed URL 만료 시간 (초) */
export const GALLERY_UPLOAD_URL_EXPIRES_IN = 600;

/** 썸네일 최대 너비 (px) */
export const THUMBNAIL_MAX_WIDTH = 400;

/** 썸네일 품질 (1-100) */
export const THUMBNAIL_QUALITY = 80;

/** 플랫폼 수수료율 (10%) */
export const PLATFORM_FEE_RATE = 0.10;

/** 알림톡 건당 비용 (원) */
export const NOTIFICATION_COST_PER_MESSAGE = 15;

/** B2B 기본 수수료율 (5%) */
export const DEFAULT_B2B_COMMISSION_RATE = 0.05;

/** 정산 크론 표현식: 매주 목요일 02:00 */
export const SETTLEMENT_CRON_EXPRESSION = '0 2 * * 4';

/** 정산 분산 락 키 접두사 */
export const SETTLEMENT_LOCK_KEY_PREFIX = 'settlement:lock:';

/** 정산 분산 락 TTL (밀리초) - 5분 */
export const SETTLEMENT_LOCK_TTL_MS = 5 * 60 * 1000;

/** 자동 출석 체크 반경 (미터) */
export const AUTO_CHECKIN_RADIUS_METERS = 100;

/** 자동 출석 체크 시간 범위 (분) — 프로그램 시작 시간 전후 */
export const AUTO_CHECKIN_TIME_WINDOW_MINUTES = 30;

/** 업체 커버 이미지 Pre-signed URL 만료 시간 (초) */
export const PROVIDER_COVER_UPLOAD_URL_EXPIRES_IN = 600;

/** 업체 커버 이미지 최대 개수 */
export const PROVIDER_COVER_MAX_COUNT = 3;

/** 업체 연락처 링크 최대 개수 */
export const PROVIDER_CONTACT_LINKS_MAX_COUNT = 3;

/** 업체 한줄 소개 최대 길이 */
export const PROVIDER_INTRO_SHORT_MAX_LENGTH = 40;
