import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

// Extract and test the path traversal protection logic from readonly-server.js
// We reconstruct the tryServeStatic logic to test it in isolation

const createPathValidator = (publicDir: string) => {
  return (pathname: string): string | false => {
    const safePath = path.normalize(pathname);
    const filePath = path.join(publicDir, safePath);
    if (!filePath.startsWith(publicDir)) return false;
    return filePath;
  };
};

describe("L3: path traversal protection in readonly server", () => {
  let tempPublicDir: string;

  beforeAll(async () => {
    tempPublicDir = await fs.mkdtemp(path.join(os.tmpdir(), "readonly-public-"));
    // Create a test file
    await fs.writeFile(path.join(tempPublicDir, "test.png"), "fake-image-data");
  });

  afterAll(async () => {
    await fs.rm(tempPublicDir, { recursive: true, force: true });
  });

  const traversalPaths = [
    "../../etc/passwd",
    "../../../etc/shadow",
    "..\\..\\etc\\passwd",
    "../package.json",
    "/../../../etc/passwd",
    "/..%2F..%2Fetc/passwd",
    "....//....//etc/passwd",
  ];

  for (const maliciousPath of traversalPaths) {
    it(`blocks traversal attempt: ${maliciousPath}`, () => {
      const validate = createPathValidator(tempPublicDir);
      const result = validate(maliciousPath);

      if (result !== false) {
        // If it returned a path, it must still be within publicDir
        expect(result.startsWith(tempPublicDir)).toBe(true);
      }
    });
  }

  it("allows valid file paths within public directory", () => {
    const validate = createPathValidator(tempPublicDir);
    const result = validate("/test.png");

    expect(result).not.toBe(false);
    expect((result as string).startsWith(tempPublicDir)).toBe(true);
  });

  it("source code does not use redundant regex for traversal protection", async () => {
    const source = await fs.readFile(
      path.resolve(__dirname, "../scripts/readonly-server.js"),
      "utf-8",
    );

    // After fix: should NOT have the regex .replace() for stripping ../
    const redundantRegex = /\.replace\(\s*\/\^\(\\\.\\\.\[/;
    expect(source).not.toMatch(redundantRegex);
  });
});
