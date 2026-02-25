import { describe, expect, it } from "bun:test";
import { DaytonaAgentFsApi } from "./daytona-agentfs";

const createMockClient = () => {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const client = {
    listFiles: async (...args: unknown[]) => {
      calls.push({ name: "listFiles", args });
      return [
        { name: "src", isDirectory: true, size: 0 },
        { name: "README.md", isDirectory: false, size: 42 },
      ];
    },
    createFolder: async (...args: unknown[]) => {
      calls.push({ name: "createFolder", args });
    },
    movePath: async (...args: unknown[]) => {
      calls.push({ name: "movePath", args });
    },
    getFileInfo: async (...args: unknown[]) => {
      calls.push({ name: "getFileInfo", args });
      return { isDirectory: false, size: 42 };
    },
    readFile: async (...args: unknown[]) => {
      calls.push({ name: "readFile", args });
      return "hello";
    },
    writeFile: async (...args: unknown[]) => {
      calls.push({ name: "writeFile", args });
    },
    deletePath: async (...args: unknown[]) => {
      calls.push({ name: "deletePath", args });
    },
  };

  return { client, calls };
};

describe("DaytonaAgentFsApi", () => {
  it("maps filesystem operations to daytona client calls", async () => {
    const { client, calls } = createMockClient();
    const fs = new DaytonaAgentFsApi(client as never, "session-123");

    const entries = await fs.readdirPlus("/project");
    await fs.mkdir("/project/new-dir");
    await fs.rename("/project/a.txt", "/project/b.txt");
    await fs.stat("/project/README.md");
    await fs.readFile("/project/README.md", "utf8");
    await fs.writeFile("/project/README.md", "updated");
    await fs.rm("/project/README.md", { recursive: true, force: true });

    expect(entries).toHaveLength(2);
    expect(entries[0]?.name).toBe("src");
    expect(entries[0]?.stats.isDirectory()).toBe(true);
    expect(entries[1]?.stats.size).toBe(42);

    expect(calls).toEqual([
      { name: "listFiles", args: ["session-123", "project"] },
      { name: "createFolder", args: ["session-123", "project/new-dir"] },
      { name: "movePath", args: ["session-123", "project/a.txt", "project/b.txt"] },
      { name: "getFileInfo", args: ["session-123", "project/README.md"] },
      { name: "readFile", args: ["session-123", "project/README.md"] },
      { name: "writeFile", args: ["session-123", "project/README.md", "updated"] },
      {
        name: "deletePath",
        args: ["session-123", "project/README.md", { recursive: true, force: true }],
      },
    ]);
  });

  it("treats root stat as a directory without remote call", async () => {
    const { client, calls } = createMockClient();
    const fs = new DaytonaAgentFsApi(client as never, "session-123");

    const stat = await fs.stat("/");
    expect(stat.isDirectory()).toBe(true);
    expect(calls).toEqual([]);
  });
});
