import type { ModelKey, Models } from '../models/registry.js'
import type { FileOutput } from './fileOutput.js'
import type { Files } from './files.js'

type ModelRawCapabilities<M extends ModelKey> = Models[M]['capabilities']
// type KeyOf<T> = T extends Record<string, unknown> ? keyof T : never;
// type ValueOf<T> = T extends Record<string, unknown> ? T[keyof T] : never;
// type UnionByKey<T, K> = T extends Record<string, unknown> ? K extends keyof T ? T[K]: never: never;

export type ModelCapabilityKey<M extends ModelKey> = keyof ModelRawCapabilities<M> & string

type ModelCapabilitiesValueLabels<M extends ModelKey> = {
  [K in ModelCapabilityKey<M>]: ModelRawCapabilities<M>[K] extends { valueLabels: infer V } ? Record<keyof V & string, string> : never
}

export type ModelCapabilitiesValue<M extends ModelKey> = {
  [K in ModelCapabilityKey<M>]: keyof ModelCapabilitiesValueLabels<M>[K] & string
}

export type ModelCapabilityValue<M extends ModelKey, K extends ModelCapabilityKey<M>> = ModelCapabilitiesValue<M>[K]

// export type ModelCapability<M extends ModelKey, K extends ModelCapabilityKey<M>> = UnionByKey<Models[M]['capabilities'], K>;
export type ModelCapability<M extends ModelKey, K extends ModelCapabilityKey<M>> = {
  value: ModelCapabilityValue<M, K>
  label: ModelRawCapabilities<M>[K] extends { label: infer V } ? V : never
  valueLabels: ModelCapabilitiesValueLabels<M>[K]
}

export type ModelCapabilities<M extends ModelKey> = {
  [K in ModelCapabilityKey<M>]: ModelCapability<M, K>
}

export type ModelRunners = {
  [M in ModelKey]: (prompt: string, files: Files, options: ModelCapabilitiesValue<M>) => Promise<FileOutput[]>
}
