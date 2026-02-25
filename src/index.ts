import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { ChatStore } from './state/chatStore.js'
import { ReplicateService } from './services/replicateService.js'
import { BotService } from './services/botService.js'
import { YandexTranslateService } from './services/yandexTranslateService.js'
import { RedisService } from './services/redisService.js'

dotenv.config()

if (process.env.REPLICATE_AUTH === undefined) throw new Error('REPLICATE_AUTH is missing')
if (process.env.TELEGRAM_BOT_TOKEN === undefined) throw new Error('TELEGRAM_BOT_TOKEN is missing')
if (process.env.YANDEX_TRANSLATE_FOLDER_ID === undefined) throw new Error('YANDEX_TRANSLATE_FOLDER_ID is missing')
if (process.env.YANDEX_TRANSLATE_API_KEY === undefined) throw new Error('YANDEX_TRANSLATE_API_KEY is missing')
if (process.env.ALLOWED_CHAT_IDS === undefined) throw new Error('ALLOWED_CHAT_IDS is missing')
if (process.env.REDIS_URL === undefined) throw new Error('REDIS_URL is missing')
if (process.env.REDIS_KEY_PREFIX === undefined) throw new Error('REDIS_KEY_PREFIX is missing')

const allowedChatIds = process.env.ALLOWED_CHAT_IDS.split(',').map((id) => Number(id.trim()))

if (allowedChatIds.length === 0) {
  throw new Error('ALLOWED_CHAT_IDS is empty')
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })
const store = new ChatStore()
const yandexTranslateService = new YandexTranslateService(process.env.YANDEX_TRANSLATE_FOLDER_ID, process.env.YANDEX_TRANSLATE_API_KEY)
const replicateService = new ReplicateService(process.env.REPLICATE_AUTH)
const redisService = new RedisService(process.env.REDIS_URL, process.env.REDIS_KEY_PREFIX)
await redisService.connect()

const botService = new BotService(bot, store, yandexTranslateService, replicateService, allowedChatIds)
botService.start()
