export const MODELS_MODULE_DEFAULTS = {
  includeLegacyModels: true,
};

export const MODEL_BROWSER_WEIGHT_EXTENSIONS = [".safetensors", ".bin", ".gguf"] as const;

export const MODEL_BROWSER_CONFIG_FILENAMES = ["config.json"] as const;

export const MODEL_QUANTIZATION_SIGNATURES = [
  "awq",
  "gptq",
  "gguf",
  "fp16",
  "bf16",
  "int8",
  "int4",
  "w4a16",
  "w8a16",
];
