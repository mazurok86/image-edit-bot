export const FileType = {
  Image: 'image',
  Video: 'video',
} as const

export type FileType = (typeof FileType)[keyof typeof FileType]
