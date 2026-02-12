import Replicate from 'replicate'
import TelegramBot from 'node-telegram-bot-api'
import { buffer } from 'node:stream/consumers'
import convert from 'heic-convert'
import dotenv from 'dotenv'

dotenv.config();

const FILE_TYPE_IMAGE = 0;
const FILE_TYPE_VIDEO = 1;

const REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro'
const REPLICATE_SEEDREAM_MODEL = 'bytedance/seedream-4'
const REPLICATE_KLING_MODEL = 'kwaivgi/kling-v2.1'
const REPLICATE_KLING_MOTION_CONTROL_MODEL = 'kwaivgi/kling-v2.6-motion-control'
const REPLICATE_AUTH = process.env.REPLICATE_AUTH
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const MODEL_FLUX = 'FLUX.1 Kontext'
const MODEL_FLUX_9_16 = 'FLUX.1 Kontext (9:16)'
const MODEL_SEEDREAM = 'Seedream v4 (4:3)'
const MODEL_SEEDREAM_9_16 = 'Seedream v4 (9:16)'
const MODEL_KLING = 'Kling v2.1 (5s 720p video)'
const MODEL_KLING_MOTION_CONTROL = 'Kling v2.6 (motion control)'

const MODELS = [MODEL_FLUX, MODEL_FLUX_9_16, MODEL_SEEDREAM, MODEL_SEEDREAM_9_16, MODEL_KLING, MODEL_KLING_MOTION_CONTROL]

const replicate = new Replicate({
  auth: REPLICATE_AUTH,
  userAgent: 'https://www.npmjs.com/package/create-replicate'
})

const isBusy = new Set()
const chatPrompts = new Map()
const chatImageFiles = new Map()
const chatVideoFiles = new Map()
const chatHandles = new Map()
const chatResponseHandles = new Map()

console.log('Running...')

const isRecord = (obj) => {
  if (typeof obj !== 'object') {
    return false
  }
  if (Array.isArray(obj) || obj === null) {
    return false
  }
  if (Object.getOwnPropertySymbols(obj).length > 0) {
    return false
  }
  return true
}

const addFile = (chatId, file, fileType) => {
  const handle = chatHandles.get(chatId)
  if (typeof handle !== undefined) {
    clearTimeout(handle)
    chatHandles.delete(chatId)
  }

  if (fileType === FILE_TYPE_IMAGE) {
    const files = chatImageFiles.get(chatId)
    if (typeof files === 'undefined') {
      chatImageFiles.set(chatId, [file])
    } else {
      files.push(file)
    }
  } else if (fileType === FILE_TYPE_VIDEO) {
    const files = chatVideoFiles.get(chatId)
    if (typeof files === 'undefined') {
      chatVideoFiles.set(chatId, [file])
    } else {
      files.push(file)
    }
  }

  chatHandles.set(
    chatId,
    setTimeout(
      () => {
        chatPrompts.delete(chatId)
        chatImageFiles.delete(chatId)
        chatVideoFiles.delete(chatId)
      },
      3600000
    )
  )
}

