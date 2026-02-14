declare namespace NodeJS {
  interface ProcessEnv {
    REPLICATE_AUTH?: string
    TELEGRAM_BOT_TOKEN?: string
    ALLOWED_CHAT_IDS?: string
  }
}
