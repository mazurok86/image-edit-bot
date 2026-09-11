export type CapabilityBase<Id extends string, Value extends string> = {
  id: Id
  label: string
  /** Each model lists only the values it supports; every listed value must be a member of `Value`. */
  valueLabels: Partial<Record<Value, string>>
  value: Value
}

export type Capabilities = {
  aspectRatio?: CapabilityBase<'aspectRatio', 'match_input_image' | 'adaptive' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9'>
  outputFormat?: CapabilityBase<'outputFormat', 'webp' | 'jpg' | 'png'>
  size?: CapabilityBase<'size', '2K' | '4K'>
  mode?: CapabilityBase<'mode', 'standard' | 'pro'>
  characterOrientation?: CapabilityBase<'characterOrientation', 'image' | 'video'>
  numFrames?: CapabilityBase<'numFrames', '81' | '100' | '121'>
  resolution?: CapabilityBase<'resolution', '480p' | '720p'>
  framesPerSecond?: CapabilityBase<'framesPerSecond', '16' | '24' | '30'>
  duration?: CapabilityBase<'duration', '-1' | '5' | '10' | '15' | '20' | '30'>
  generateAudio?: CapabilityBase<'generateAudio', 'true' | 'false'>
}
