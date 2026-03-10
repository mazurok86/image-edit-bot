export type CapabilityBase<Id extends string, Value extends string> = {
  id: Id
  label: string
  valueLabels: Record<Value, string>
  value: Value
}

export type Capabilities = {
  aspectRatio?: CapabilityBase<'aspectRatio', 'match_input_image' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16'>
  outputFormat?: CapabilityBase<'outputFormat', 'webp' | 'jpg' | 'png'>
  size?: CapabilityBase<'size', '2K' | '4K'>
  mode?: CapabilityBase<'mode', 'standard' | 'pro'>
  characterOrientation?: CapabilityBase<'characterOrientation', 'image' | 'video'>
}
