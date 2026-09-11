import { BOT_TEXTS } from '../constants/botTexts.js'

export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

export function containsCyrillic(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text)
}

export function mapReplicateError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('flagged as sensitive')) return BOT_TEXTS.ERROR_FLAGGED_SENSITIVE
  if (lower.includes('sexual')) return BOT_TEXTS.ERROR_SEXUAL_CONTENT
  if (lower.includes('high demand')) return BOT_TEXTS.ERROR_HIGH_DEMAND
  if (lower.includes('queue is full')) return BOT_TEXTS.ERROR_HIGH_DEMAND
  if (lower.includes('no complete upper body')) return BOT_TEXTS.ERROR_NO_BODY
  if (lower.includes('temporarily unavailable')) return BOT_TEXTS.ERROR_UNAVAILABLE
  if (lower.includes('video duration must not exceed 10 seconds')) return BOT_TEXTS.ERROR_VIDEO_EXCEED_10_SECONDS
  if (lower.includes('video duration must not exceed 30 seconds')) return BOT_TEXTS.ERROR_VIDEO_EXCEED_30_SECONDS
  if (lower.includes('interrupted')) return BOT_TEXTS.ERROR_INTERRUPTED
  return BOT_TEXTS.ERROR
}

/** Telegram bot tokens (`<digits>:<35 url-safe chars>`) appear in file URLs that are passed to Replicate and may be echoed in its errors. */
const TELEGRAM_BOT_TOKEN_PATTERN = /\d{6,12}:[A-Za-z0-9_-]{30,}/g

export function redactBotTokens(text: string): string {
  return text.replace(TELEGRAM_BOT_TOKEN_PATTERN, '<bot-token>')
}

/** Truncates by code point (not UTF-16 unit) so a surrogate pair is never split. */
export function truncate(text: string, maxLength: number): string {
  const chars = Array.from(text)
  if (chars.length <= maxLength) {
    return text
  }
  return `${chars.slice(0, maxLength - 1).join('')}…`
}
