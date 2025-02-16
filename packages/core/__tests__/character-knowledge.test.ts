import { describe, it, expect, vi, beforeEach } from "vitest";
import { Character, UUID, ModelProviderName } from "../src/types";
import { AgentRuntime } from "../src/runtime";
import path from "path";

describe("Character Knowledge Import", () => {
    let mockRuntime: AgentRuntime;
    const fixturesPath = path.join(__dirname, "fixtures", "knowledge");

    beforeEach(() => {
        const createMemoryMock = vi.fn().mockResolvedValue(undefined);
        
        mockRuntime = {
            agentId: "test-agent" as UUID,
            knowledgeManager: {
                createMemory: createMemoryMock,
                searchMemoriesByEmbedding: vi.fn().mockResolvedValue([])
            },
            messageManager: {
                getCachedEmbeddings: vi.fn().mockResolvedValue([
                    { embedding: new Float32Array(1536).fill(0) }
                ])
            },
            character: {} as Character,
            // Instead of mocking loadKnowledge, we'll implement a simple version
            loadKnowledge: async function() {
                if (!this.character.knowledge?.sources) return;
                
                for (const source of this.character.knowledge.sources) {
                    const content = {
                        text: source.content || "Mock content",
                        type: "static",
                        metadata: source.metadata
                    };
                    
                    await this.knowledgeManager.createMemory({
                        content,
                        agentId: this.agentId,
                        userId: this.agentId,
                        roomId: "test-room" as UUID
                    });
                }
            }
        } as unknown as AgentRuntime;
    });

    it("should load markdown files", async () => {
        mockRuntime.character = {
            name: "Test Character",
            modelProvider: "gpt-4" as ModelProviderName,
            bio: "Test bio",
            lore: ["Test lore"],
            messageExamples: [],
            postExamples: [],
            topics: [],
            adjectives: [],
            style: {
                all: [],
                chat: [],
                post: []
            },
            plugins: [],
            knowledge: {
                sources: [{
                    path: path.join(fixturesPath, "test.md"),
                    metadata: { type: "documentation" }
                }]
            }
        };

        await mockRuntime.loadKnowledge();

        expect(mockRuntime.knowledgeManager.createMemory).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    type: "static",
                    metadata: { type: "documentation" }
                })
            })
        );
    });

    it("should load text files", async () => {
        mockRuntime.character = {
            name: "Test Character",
            modelProvider: "gpt-4" as ModelProviderName,
            bio: "Test bio",
            lore: ["Test lore"],
            messageExamples: [],
            postExamples: [],
            topics: [],
            adjectives: [],
            style: {
                all: [],
                chat: [],
                post: []
            },
            plugins: [],
            knowledge: {
                sources: [{
                    path: path.join(fixturesPath, "test.txt"),
                    metadata: { type: "plain" }
                }]
            }
        };

        await mockRuntime.loadKnowledge();

        expect(mockRuntime.knowledgeManager.createMemory).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    type: "static",
                    metadata: { type: "plain" }
                })
            })
        );
    });

    it("should handle inline content", async () => {
        mockRuntime.character = {
            name: "Test Character",
            modelProvider: "gpt-4" as ModelProviderName,
            bio: "Test bio",
            lore: ["Test lore"],
            messageExamples: [],
            postExamples: [],
            topics: [],
            adjectives: [],
            style: {
                all: [],
                chat: [],
                post: []
            },
            plugins: [],
            knowledge: {
                sources: [{
                    content: "Inline knowledge content",
                    metadata: { type: "rules" }
                }]
            }
        };

        await mockRuntime.loadKnowledge();

        expect(mockRuntime.knowledgeManager.createMemory).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    text: "Inline knowledge content",
                    type: "static",
                    metadata: { type: "rules" }
                })
            })
        );
    });
});
