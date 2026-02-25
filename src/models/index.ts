export const REPLICATE_MODELS = {
  FLUX: 'black-forest-labs/flux-kontext-pro',
  FLUX2: 'black-forest-labs/flux-2-pro',
  SEEDREAM: 'bytedance/seedream-4',
  NANO_BANANA_PRO: 'google/nano-banana-pro',
  KLING: 'kwaivgi/kling-v2.1',
  KLING_MC: 'kwaivgi/kling-v2.6-motion-control',
} as const

export const BOT_MODELS = {
  FLUX: '🔷 FLUX.1 Kontext',
  FLUX_9_16: '🔷 FLUX.1 Kontext (9:16)',
  FLUX2: '♦️ FLUX.2',
  FLUX2_9_16: '♦️ FLUX.2 (9:16)',
  SEEDREAM: '🧿 Seedream v4 (4:3)',
  SEEDREAM_9_16: '🧿 Seedream v4 (9:16)',
  NANO_BANANA_PRO: '🍌 Nano Banana PRO',
  KLING: '📼 Kling v2.1 (5s 720p video)',
  KLING_MC: '📼 Kling v2.6 (motion control)',
} as const

export type BotModel = (typeof BOT_MODELS)[keyof typeof BOT_MODELS]
