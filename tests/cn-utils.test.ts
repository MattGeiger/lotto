import { cn } from "@/lib/utils";

describe("cn (clsx + twMerge)", () => {
  it("returns empty string with no inputs", () => {
    expect(cn()).toBe("");
  });

  it("passes through a single class", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("combines multiple classes", () => {
    expect(cn("text-red-500", "font-bold")).toBe("text-red-500 font-bold");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("handles conditional objects", () => {
    expect(cn("base", { "font-bold": true, italic: false })).toBe(
      "base font-bold",
    );
  });

  it("ignores null and undefined values", () => {
    expect(cn("base", null, undefined, "extra")).toBe("base extra");
  });

  it("handles nested arrays", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("handles empty strings", () => {
    expect(cn("", "base", "")).toBe("base");
  });
});
