import { imageMimeTypes, videoMimeTypes } from '../types/fileMimeType.js'
import type { ImageMimeType, VideoMimeType } from '../types/fileMimeType.js'

const MAX_VIDEO_SIZE = 20 * 1024 * 1024

function includes<T extends readonly string[]>(arr: T, value: string): value is T[number] {
  return arr.includes(value as T[number])
}

export function isAllowedImage(mime: string): mime is ImageMimeType {
  return includes(imageMimeTypes, mime)
}

export function isAllowedVideo(mime: string, size?: number): mime is VideoMimeType {
  return (size === undefined || size < MAX_VIDEO_SIZE) && includes(videoMimeTypes, mime)
}
