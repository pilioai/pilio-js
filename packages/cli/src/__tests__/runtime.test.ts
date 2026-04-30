import { describe, expect, it } from "vitest";
import { shouldRequireAPIKey } from "../runtime";

describe("CLI runtime", () => {
  it("does not require an API key for local help commands", () => {
    expect(shouldRequireAPIKey([])).toBe(false);
    expect(shouldRequireAPIKey(["--help"])).toBe(false);
    expect(shouldRequireAPIKey(["help"])).toBe(false);
  });

  it("requires an API key for API commands", () => {
    expect(shouldRequireAPIKey(["remove-background", "--input", "portrait.png"])).toBe(true);
  });
});
