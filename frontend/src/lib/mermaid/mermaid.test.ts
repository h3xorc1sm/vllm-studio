import { describe, expect, it } from "vitest";
import { looksLikeMermaidDiagram, sanitizeMermaidCode, summarizeMermaidError } from "./index";

describe("mermaid helpers", () => {
  it("detects supported mermaid diagram headers", () => {
    expect(looksLikeMermaidDiagram("graph TD\nA-->B")).toBe(true);
    expect(looksLikeMermaidDiagram("sequenceDiagram\nAlice->>Bob: hi")).toBe(true);
    expect(looksLikeMermaidDiagram("not-a-diagram")).toBe(false);
  });

  it("normalizes frequent markdown/label formatting issues", () => {
    const sanitized = sanitizeMermaidCode("graph TD\nA[hello (world)<br/>]");
    expect(sanitized).toContain('A["hello (world)<br>"]');
  });

  it("autofixes broken split arrows from malformed model output", () => {
    const sanitized = sanitizeMermaidCode("graph TD\nF -\n- No --> C");
    expect(sanitized).toContain("F -- No --> C");
  });

  it("quotes brace labels used in edge pipes to avoid parse crashes", () => {
    const sanitized = sanitizeMermaidCode("graph TD\nA -->|Map to {-1, 0, +1}| C");
    expect(sanitized).toContain('A -->|"Map to {-1, 0, +1}"| C');
  });

  it("normalizes brace labels in inline edge text", () => {
    const sanitized = sanitizeMermaidCode("graph TD\nA -- Map to {-1, 0, +1} --> C");
    expect(sanitized).toContain("A -- Map to (-1, 0, +1) --> C");
  });

  it("returns compact parse-focused error summaries", () => {
    expect(summarizeMermaidError("Parse error on line 18: unexpected token"))
      .toBe("Unable to render Mermaid diagram due to syntax issues near line 18.");
    expect(summarizeMermaidError("")).toBe("Unable to render Mermaid diagram. Check diagram syntax.");
  });
});
