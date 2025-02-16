import { describe, it, expect, vi, beforeEach } from "vitest";
import knowledge from "../src/knowledge";
import type { AgentRuntime } from "../src/runtime";
import { KnowledgeItem, type Memory } from "../src/types";
import { UUID } from "../src/types";

// Mock dependencies
vi.mock("../embedding", () => ({
    embed: vi.fn().mockResolvedValue(new Float32Array(1536).fill(0)),
    getEmbeddingZeroVector: vi
        .fn()
        .mockReturnValue(new Float32Array(1536).fill(0)),
}));

vi.mock("../generation", () => ({
    splitChunks: vi.fn().mockImplementation(async (text) => [text]),
}));

vi.mock("../uuid", () => ({
    stringToUuid: vi.fn().mockImplementation((str) => str),
}));

describe("Knowledge Module", () => {
    describe("preprocess", () => {
        it("should handle invalid inputs", () => {
            expect(knowledge.preprocess("" as any)).toBe("");
            expect(knowledge.preprocess(undefined as any)).toBe("");
            expect(knowledge.preprocess(null as any)).toBe("");
        });

        it("should remove code blocks and inline code", () => {
            const input =
                "Here is some code: ```const x = 1;``` and `inline code`";
            expect(knowledge.preprocess(input)).toBe("here is some code: and");
        });

        it("should handle markdown formatting", () => {
            const input =
                "# Header\n## Subheader\n[Link](http://example.com)\n![Image](image.jpg)";
            expect(knowledge.preprocess(input)).toBe(
                "header subheader link image"
            );
        });

        it("should simplify URLs", () => {
            const input = "Visit https://www.example.com/path?param=value";
            expect(knowledge.preprocess(input)).toBe(
                "visit example.com/path?param=value"
            );
        });

        it("should remove Discord mentions and HTML tags", () => {
            const input = "Hello <@123456789> and <div>HTML content</div>";
            expect(knowledge.preprocess(input)).toBe("hello and html content");
        });

        it("should normalize whitespace and newlines", () => {
            const input = "Multiple    spaces\n\n\nand\nnewlines";
            expect(knowledge.preprocess(input)).toBe(
                "multiple spaces and newlines"
            );
        });

        it("should remove comments", () => {
            const input = "/* Block comment */ Normal text // Line comment";
            expect(knowledge.preprocess(input)).toBe("normal text");
        });
    });

    describe("get and set", () => {
        let mockRuntime: AgentRuntime;

        beforeEach(() => {
            mockRuntime = {
                agentId: "test-agent",
                character: {
                    modelProvider: "openai",
                },
                messageManager: {
                    getCachedEmbeddings: vi.fn().mockResolvedValue([]),
                },
                knowledgeManager: {
                    searchMemoriesByEmbedding: vi.fn().mockResolvedValue([
                        {
                            content: {
                                text: "test fragment",
                                source: "source1",
                            },
                            similarity: 0.9,
                        },
                    ]),
                    createMemory: vi.fn().mockResolvedValue(undefined),
                },
                documentsManager: {
                    getMemoryById: vi.fn().mockResolvedValue({
                        id: "source1",
                        content: { text: "test document" },
                    }),
                    createMemory: vi.fn().mockResolvedValue(undefined),
                },
            } as unknown as AgentRuntime;
        });

        describe("get", () => {
            it("should handle invalid messages", async () => {
                const invalidMessage = {} as Memory;
                const result = await knowledge.get(mockRuntime, invalidMessage);
                expect(result).toEqual([]);
            });

            it("should handle empty processed text", async () => {
                const message: Memory = {
                    agentId: "test-agent",
                    content: { text: "```code only```" },
                } as unknown as Memory;

                const result = await knowledge.get(mockRuntime, message);
                expect(result).toEqual([]);
            });

            it("should fetch knowledge without requiring agentId", async () => {
                const message: Memory = {
                    agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                    roomId: "test-room-0000-0000-0000-000000000000" as UUID,
                    content: { text: "test query" },
                    userId: "test-user-0000-0000-0000-000000000000" as UUID
                };

                await knowledge.get(mockRuntime, message);

                const searchFn = mockRuntime.knowledgeManager.searchMemoriesByEmbedding as jest.Mock;
                expect(searchFn).toHaveBeenCalledWith(
                    expect.any(Array),
                    expect.objectContaining({
                        roomId: "test-room-0000-0000-0000-000000000000",
                        match_threshold: 0.1,
                        unique: true
                    })
                );
            });

            it("should maintain RAG functionality with embeddings", async () => {
                const message: Memory = {
                    agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                    roomId: "test-room-0000-0000-0000-000000000000" as UUID,
                    content: { text: "test query" },
                    userId: "test-user-0000-0000-0000-000000000000" as UUID
                };

                await knowledge.get(mockRuntime, message);

                const searchFn = mockRuntime.knowledgeManager.searchMemoriesByEmbedding as jest.Mock;
                expect(searchFn).toHaveBeenCalled();
                expect(Array.isArray(searchFn.mock.calls[0][0])).toBe(true);
            });

            it("should fetch knowledge with specific agentId", async () => {
                const message: Memory = {
                    agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                    roomId: "test-room-0000-0000-0000-000000000000" as UUID,
                    content: { text: "test query" },
                    userId: "test-user-0000-0000-0000-000000000000" as UUID
                };

                await knowledge.get(mockRuntime, message, { useAgentFilter: true });

                const searchFn = mockRuntime.knowledgeManager.searchMemoriesByEmbedding as jest.Mock;
                expect(searchFn).toHaveBeenCalledWith(
                    expect.any(Array),
                    expect.objectContaining({
                        roomId: "test-room-0000-0000-0000-000000000000",
                        agentId: "test-agent-0000-0000-0000-000000000000",
                        match_threshold: 0.1,
                        unique: true
                    })
                );
            });

            it("should support both filtered and unfiltered agentId queries", async () => {
                const message: Memory = {
                    agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                    roomId: "test-room-0000-0000-0000-000000000000" as UUID,
                    content: { text: "test query" },
                    userId: "test-user-0000-0000-0000-000000000000" as UUID
                };

                // Test with agentId filter
                await knowledge.get(mockRuntime, message, { useAgentFilter: true });
                const searchFn = mockRuntime.knowledgeManager.searchMemoriesByEmbedding as jest.Mock;
                expect(searchFn).toHaveBeenLastCalledWith(
                    expect.any(Array),
                    expect.objectContaining({
                        roomId: message.roomId,
                        agentId: message.agentId,
                        match_threshold: 0.1,
                        unique: true
                    })
                );

                // Test without agentId filter (all knowledge)
                await knowledge.get(mockRuntime, message);
                expect(searchFn).toHaveBeenLastCalledWith(
                    expect.any(Array),
                    expect.objectContaining({
                        roomId: message.roomId,
                        match_threshold: 0.1,
                        unique: true
                    })
                );
            });
        });
    });
});

