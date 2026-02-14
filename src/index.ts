import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import { ChatStore } from './state/chatStore.js'
import { ReplicateService } from './services/replicateService.js'
import { BotService } from './services/botService.js'

dotenv.config()

if (process.env.REPLICATE_AUTH === undefined) throw new Error('REPLICATE_AUTH не задан')
if (process.env.TELEGRAM_BOT_TOKEN === undefined) throw new Error('TELEGRAM_BOT_TOKEN не задан')
if (process.env.ALLOWED_CHAT_IDS === undefined) throw new Error('ALLOWED_CHAT_IDS не задан')

const allowedChatIds = process.env.ALLOWED_CHAT_IDS.split(',').map(id => Number(id.trim()))

if (allowedChatIds.length === 0) {
  throw new Error('ALLOWED_CHAT_IDS пуст')
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })
const store = new ChatStore()
const replicateService = new ReplicateService(process.env.REPLICATE_AUTH)
const botService = new BotService(bot, store, replicateService, allowedChatIds)

botService.start()
