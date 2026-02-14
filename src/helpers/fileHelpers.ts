const MAX_VIDEO_SIZE = 20 * 1024 * 1024

const allowedImageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/heic'
] as const

const allowedVideoMimeTypes = [
  'video/quicktime',
  'video/mp4'
] as const

type AllowedImageMime = typeof allowedImageMimeTypes[number]
type AllowedVideoMime = typeof allowedVideoMimeTypes[number]

function includes<T extends readonly string[]>(
  arr: T,
  value: string
): value is T[number] {
  return arr.includes(value as T[number])
}

export function isAllowedImage(mime: string): mime is AllowedImageMime {
  return includes(allowedImageMimeTypes, mime)
}

export function isAllowedVideo(
  mime: string,
  size: number
): mime is AllowedVideoMime {
  return (
    size < MAX_VIDEO_SIZE &&
    includes(allowedVideoMimeTypes, mime)
  )
}
