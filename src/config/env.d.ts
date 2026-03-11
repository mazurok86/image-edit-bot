declare namespace NodeJS {
  interface ProcessEnv {
    REPLICATE_AUTH?: string
    TELEGRAM_BOT_TOKEN?: string
    TELEGRAM_BASE_API_URL?: string
    YANDEX_TRANSLATE_FOLDER_ID?: string
    YANDEX_TRANSLATE_API_KEY?: string
    ALLOWED_CHAT_IDS?: string
    REDIS_URL?: string
    REDIS_KEY_PREFIX?: string
  }
}
