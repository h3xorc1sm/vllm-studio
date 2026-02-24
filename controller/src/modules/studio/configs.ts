export const STUDIO_MODULE_DEFAULTS = {
  uiRefreshMs: 5_000,
};

export const STUDIO_MODEL_RECOMMENDATIONS = [
  {
    id: "meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B Instruct",
    size_gb: 16,
    min_vram_gb: 12,
    description: "Great balance of quality and speed for general chat.",
    tags: ["chat", "general", "recommended"],
  },
  {
    id: "Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen2.5 7B Instruct",
    size_gb: 14,
    min_vram_gb: 10,
    description: "Strong multilingual model with fast responses.",
    tags: ["chat", "multilingual"],
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.2",
    name: "Mistral 7B Instruct",
    size_gb: 13,
    min_vram_gb: 10,
    description: "Lightweight, responsive, and easy to run.",
    tags: ["chat", "fast"],
  },
  {
    id: "microsoft/Phi-3-mini-4k-instruct",
    name: "Phi-3 Mini 4K",
    size_gb: 5,
    min_vram_gb: 4,
    description: "Compact model ideal for laptops and CPU fallback.",
    tags: ["small", "fast"],
  },
  {
    id: "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    name: "TinyLlama 1.1B",
    size_gb: 2,
    min_vram_gb: 2,
    description: "Ultra-lightweight for quick testing.",
    tags: ["tiny", "starter"],
  },
];
