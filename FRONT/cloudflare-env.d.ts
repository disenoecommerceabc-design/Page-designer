declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

declare namespace Cloudflare {
 interface Env {
  KIE_API_KEY?: string;
  AI_ENABLED?: string;
  AI_ALLOW_GUESTS?: string;
  KIE_TEXT_MODEL?: string;
  KIE_DESIGN_MODEL?: string;
  KIE_IMAGE_VARIANT?: string;
  KIE_IMAGE_RESOLUTION?: string;
  KIE_ASSET_HOSTS?: string;
  AI_USER_DAILY_CREDITS?: string;
  AI_GLOBAL_DAILY_CREDITS?: string;
  AI_DAILY_REQUESTS?: string;
  AI_COOLDOWN_SECONDS?: string;
 }
}
