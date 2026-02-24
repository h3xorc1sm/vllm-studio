export interface ModelsModuleConfig {
  feature: "models";
}

export interface ModelBrowserRecord {
  id: string;
}

export interface ModelInfo {
  name: string;
  path: string;
  size_bytes: number | null;
  modified_at: number | null;
  architecture: string | null;
  quantization: string | null;
  context_length: number | null;
  recipe_ids: string[];
  has_recipe: boolean;
}
