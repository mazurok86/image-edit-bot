import { isAllowedImage, isAllowedVideo } from './fileHelpers.js'
import type { ChatState } from '../types/chatState.js'

export function getChatImages(chat: ChatState): string[] {
  const images = []
  for (const { url, mimeType } of chat.files) {
    if (isAllowedImage(mimeType)) {
      images.push(url)
    }
  }
  return images
}

export function getChatVideos(chat: ChatState): string[] {
  const videos = []
  for (const { url, mimeType } of chat.files) {
    if (isAllowedVideo(mimeType)) {
      videos.push(url)
    }
  }
  return videos
}
