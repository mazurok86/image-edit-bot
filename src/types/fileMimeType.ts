export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/heic'] as const
export const videoMimeTypes = ['video/quicktime', 'video/mp4'] as const

export type ImageMimeType = (typeof imageMimeTypes)[number]

export type VideoMimeType = (typeof videoMimeTypes)[number]

export type FileMimeType = ImageMimeType | VideoMimeType
