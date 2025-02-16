import { describe, it, expect, vi, beforeEach } from "vitest";
import knowledge from "../src/knowledge";
import type { AgentRuntime } from "../src/runtime";
import { KnowledgeItem, Memory, UUID } from "../src/types";
import { createKnowledgeLoader } from "../src/knowledge-loader";

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

// Mock the knowledge loader
vi.mock("../src/knowledge-loader", () => ({
    createKnowledgeLoader: vi.fn().mockReturnValue({
        loadContent: vi.fn().mockImplementation(async (source) => ({
            text: source.content || "test content",
            metadata: source.metadata,
            source: source.path || "inline",
            type: "static"
        })),
        exists: vi.fn().mockResolvedValue(true)
    })
}));

describe("Knowledge Module", () => {
    let mockRuntime: AgentRuntime;

    beforeEach(() => {
        mockRuntime = {
            agentId: "test-agent" as UUID,
            character: {
                modelProvider: "openai",
            },
            messageManager: {
                getCachedEmbeddings: vi.fn().mockResolvedValue([
                    { embedding: new Float32Array(1536).fill(0) }
                ]),
            },
            knowledgeManager: {
                searchMemoriesByEmbedding: vi.fn().mockResolvedValue([
                    {
                        id: "test-id" as UUID,
                        agentId: "test-agent" as UUID,
                        content: {
                            text: "test content",
                            type: "static",
                            metadata: {
                                author: "Test Author",
                                category: "Test Category"
                            },
                            source: "test-file.md"
                        },
                        createdAt: Date.now()
                    }
                ]),
                createMemory: vi.fn().mockResolvedValue(undefined),
            },
            documentsManager: {
                getMemoryById: vi.fn().mockResolvedValue({
                    id: "source1",
                    agentId: "test-agent",
                    content: {
                        text: "test document",
                        type: "rag",
                        metadata: {
                            author: "Test Author",
                            category: "Test Category"
                        },
                        source: "test-file.md"
                    },
                    createdAt: Date.now()
                }),
                createMemory: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as AgentRuntime;
    });

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

    describe("set", () => {
        it("should set knowledge item with content", async () => {
            const item: KnowledgeItem = {
                id: "test-id" as UUID,
                agentId: "test-agent" as UUID,
                content: {
                    text: "test content",
                    type: "static",
                    metadata: { test: true }
                },
                createdAt: Date.now()
            };

            await knowledge.set(mockRuntime, item);
            expect(mockRuntime.knowledgeManager.createMemory).toHaveBeenCalled();
        });

        it("should load content from source if not provided", async () => {
            const item: KnowledgeItem = {
                id: "test-id" as UUID,
                agentId: "test-agent" as UUID,
                content: {
                    text: "",
                    source: "test.txt",
                    type: "static",
                    metadata: { test: true }
                },
                createdAt: Date.now()
            };

            await knowledge.set(mockRuntime, item);
            expect(mockRuntime.knowledgeManager.createMemory).toHaveBeenCalled();
        });
    });

    describe("get", () => {
        it("should retrieve knowledge items", async () => {
            const message: Memory = {
                id: "test-id" as UUID,
                userId: "test-user" as UUID,
                agentId: "test-agent" as UUID,
                roomId: "test-room" as UUID,
                content: { text: "test query" }
            };

            const results = await knowledge.get(mockRuntime, message);
            expect(results).toHaveLength(1);
            expect(results[0].content.text).toBe("test content");
        });

        it("should handle empty embeddings", async () => {
            mockRuntime.messageManager.getCachedEmbeddings = vi.fn().mockResolvedValue([]);
            
            const message: Memory = {
                id: "test-id" as UUID,
                userId: "test-user" as UUID,
                agentId: "test-agent" as UUID,
                roomId: "test-room" as UUID,
                content: { text: "test query" }
            };

            const results = await knowledge.get(mockRuntime, message);
            expect(results).toHaveLength(0);
        });

        it("should use search options", async () => {
            const message: Memory = {
                id: "test-id" as UUID,
                userId: "test-user" as UUID,
                agentId: "test-agent" as UUID,
                roomId: "test-room" as UUID,
                content: { text: "test query" }
            };

            await knowledge.get(mockRuntime, message, {
                roomId: "test-room" as UUID,
                match_threshold: 0.8,
                count: 10,
                unique: true,
                useAgentFilter: true
            });

            expect(mockRuntime.knowledgeManager.searchMemoriesByEmbedding).toHaveBeenCalledWith(
                expect.any(Float32Array),
                expect.objectContaining({
                    match_threshold: 0.8,
                    count: 10,
                    unique: true
                })
            );
        });
    });

    describe("Knowledge Type Updates", () => {
        it("should support both RAG and static knowledge types", async () => {
            const ragKnowledge: KnowledgeItem = {
                id: "test-id-0000-0000-0000-000000000000" as UUID,
                agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                content: {
                    text: "RAG test content",
                    type: "rag",
                    source: "test-source",
                    metadata: { test: "data" }
                },
                createdAt: Date.now()
            };

            const staticKnowledge: KnowledgeItem = {
                id: "test-id-0000-0000-0000-000000000001" as UUID,
                agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                content: {
                    text: "Static test content",
                    type: "static",
                    source: "inline",
                    metadata: { test: "data" }
                },
                createdAt: Date.now()
            };

            // Test setting both types
            await knowledge.set(mockRuntime, ragKnowledge);
            await knowledge.set(mockRuntime, staticKnowledge);

            // Test retrieving with content matching RAG knowledge
            const results = await knowledge.get(mockRuntime, {
                agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                roomId: "test-room-0000-0000-0000-000000000000" as UUID,
                content: { text: "RAG test" },
                userId: "test-user-0000-0000-0000-000000000000" as UUID
            });

            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty('content.type');
            expect(results[0]).toHaveProperty('createdAt');
            expect(results[0]).toHaveProperty('content.metadata');
        });

        it("should preserve metadata and source information", async () => {
            const testKnowledge: KnowledgeItem = {
                id: "test-id-0000-0000-0000-000000000002" as UUID,
                agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                content: {
                    text: "Test content with metadata",
                    type: "static",
                    source: "test-file.md",
                    metadata: {
                        author: "Test Author",
                        category: "Test Category"
                    }
                },
                createdAt: Date.now()
            };

            await knowledge.set(mockRuntime, testKnowledge);

            const results = await knowledge.get(mockRuntime, {
                agentId: "test-agent-0000-0000-0000-000000000000" as UUID,
                roomId: "test-room-0000-0000-0000-000000000000" as UUID,
                content: { text: "Test content" },
                userId: "test-user-0000-0000-0000-000000000000" as UUID
            });

            expect(results[0].content.metadata).toEqual({
                author: "Test Author",
                category: "Test Category"
            });
            expect(results[0].content.source).toBe("test-file.md");
        });
    });
});