const checkPrompt = async (chatId) => {
  const imageFiles = chatImageFiles.get(chatId)
  const videoFiles = chatVideoFiles.get(chatId)
  const prompt = chatPrompts.get(chatId)

  const keyboard = []
  let text = null

  const hasPrompt = typeof prompt !== 'undefined'
  const hasImages = typeof imageFiles !== 'undefined'
  const hasVideo = typeof videoFiles !== 'undefined'

  if (!hasImages && !hasVideo) {
    text = 'Загрузите один или несколько файлов.'
  } else if ((!hasPrompt && !hasVideo) || (hasVideo && !hasImages)) {
    text = ''
    if (hasImages) {
      text += 'Загружено изображений: ' + imageFiles.length + '\n'
    }
    if (hasVideo) {
      text += 'Загружено видео: ' + videoFiles.length + '\n'
    }
    if (hasVideo && !hasImages) {
      text += 'Загрузите изображение или введите текст запроса.'
    } else {
      text += 'Загрузите еще или введите текст запроса.'
    }
    keyboard.push(['🗑 Очистить'])
  }

  if (text !== null) {
    await bot.sendMessage(
      chatId,
      text,
      {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    )
    return false
  }

  return true
}

const onPrompt = (chatId, delay = 0) => {
  const handle = chatResponseHandles.get(chatId)
  if (typeof handle !== undefined) {
    clearTimeout(handle)
    chatResponseHandles.delete(chatId)
  }
  chatResponseHandles.set(
    chatId,
    setTimeout(
      async () => {
        try {
          const ok = await checkPrompt(chatId)
          if (ok) {
            const imageFiles = chatImageFiles.get(chatId)
            const videoFiles = chatVideoFiles.get(chatId)

            const hasImages = typeof imageFiles !== 'undefined'
            const hasVideo = typeof videoFiles !== 'undefined'

            const keyboard = []
            keyboard.push(['🗑 Очистить'])

            if (hasVideo) {
              keyboard.push([MODEL_KLING_MOTION_CONTROL])
            } else {
              keyboard.push([MODEL_FLUX, MODEL_FLUX_9_16])
              keyboard.push([MODEL_SEEDREAM, MODEL_SEEDREAM_9_16])
              keyboard.push([MODEL_KLING])
            }

            let text = ''

            if (hasImages) {
              text += 'Загружено изображений: ' + imageFiles.length + '\n'
            }
            if (hasVideo) {
              text += 'Загружено видео: ' + videoFiles.length + '\n'
            }

            text += 'Выберите модель или введите текст запроса.'

            await bot.sendMessage(
              chatId,
              text,
              {
                reply_markup: {
                  keyboard,
                  resize_keyboard: true,
                  one_time_keyboard: true
                }
              }
            )
          }
        } catch (e) {
          // ignore error
        }
      },
      delay
    )
  )
}

const runFlux = async (chatId, aspect_ratio) => {
  const prompt = chatPrompts.get(chatId)
  const files = chatImageFiles.get(chatId)

  try {
    await bot.sendMessage(chatId, `Работаю с моделью FLUX.1 Kontext${aspect_ratio === 'match_input_image' ? '' : ' (' + aspect_ratio + ')'}! Использую только последнее загруженное изображение! Ожидайте.`)
  } catch (e) {
    // ignore
  }

  const input = {
    prompt,
    input_image: files[files.length - 1],
    aspect_ratio,
    output_format: 'jpg',
    safety_tolerance: 2
  }

  const output = await replicate.run(REPLICATE_MODEL, { input })
  const now = Date.now()
  const filename = `${chatId}_${now}.jpg`
  const fileBuffer = await buffer(output)
  await bot.sendChatAction(chatId, 'upload_document')
  await bot.sendDocument(chatId, fileBuffer, {}, { filename, contentType: 'image/jpeg' })
}

const runSeedream4 = async (chatId, aspect_ratio) => {
  const prompt = chatPrompts.get(chatId)
  const files = chatImageFiles.get(chatId)

  try {
    await bot.sendMessage(chatId, `Работаю с моделью Seedream v4 (${aspect_ratio})! Ожидайте.`)
  } catch (e) {
    // ignore
  }

  const input = {
    size: '4K',
    width: 2048,
    height: 2048,
    prompt,
    max_images: 2,
    image_input: files,
    aspect_ratio,
    enhance_prompt: true,
    sequential_image_generation: 'disabled'
  }

  const output = await replicate.run(REPLICATE_SEEDREAM_MODEL, { input })
  const now = Date.now()

  for (let i = 0; i < output.length; i++) {
    const filename = `${chatId}_${now}_${i}.jpg`
    const fileBuffer = await buffer(output[i])
    await bot.sendChatAction(chatId, 'upload_document')
    await bot.sendDocument(chatId, fileBuffer, {}, { filename, contentType: 'image/jpeg' })
  }
}

const runKling = async (chatId) => {
  const prompt = chatPrompts.get(chatId)
  const files = chatImageFiles.get(chatId)

  try {
    await bot.sendMessage(chatId, `Работаю с моделью Kling v2.1 (5s 720p video)! Использую только последнее загруженное изображение! Ожидайте.`)
  } catch (e) {
    // ignore
  }

  const input = {
    mode: 'standard',
    prompt,
    duration: 5,
    start_image: files[files.length - 1],
    negative_prompt: ''
  }

  const output = await replicate.run(REPLICATE_KLING_MODEL, { input })
  const now = Date.now()

  const filename = `${chatId}_${now}.mp4`
  const fileBuffer = await buffer(output)
  await bot.sendChatAction(chatId, 'upload_document')
  await bot.sendDocument(chatId, fileBuffer, {}, { filename, contentType: 'video/mp4' })
}

const runKlingMotionControl = async (chatId) => {
  const prompt = chatPrompts.get(chatId) || ''
  const imagefiles = chatImageFiles.get(chatId)
  const videofiles = chatVideoFiles.get(chatId)

  try {
    await bot.sendMessage(chatId, `Работаю с моделью Kling v2.6 (motion control)! Использую только последнее загруженное изображение и видео! Ожидайте.`)
  } catch (e) {
    // ignore
  }

  const input = {
    mode: 'pro',
    image: imagefiles[imagefiles.length - 1],
    video: videofiles[videofiles.length - 1],
    prompt,
    keep_original_sound: true,
    character_orientation: 'image'
  }

  const output = await replicate.run(REPLICATE_KLING_MOTION_CONTROL_MODEL, { input })
  const now = Date.now()

  const filename = `${chatId}_${now}.mp4`
  const fileBuffer = await buffer(output)
  await bot.sendChatAction(chatId, 'upload_document')
  await bot.sendDocument(chatId, fileBuffer, {}, { filename, contentType: 'video/mp4' })
}

const generate = async (chatId, model) => {
  const ok = await checkPrompt(chatId)
  if (!ok) {
    return
  }

  if (isBusy.has(chatId)) {
    await bot.sendMessage(chatId, 'Я уже работаю! Сначала дождитесь, когда закончу!')
    return
  }

  isBusy.add(chatId)

  console.log(`[${chatId}] Working.`)

  await bot.sendChatAction(chatId, 'upload_document')

  const handle = setInterval(() => {
    bot.sendChatAction(chatId, 'upload_document')
  }, 5000)

  try {
    if (model === MODEL_FLUX) {
      await runFlux(chatId, 'match_input_image')
    }
    if (model === MODEL_FLUX_9_16) {
      await runFlux(chatId, '9:16')
    }
    if (model === MODEL_SEEDREAM) {
      await runSeedream4(chatId, '4:3')
    }
    if (model === MODEL_SEEDREAM_9_16) {
      await runSeedream4(chatId, '9:16')
    }
    if (model === MODEL_KLING) {
      await runKling(chatId)
    }
    if (model === MODEL_KLING_MOTION_CONTROL) {
      await runKlingMotionControl(chatId)
    }
  } catch (e) {
    console.log(e)
    await bot.sendMessage(chatId, e?.message || 'Извините, что-то пошло не так. Попробуйте повторить запрос.')
  } finally {
    console.log(`[${chatId}] Finished.`)
    clearInterval(handle)
    isBusy.delete(chatId)
    onPrompt(chatId)
  }
}

const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/heic']
const allowedVideoMimeTypes = ['video/quicktime', 'video/mp4']
const allowedChatIds = [407842300, 1635677674]

/**
 * @param {string|undefined} mimeType
 * @returns boolean
 */
const isAllowedImage = mimeType => allowedImageMimeTypes.includes(mimeType)

/**
 * @param {string|undefined} mimeType
 * @param {number|undefined} fileSize
 * @returns boolean
 */
const isAllowedVideo = (mimeType, fileSize) => {
  if (typeof mimeType === 'undefined' || typeof fileSize === 'undefined' || !allowedVideoMimeTypes.includes(mimeType)) {
    return false
  }
  return allowedVideoMimeTypes.includes(mimeType) && fileSize < 20 * 1024 * 1024
}

const isAllowedChat = chatId => allowedChatIds.includes(chatId)

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  if (!isAllowedChat(chatId)) {
    await bot.sendMessage(chatId, 'Пока!')
    return
  }

  if (msg.text === '/start') {
    await bot.sendMessage(chatId, 'Привет!')
    return
  }

  if (msg.text === '🗑 Очистить') {
    chatPrompts.delete(chatId)
    chatImageFiles.delete(chatId)
    chatVideoFiles.delete(chatId)
    await bot.sendMessage(chatId, 'Список файлов очищен.')
    onPrompt(chatId)
    return
  }

  if (MODELS.includes(msg.text)) {
    await generate(chatId, msg.text)
    return
  }

  if (isRecord(msg.document)) {
    try {
      if (!isAllowedImage(msg.document.mime_type) && !isAllowedVideo(msg.document.mime_type, msg.document.file_size)) {
        throw new Error()
      }

      const mimeType = msg.document.mime_type
      const fileId = msg.document.file_id

      if (isAllowedVideo(msg.document.mime_type, msg.document.file_size)) {
        const fileLink = await bot.getFileLink(fileId)
        addFile(chatId, fileLink, FILE_TYPE_VIDEO)
      } else if (mimeType === 'image/heic') {
        const fileBuffer = await buffer(bot.getFileStream(fileId))
        const outputBuffer = await convert({
          buffer: fileBuffer,
          format: 'JPEG',
          quality: 1
        });
        addFile(chatId, Buffer.from(outputBuffer), FILE_TYPE_IMAGE)
      } else {
        const fileLink = await bot.getFileLink(fileId)
        addFile(chatId, fileLink, FILE_TYPE_IMAGE)
      }

      onPrompt(chatId)
    } catch (e) {
      await bot.sendMessage(chatId, 'Недопустимый файл.')
    }
    return
  }

  if (Array.isArray(msg.photo)) {
    try {
      const photo = msg.photo[msg.photo.length - 1]
      if (!isRecord(photo)) {
        throw new Error()
      }

      const fileId = photo.file_id
      const fileLink = await bot.getFileLink(fileId)

      addFile(chatId, fileLink, FILE_TYPE_IMAGE)
      onPrompt(chatId, 500)
    } catch (e) {
      await bot.sendMessage(chatId, 'Недопустимый файл с изображением.')
    }
    return
  }

  if (isRecord(msg.video)) {
    try {
      const video = msg.video
      if (!isAllowedVideo(video.mime_type, video.file_size)) {
        throw new Error()
      }

      const fileId = video.file_id
      const fileLink = await bot.getFileLink(fileId)

      addFile(chatId, fileLink, FILE_TYPE_VIDEO)
      onPrompt(chatId, 500)
    } catch (e) {
      await bot.sendMessage(chatId, 'Недопустимый файл с видео. Видео должно быть размером до 20 МБ и длительностью 3 - 30 секунд.')
    }
    return
  }

  const imageFileLinks = chatImageFiles.get(chatId)
  const videoFileLinks = chatVideoFiles.get(chatId)
  if (typeof imageFileLinks === 'undefined' && typeof videoFileLinks === 'undefined') {
    await bot.sendMessage(chatId, 'Сначала загрузите хотя бы один файл.')
    return
  }

  const prompt = (typeof msg.text === 'undefined') ? ((typeof msg.caption === 'undefined') ? '' : msg.caption.trim()) : msg.text.trim()
  if (prompt !== '') {
    chatPrompts.set(chatId, prompt)
  }

  onPrompt(chatId)
})
