import { recordToEntries } from '../helpers/arrayHelpers.js'
import type { Capabilities } from '../types/capabilities.js'
import type {
  ModelCapabilities,
  ModelCapability,
  ModelCapabilityValue,
  ModelCapabilitiesValue,
  ModelCapabilityKey,
} from '../types/model.js'

type Model = {
  id: string
  name: string
  minImages: number
  maxImages: number
  minVideo: number
  maxVideo: number
  minAudio: number
  maxAudio: number
  requirePrompt: boolean
  capabilities: Capabilities
}

const models = {
  qwen: {
    id: 'qwen/qwen-image-edit-plus',
    name: '⭕ Qwen',
    minImages: 1,
    maxImages: 4,
    minVideo: 0,
    maxVideo: 0,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: true,
    capabilities: {
      aspectRatio: {
        id: 'aspectRatio',
        label: 'Соотношение сторон',
        value: 'match_input_image',
        valueLabels: { match_input_image: 'Оригинальное', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9', '9:16': '9:16' },
      },
    },
  },
  flux1: {
    id: 'black-forest-labs/flux-kontext-pro',
    name: '🔷 FLUX.1 Kontext',
    minImages: 1,
    maxImages: 4,
    minVideo: 0,
    maxVideo: 0,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: true,
    capabilities: {
      aspectRatio: {
        id: 'aspectRatio',
        label: 'Соотношение сторон',
        value: 'match_input_image',
        valueLabels: { match_input_image: 'Оригинальное', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9', '9:16': '9:16' },
      },
    },
  },
  flux2: {
    id: 'black-forest-labs/flux-2-pro',
    name: '♦️ FLUX.2',
    minImages: 1,
    maxImages: 4,
    minVideo: 0,
    maxVideo: 0,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: true,
    capabilities: {
      aspectRatio: {
        id: 'aspectRatio',
        label: 'Соотношение сторон',
        value: 'match_input_image',
        valueLabels: { match_input_image: 'Оригинальное', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9', '9:16': '9:16' },
      },
    },
  },
  seedream: {
    id: 'bytedance/seedream-4.5',
    name: '🧿 Seedream v4.5',
    minImages: 1,
    maxImages: 4,
    minVideo: 0,
    maxVideo: 0,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: true,
    capabilities: {
      aspectRatio: {
        id: 'aspectRatio',
        label: 'Соотношение сторон',
        value: 'match_input_image',
        valueLabels: { match_input_image: 'Оригинальное', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9', '9:16': '9:16' },
      },
      size: {
        id: 'size',
        label: 'Размер',
        value: '2K',
        valueLabels: { '2K': '2K', '4K': '4K' },
      },
    },
  },
  nanoBanana: {
    id: 'google/nano-banana-pro',
    name: '🍌 Nano Banana PRO',
    minImages: 1,
    maxImages: 4,
    minVideo: 0,
    maxVideo: 0,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: true,
    capabilities: {
      aspectRatio: {
        id: 'aspectRatio',
        label: 'Соотношение сторон',
        value: 'match_input_image',
        valueLabels: { match_input_image: 'Оригинальное', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '16:9': '16:9', '9:16': '9:16' },
      },
    },
  },
  kling: {
    id: 'kwaivgi/kling-v2.1',
    name: '📼 Kling v2.1 (5s 720p video)',
    minImages: 1,
    maxImages: 1,
    minVideo: 0,
    maxVideo: 0,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: true,
    capabilities: {
      mode: {
        id: 'mode',
        label: 'Режим',
        value: 'standard',
        valueLabels: { standard: 'Стандартный', pro: 'Про' },
      },
    },
  },
  klingMC: {
    id: 'kwaivgi/kling-v2.6-motion-control',
    name: '📼 Kling v2.6 (motion control)',
    minImages: 1,
    maxImages: 1,
    minVideo: 1,
    maxVideo: 1,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: false,
    capabilities: {
      characterOrientation: {
        id: 'characterOrientation',
        label: 'Ориентация персонажа',
        value: 'video',
        valueLabels: { image: 'По изображению', video: 'По видео' },
      },
    },
  },
  wan22: {
    id: 'wan-video/wan-2.2-i2v-fast',
    name: '📼 Wan 2.2',
    minImages: 1,
    maxImages: 1,
    minVideo: 0,
    maxVideo: 0,
    minAudio: 0,
    maxAudio: 0,
    requirePrompt: true,
    capabilities: {
      numFrames: {
        id: 'numFrames',
        label: 'Количество кадров',
        value: '121',
        valueLabels: { '81': '81', '100': '100', '121': '121' },
      },
      resolution: {
        id: 'resolution',
        label: 'Разрешение',
        value: '720p',
        valueLabels: { '480p': '480p', '720p': '720p' },
      },
      framesPerSecond: {
        id: 'framesPerSecond',
        label: 'Частота кадров',
        value: '16',
        valueLabels: { '16': '16', '24': '24', '30': '30' },
      },
    },
  },
  seedance25: {
    id: 'bytedance/seedance-2.5',
    name: '📼 Seedance 2.5',
    minImages: 0,
    maxImages: 30,
    minVideo: 0,
    maxVideo: 10,
    minAudio: 0,
    maxAudio: 10,
    requirePrompt: true,
    capabilities: {
      duration: {
        id: 'duration',
        label: 'Длительность',
        value: '5',
        valueLabels: { '-1': 'Авто', '5': '5 сек', '10': '10 сек', '15': '15 сек', '20': '20 сек', '30': '30 сек' },
      },
      aspectRatio: {
        id: 'aspectRatio',
        label: 'Соотношение сторон',
        value: 'adaptive',
        valueLabels: { adaptive: 'Авто', '16:9': '16:9', '4:3': '4:3', '1:1': '1:1', '3:4': '3:4', '9:16': '9:16', '21:9': '21:9' },
      },
      resolution: {
        id: 'resolution',
        label: 'Разрешение',
        value: '720p',
        valueLabels: { '480p': '480p', '720p': '720p' },
      },
      generateAudio: {
        id: 'generateAudio',
        label: 'Звук',
        value: 'true',
        valueLabels: { true: 'Вкл', false: 'Выкл' },
      },
    },
  },
} as const satisfies Record<string, Model>

export type Models = typeof models
export type ModelKey = keyof Models

const modelKeyByName: Record<string, ModelKey> = Object.fromEntries(
  recordToEntries(models).map(([modelKey, model]) => [model.name, modelKey]),
)

export function getModel<M extends ModelKey>(key: M): Models[M] {
  return models[key]
}

export function getModelCapabilities<M extends ModelKey>(key: M): ModelCapabilities<M> {
  return models[key].capabilities as ModelCapabilities<M>
}

export function getModelCapabilitiesValue<M extends ModelKey>(modelKey: M): ModelCapabilitiesValue<M> {
  return Object.fromEntries(
    recordToEntries(getModelCapabilities(modelKey)).map(([key, cap]) => [key, cap.value]),
  ) as ModelCapabilitiesValue<M>
}

export function getModelCapability<M extends ModelKey, C extends ModelCapabilityKey<M>>(key: M, capKey: C): ModelCapability<M, C> {
  const caps = getModelCapabilities(key)
  return caps[capKey]
}

export function getModelCapabilityValue<M extends ModelKey, C extends ModelCapabilityKey<M>>(
  key: M,
  capKey: C,
): ModelCapabilityValue<M, C> {
  return getModelCapability(key, capKey).value
}

export function isModelKey(key: unknown): key is ModelKey {
  return typeof key === 'string' && key in models
}

export function isModelCapabilityKey<M extends ModelKey>(key: unknown, modelKey: M): key is ModelCapabilityKey<M> {
  return typeof key === 'string' && key in models[modelKey].capabilities
}

export function isModelCapabilityValue<M extends ModelKey, C extends ModelCapabilityKey<M>>(
  key: unknown,
  modelKey: M,
  capKey: C,
): key is ModelCapabilityValue<M, C> {
  const caps = getModelCapabilities(modelKey)
  const cap = caps[capKey]
  return typeof key === 'string' && key in cap.valueLabels
}

export function getModelNames(): Models[keyof Models]['name'][] {
  return Object.values(models).map(({ name }) => name)
}

export function getModelKeyByName(name: string): ModelKey | undefined {
  return modelKeyByName[name]
}
