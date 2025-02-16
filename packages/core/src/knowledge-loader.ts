import { IKnowledgeLoader } from './types';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

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

        const filePath = join(process.cwd(), source.path);
        if (!existsSync(filePath)) {
            throw new Error(`Knowledge file not found: ${filePath}`);
        }

        return {
            text: readFileSync(filePath, 'utf-8'),
            metadata: source.metadata,
            source: source.path,
            type: 'static' as const
        };
    }

    async exists(path: string): Promise<boolean> {
        return existsSync(join(process.cwd(), path));
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