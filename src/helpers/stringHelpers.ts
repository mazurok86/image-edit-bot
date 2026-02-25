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
  if (lower.includes('temporarily unavailable')) return BOT_TEXTS.ERROR_UNAVAILABLE
  return BOT_TEXTS.ERROR
}
