import type { StateCreator } from "zustand";
import {
  DEFAULT_FONT_FAMILY_ID,
  DEFAULT_FONT_SIZE_ID,
  FONT_FAMILY_BY_ID,
  FONT_SIZE_BY_ID,
  THEME_BY_ID,
} from "@/lib/themes";
import type { FontFamilyId, FontSizeId, ThemeId } from "@/lib/themes";

function applyThemeToDocument(themeId: ThemeId) {
  if (typeof document === "undefined") return themeId;

  const theme = THEME_BY_ID.get(themeId);
  const fallbackTheme = THEME_BY_ID.get("warm-paper");
  const nextTheme = theme ?? fallbackTheme;
  if (!nextTheme) return themeId;

  document.documentElement.setAttribute("data-theme", nextTheme.id);
  Object.entries(nextTheme.tokens).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--${key}`, value);
  });

  return nextTheme.id;
}

function applyFontFamilyToDocument(fontFamilyId: FontFamilyId) {
  if (typeof document === "undefined") return fontFamilyId;

  const font = FONT_FAMILY_BY_ID.get(fontFamilyId) ?? FONT_FAMILY_BY_ID.get(DEFAULT_FONT_FAMILY_ID);
  if (!font) return fontFamilyId;

  document.documentElement.style.setProperty("--font-sans", font.cssValue);
  return font.id;
}

function applyFontSizeToDocument(fontSizeId: FontSizeId) {
  if (typeof document === "undefined") return fontSizeId;

  const size = FONT_SIZE_BY_ID.get(fontSizeId) ?? FONT_SIZE_BY_ID.get(DEFAULT_FONT_SIZE_ID);
  if (!size) return fontSizeId;

  document.documentElement.style.setProperty("--app-font-size", size.cssValue);
  return size.id;
}

export interface ThemeSlice {
  themeId: ThemeId;
  fontFamilyId: FontFamilyId;
  fontSizeId: FontSizeId;
  setThemeId: (themeId: ThemeId) => void;
  setFontFamilyId: (fontFamilyId: FontFamilyId) => void;
  setFontSizeId: (fontSizeId: FontSizeId) => void;
}

export const createThemeSlice: StateCreator<ThemeSlice, [], [], ThemeSlice> = (set) => ({
  themeId: "warm-paper",
  fontFamilyId: DEFAULT_FONT_FAMILY_ID,
  fontSizeId: DEFAULT_FONT_SIZE_ID,
  setThemeId: (themeId: ThemeId) => {
    const appliedThemeId = applyThemeToDocument(themeId);
    set({ themeId: appliedThemeId });
  },
  setFontFamilyId: (fontFamilyId: FontFamilyId) => {
    const appliedFontFamilyId = applyFontFamilyToDocument(fontFamilyId);
    set({ fontFamilyId: appliedFontFamilyId });
  },
  setFontSizeId: (fontSizeId: FontSizeId) => {
    const appliedFontSizeId = applyFontSizeToDocument(fontSizeId);
    set({ fontSizeId: appliedFontSizeId });
  },
});
