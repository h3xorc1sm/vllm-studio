// CRITICAL
import type { UiTone } from "./types";

export interface UiToneConfig {
  borderVar: string;
  dotVar: string;
  textClass: string;
}

export const UI_KIT_THEME_VARS = [
  "--bg",
  "--surface",
  "--fg",
  "--dim",
  "--border",
  "--hl1",
  "--hl2",
  "--hl3",
  "--err",
] as const;

export const UI_TONE_CONFIG: Record<UiTone, UiToneConfig> = {
  neutral: {
    borderVar: "--border",
    dotVar: "--dim",
    textClass: "text-(--fg)",
  },
  active: {
    borderVar: "--hl2",
    dotVar: "--hl2",
    textClass: "text-(--hl1)",
  },
  success: {
    borderVar: "--hl1",
    dotVar: "--hl2",
    textClass: "text-(--hl2)",
  },
  error: {
    borderVar: "--err",
    dotVar: "--err",
    textClass: "text-(--err)",
  },
  info: {
    borderVar: "--hl1",
    dotVar: "--hl1",
    textClass: "text-(--hl1)",
  },
};

export function resolveUiToneConfig(tone: UiTone): UiToneConfig {
  return UI_TONE_CONFIG[tone];
}
