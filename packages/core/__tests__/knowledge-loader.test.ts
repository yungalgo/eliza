import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeKnowledgeLoader, BrowserKnowledgeLoader, createKnowledgeLoader } from '../src/knowledge-loader';
import { readFileSync, existsSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    existsSync: vi.fn()
}));

// Mock fetch for browser environment
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('KnowledgeLoader', () => {
    describe('NodeKnowledgeLoader', () => {
        let loader: NodeKnowledgeLoader;

        beforeEach(() => {
            loader = new NodeKnowledgeLoader();
            vi.clearAllMocks();
        });

        it('should load content from file', async () => {
            const mockContent = 'test content';
            (readFileSync as any).mockReturnValue(mockContent);
            (existsSync as any).mockReturnValue(true);

            const result = await loader.loadContent({
                path: 'test.txt',
                metadata: { test: true }
            });

            expect(result).toEqual({
                text: mockContent,
                metadata: { test: true },
                source: 'test.txt',
                type: 'static'
            });
        });

        it('should handle inline content', async () => {
            const result = await loader.loadContent({
                content: 'inline content',
                metadata: { test: true }
            });

            expect(result).toEqual({
                text: 'inline content',
                metadata: { test: true },
                source: 'inline',
                type: 'static'
            });
        });

        it('should throw error if file not found', async () => {
            (existsSync as any).mockReturnValue(false);

            await expect(loader.loadContent({
                path: 'nonexistent.txt'
            })).rejects.toThrow('Knowledge file not found');
        });

        it('should handle different file paths', async () => {
            (readFileSync as any).mockReturnValue('test content');
            (existsSync as any).mockReturnValue(true);

            const result = await loader.loadContent({
                path: './relative/path.txt'
            });

            expect(result.source).toBe('./relative/path.txt');
        });
    });

    describe('BrowserKnowledgeLoader', () => {
        let loader: BrowserKnowledgeLoader;

        beforeEach(() => {
            loader = new BrowserKnowledgeLoader();
            vi.clearAllMocks();
        });

        it('should load content from URL', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('test content')
            });

            const result = await loader.loadContent({
                path: 'https://example.com/test.txt',
                metadata: { test: true }
            });

            expect(result).toEqual({
                text: 'test content',
                metadata: { test: true },
                source: 'https://example.com/test.txt',
                type: 'static'
            });
        });

        it('should handle inline content', async () => {
            const result = await loader.loadContent({
                content: 'inline content',
                metadata: { test: true }
            });

            expect(result).toEqual({
                text: 'inline content',
                metadata: { test: true },
                source: 'inline',
                type: 'static'
            });
        });

        it('should throw error if fetch fails', async () => {
            mockFetch.mockResolvedValue({
                ok: false
            });

            await expect(loader.loadContent({
                path: 'https://example.com/nonexistent.txt'
            })).rejects.toThrow('Failed to load knowledge file');
        });

        it('should handle different URL formats', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('test content')
            });

            const result = await loader.loadContent({
                path: '/api/knowledge/test.txt'
            });

            expect(result.source).toBe('/api/knowledge/test.txt');
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(loader.exists('/error.txt')).resolves.toBe(false);
        });
    });

    describe('createKnowledgeLoader', () => {
        it('should create NodeKnowledgeLoader in Node environment', () => {
            const globalWindow = global.window;
            // @ts-ignore - Intentionally removing window to test Node environment
            global.window = undefined;
            
            const loader = createKnowledgeLoader();
            expect(loader).toBeInstanceOf(NodeKnowledgeLoader);
            
            global.window = globalWindow;
        });

        it('should create BrowserKnowledgeLoader in browser environment', () => {
            // Mock window object to simulate browser environment
            const globalWindow = global.window;
            // @ts-ignore - Mocking window for browser environment test
            global.window = { location: { origin: 'http://localhost' } };
            
            const loader = createKnowledgeLoader();
            expect(loader).toBeInstanceOf(BrowserKnowledgeLoader);
            
            global.window = globalWindow;
        });
    });
}); 