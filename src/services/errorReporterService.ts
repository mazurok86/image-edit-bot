import TelegramBot from 'node-telegram-bot-api'
import { redactBotTokens, truncate } from '../helpers/stringHelpers.js'

/** Telegram rejects sendMessage text longer than this with 400 "message is too long". */
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096
/** node-telegram-bot-api sets no HTTP timeout by default; a blackholed api.telegram.org would otherwise hang each report for minutes. */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * Sends error reports to the admin chat through the technical (admin) bot.
 * Never throws: reporting must not break the flow that is already handling an error.
 */
export class ErrorReporterService {
  private readonly bot: TelegramBot
  private readonly chatId: number

  constructor(token: string, chatId: number) {
    // @types/node-telegram-bot-api declares `request` as a full request.Options (uri/url required),
    // but the library sets the URL for every call itself; only the timeout is meaningful here.
    const requestOptions = { timeout: REQUEST_TIMEOUT_MS } as NonNullable<TelegramBot.ConstructorOptions['request']>
    this.bot = new TelegramBot(token, { polling: false, request: requestOptions })
    this.chatId = chatId
  }

  async report(text: string): Promise<void> {
    const safeText = truncate(redactBotTokens(text), TELEGRAM_MAX_MESSAGE_LENGTH)
    try {
      await this.bot.sendMessage(this.chatId, safeText)
    } catch (err: unknown) {
      // Log only the message: Telegram errors carry the full request, whose URL contains the admin bot token.
      const reason = err instanceof Error ? err.message : String(err)
      console.error(`Failed to report error to admin chat ${this.chatId}: ${reason}`)
    }
  }
}
