export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/heic'] as const
export const videoMimeTypes = ['video/quicktime', 'video/mp4'] as const
export const audioMimeTypes = [
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
] as const

export type ImageMimeType = (typeof imageMimeTypes)[number]

export type VideoMimeType = (typeof videoMimeTypes)[number]

export type AudioMimeType = (typeof audioMimeTypes)[number]

export type FileMimeType = ImageMimeType | VideoMimeType | AudioMimeType
