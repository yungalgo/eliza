import type { AgentRuntime } from "./runtime";
import { embed, getEmbeddingZeroVector } from "./embedding.ts";
import type { KnowledgeItem, UUID, Memory, SearchOptions } from "./types";
import { stringToUuid } from "./uuid.ts";
import { splitChunks } from "./generation.ts";
import { elizaLogger } from './logger';
import { createKnowledgeLoader } from './knowledge-loader';
import { v4 } from 'uuid';

const knowledgeLoader = createKnowledgeLoader();

async function get(
    runtime: AgentRuntime,
    message: Memory,
    options: SearchOptions = { roomId: runtime.agentId as UUID }
): Promise<KnowledgeItem[]> {
    try {
        const embedding = await runtime.messageManager.getCachedEmbeddings(message.content.text);
        if (!embedding || embedding.length === 0) {
            elizaLogger.warn('Empty processed text for knowledge query');
            return [];
        }

        const memories = await runtime.knowledgeManager.searchMemoriesByEmbedding(
            embedding[0].embedding,
            {
                match_threshold: options.match_threshold || 0.7,
                count: options.count || 5,
                roomId: options.roomId,
                unique: options.unique
            }
        );

        return memories.map(memory => ({
            id: memory.id || v4() as UUID,
            agentId: memory.agentId,
            content: {
                ...memory.content,
                embedding: memory.content.embedding 
                    ? new Float32Array(memory.content.embedding as number[])
                    : undefined
            },
            createdAt: memory.createdAt || Date.now()
        }));

    } catch (error) {
        elizaLogger.error('Failed to get knowledge items', {
            error,
            message
        });
        return [];
    }
}

async function set(runtime: AgentRuntime, item: KnowledgeItem): Promise<void> {
    try {
        // If the item has a path but no text content, load it
        if (item.content.source && !item.content.text) {
            const loadedContent = await knowledgeLoader.loadContent({
                path: item.content.source,
                metadata: item.content.metadata
            });
            item.content = {
                ...item.content,
                ...loadedContent
            };
        }

        // Generate embedding if not present
        if (!item.content.embedding) {
            const embedding = await runtime.messageManager.getCachedEmbeddings(item.content.text);
            if (embedding && embedding.length > 0) {
                // Ensure embedding is properly typed as number[]
                const embeddingArray = embedding[0].embedding as number[];
                item.content.embedding = new Float32Array(embeddingArray);
            }
        }

        await runtime.knowledgeManager.createMemory({
            id: item.id,
            userId: runtime.agentId, // Add required userId
            agentId: item.agentId,
            content: item.content,
            createdAt: item.createdAt,
            roomId: runtime.agentId as UUID // Use agentId as roomId for knowledge
        });

    } catch (error) {
        elizaLogger.error('Failed to set knowledge item', {
            error,
            item
        });
        throw error;
    }
}

export function preprocess(content: string): string {
    elizaLogger.debug("Preprocessing text:", {
        input: content,
        length: content?.length,
    });

    if (!content || typeof content !== "string") {
        elizaLogger.warn("Invalid input for preprocessing");
        return "";
    }

    return (
        content
            // Remove code blocks and their content
            .replace(/```[\s\S]*?```/g, "")
            // Remove inline code
            .replace(/`.*?`/g, "")
            // Convert headers to plain text with emphasis
            .replace(/#{1,6}\s*(.*)/g, "$1")
            // Remove image links but keep alt text
            .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
            // Remove links but keep text
            .replace(/\[(.*?)\]\(.*?\)/g, "$1")
            // Simplify URLs: remove protocol and simplify to domain+path
            .replace(/(https?:\/\/)?(www\.)?([^\s]+\.[^\s]+)/g, "$3")
            // Remove Discord mentions specifically
            .replace(/<@[!&]?\d+>/g, "")
            // Remove HTML tags
            .replace(/<[^>]*>/g, "")
            // Remove horizontal rules
            .replace(/^\s*[-*_]{3,}\s*$/gm, "")
            // Remove comments
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*/g, "")
            // Normalize whitespace
            .replace(/\s+/g, " ")
            // Remove multiple newlines
            .replace(/\n{3,}/g, "\n\n")
            // Remove special characters except those common in URLs
            .replace(/[^a-zA-Z0-9\s\-_./:?=&]/g, "")
            .trim()
            .toLowerCase()
    );
}

export default {
    get,
    set,
    preprocess,
};
