import {
    IAgentRuntime,
    ICacheManager,
    Memory,
    Provider,
    State,
} from "@ai16z/eliza";
import { createGraphRAG } from "./driver";
import { GraphRAGResponse } from "./types";
import NodeCache from "node-cache";
import * as path from "path";

const PROVIDER_CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
};

export class RAGGraphProvider {
    private cache: NodeCache;
    private cacheKey: string = "raggraph";
    private graphRAG;

    constructor(
        private neo4jUri: string,
        private neo4jUser: string,
        private neo4jPassword: string,
        private cacheManager: ICacheManager
    ) {
        this.cache = new NodeCache({ stdTTL: 300 }); // Cache TTL set to 5 minutes
        this.graphRAG = createGraphRAG({
            neo4jUri: this.neo4jUri,
            neo4jUser: this.neo4jUser,
            neo4jPassword: this.neo4jPassword,
        });
    }

    private async readFromCache<T>(key: string): Promise<T | null> {
        const cached = await this.cacheManager.get<T>(
            path.join(this.cacheKey, key)
        );
        return cached;
    }

    private async writeToCache<T>(key: string, data: T): Promise<void> {
        await this.cacheManager.set(path.join(this.cacheKey, key), data, {
            expires: Date.now() + 5 * 60 * 1000,
        });
    }

    async query(userQuery: string): Promise<GraphRAGResponse> {
        const cacheKey = `query-${userQuery}`;

        // Try to get from cache first
        const cached = await this.readFromCache<GraphRAGResponse>(cacheKey);
        if (cached) {
            return cached;
        }

        // If not in cache, perform the query
        const response = await this.graphRAG.query(userQuery);

        // Cache the result
        await this.writeToCache(cacheKey, response);

        return response;
    }

    async close(): Promise<void> {
        await this.graphRAG.close();
    }
}

const ragGraphProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string | null> => {
        try {
            const neo4jUri = runtime.getSetting("NEO4J_URI");
            const neo4jUser = runtime.getSetting("NEO4J_USER");
            const neo4jPassword = runtime.getSetting("NEO4J_PASSWORD");

            const provider = new RAGGraphProvider(
                neo4jUri,
                neo4jUser,
                neo4jPassword,
                runtime.cacheManager
            );

            const response = await provider.query(message.content);
            await provider.close();

            return response.fullContext;
        } catch (error) {
            console.error("Error in RAG graph provider:", error);
            return null;
        }
    },
};

export { ragGraphProvider };
