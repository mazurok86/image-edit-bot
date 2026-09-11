import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { ReplicateService } from './services/replicateService.js'
import { BotService } from './services/botService.js'
import { YandexTranslateService } from './services/yandexTranslateService.js'
import { RedisService } from './services/redisService.js'
import { ErrorReporterService } from './services/errorReporterService.js'
import { ChatRegistry } from './state/chatRegistry.js'

dotenv.config()

if (process.env.REPLICATE_AUTH === undefined) throw new Error('REPLICATE_AUTH is missing')
if (process.env.TELEGRAM_BOT_TOKEN === undefined) throw new Error('TELEGRAM_BOT_TOKEN is missing')
if (process.env.TELEGRAM_BASE_API_URL === undefined) throw new Error('TELEGRAM_BASE_API_URL is missing')
if (process.env.TELEGRAM_ADMIN_BOT_TOKEN === undefined || process.env.TELEGRAM_ADMIN_BOT_TOKEN.trim() === '') {
  throw new Error('TELEGRAM_ADMIN_BOT_TOKEN is missing')
}
if (process.env.TELEGRAM_ADMIN_CHAT_ID === undefined) throw new Error('TELEGRAM_ADMIN_CHAT_ID is missing')
if (process.env.YANDEX_TRANSLATE_FOLDER_ID === undefined) throw new Error('YANDEX_TRANSLATE_FOLDER_ID is missing')
if (process.env.YANDEX_TRANSLATE_API_KEY === undefined) throw new Error('YANDEX_TRANSLATE_API_KEY is missing')
if (process.env.ALLOWED_CHAT_IDS === undefined) throw new Error('ALLOWED_CHAT_IDS is missing')
if (process.env.REDIS_URL === undefined) throw new Error('REDIS_URL is missing')
if (process.env.REDIS_KEY_PREFIX === undefined) throw new Error('REDIS_KEY_PREFIX is missing')

/** Parses a Telegram chat id, rejecting empty, non-integer and unsafe values so misconfiguration fails at startup. */
function parseChatId(envName: string, raw: string): number {
  const trimmed = raw.trim()
  const id = Number(trimmed)
  if (!/^-?\d+$/.test(trimmed) || !Number.isSafeInteger(id)) {
    throw new Error(`${envName} contains an invalid chat id: "${raw}"`)
  }
  return id
}

const allowedChatIds = process.env.ALLOWED_CHAT_IDS.split(',')
  .filter((id) => id.trim() !== '')
  .map((id) => parseChatId('ALLOWED_CHAT_IDS', id))

if (allowedChatIds.length === 0) {
  throw new Error('ALLOWED_CHAT_IDS is empty')
}

const adminChatId = parseChatId('TELEGRAM_ADMIN_CHAT_ID', process.env.TELEGRAM_ADMIN_CHAT_ID)

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true, baseApiUrl: process.env.TELEGRAM_BASE_API_URL })
const errorReporter = new ErrorReporterService(process.env.TELEGRAM_ADMIN_BOT_TOKEN, adminChatId)
const yandexTranslateService = new YandexTranslateService(process.env.YANDEX_TRANSLATE_FOLDER_ID, process.env.YANDEX_TRANSLATE_API_KEY)
const replicateService = new ReplicateService(process.env.REPLICATE_AUTH)
const redisService = new RedisService(process.env.REDIS_URL, process.env.REDIS_KEY_PREFIX)
await redisService.connect()
const store = new ChatRegistry(redisService)
const botService = new BotService(bot, store, yandexTranslateService, replicateService, allowedChatIds, errorReporter)
botService.start()
