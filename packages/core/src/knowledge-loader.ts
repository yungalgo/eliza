import { IKnowledgeLoader } from './types';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

export class NodeKnowledgeLoader implements IKnowledgeLoader {
    async loadContent(source: {
        path?: string;
        content?: string;
        metadata?: Record<string, any>;
    }) {
        if (source.content) {
            return {
                text: source.content,
                metadata: source.metadata,
                source: 'inline',
                type: 'static' as const
            };
        }

        if (!source.path) {
            throw new Error('Either path or content must be provided');
        }

        if (!existsSync(source.path)) {
            throw new Error(`Knowledge file not found: ${source.path}`);
        }

        return {
            text: readFileSync(source.path, 'utf-8'),
            metadata: source.metadata,
            source: source.path,
            type: 'static' as const
        };
    }

    async exists(path: string): Promise<boolean> {
        return existsSync(path);
    }
}

export class BrowserKnowledgeLoader implements IKnowledgeLoader {
    async loadContent(source: {
        path?: string;
        content?: string;
        metadata?: Record<string, any>;
    }) {
        if (source.content) {
            return {
                text: source.content,
                metadata: source.metadata,
                source: 'inline',
                type: 'static' as const
            };
        }

        if (!source.path) {
            throw new Error('Either path or content must be provided');
        }

        const response = await fetch(source.path);
        if (!response.ok) {
            throw new Error(`Failed to load knowledge file: ${source.path}`);
        }

        return {
            text: await response.text(),
            metadata: source.metadata,
            source: source.path,
            type: 'static' as const
        };
    }

    async exists(path: string): Promise<boolean> {
        try {
            const response = await fetch(path, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }
}

// Factory function to create the appropriate loader
export function createKnowledgeLoader(): IKnowledgeLoader {
    if (typeof window === 'undefined') {
        return new NodeKnowledgeLoader();
    }
    return new BrowserKnowledgeLoader();
} 