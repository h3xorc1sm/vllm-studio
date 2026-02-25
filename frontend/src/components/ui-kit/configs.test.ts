import { describe, expect, it } from "vitest";
import { UI_KIT_THEME_VARS, resolveUiToneConfig } from "./configs";

describe("ui-kit configs", () => {
  it("defines required theme vars used by ui-kit", () => {
    expect(UI_KIT_THEME_VARS).toContain("--bg");
    expect(UI_KIT_THEME_VARS).toContain("--surface");
    expect(UI_KIT_THEME_VARS).toContain("--hl1");
    expect(UI_KIT_THEME_VARS).toContain("--hl2");
  });

  it("resolves tone configs for known tones", () => {
    expect(resolveUiToneConfig("active")).toEqual({
      borderVar: "--hl2",
      dotVar: "--hl2",
      textClass: "text-(--hl1)",
    });
    expect(resolveUiToneConfig("error")).toEqual({
      borderVar: "--err",
      dotVar: "--err",
      textClass: "text-(--err)",
    });
  });
});
