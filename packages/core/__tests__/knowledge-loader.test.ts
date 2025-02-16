import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeKnowledgeLoader, BrowserKnowledgeLoader, createKnowledgeLoader } from '../src/knowledge-loader';
import path from 'path';

// Mock fs module before any imports
vi.mock('fs', () => ({
    default: {},
    existsSync: vi.fn(),
    readFileSync: vi.fn()
}));

// Import fs after mocking
import * as fs from 'fs';

// Add this for debugging
console.log('Test file directory:', __dirname);
console.log('Current working directory:', process.cwd());

describe('KnowledgeLoader', () => {
    const fixturesPath = path.resolve(__dirname, 'fixtures', 'knowledge');
    // Add this for debugging
    console.log('Fixtures path:', fixturesPath);
    console.log('Test file path:', path.resolve(fixturesPath, "test.md"));

    describe('NodeKnowledgeLoader', () => {
        let loader: NodeKnowledgeLoader;

        beforeEach(() => {
            loader = new NodeKnowledgeLoader();
            vi.resetAllMocks();
            // Setup default implementations
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue("# Test Document\nThis is a test markdown file.");
        });

        it('should load content from file path', async () => {
            const testPath = path.resolve(fixturesPath, 'test.md');
            const result = await loader.loadContent({
                path: testPath,
                metadata: { type: 'documentation' }
            });

            expect(result).toEqual({
                text: expect.any(String),
                metadata: { type: 'documentation' },
                source: testPath,
                type: 'static'
            });
        });

        it('should load inline content', async () => {
            const result = await loader.loadContent({
                content: 'Test content',
                metadata: { type: 'rules' }
            });

            expect(result).toEqual({
                text: 'Test content',
                metadata: { type: 'rules' },
                source: 'inline',
                type: 'static'
            });
        });

        it('should throw error if neither path nor content provided', async () => {
            await expect(loader.loadContent({
                metadata: { type: 'test' }
            })).rejects.toThrow('Either path or content must be provided');
        });

        it('should throw error if file not found', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await expect(loader.loadContent({
                path: 'nonexistent.md'
            })).rejects.toThrow('Knowledge file not found');
        });

        it('should check if file exists', async () => {
            const existingPath = path.resolve(fixturesPath, 'test.md');
            const nonExistingPath = path.resolve(fixturesPath, 'nonexistent.md');

            vi.mocked(fs.existsSync).mockImplementation((path) => path === existingPath);

            expect(await loader.exists(existingPath)).toBe(true);
            expect(await loader.exists(nonExistingPath)).toBe(false);
        });
    });

    describe('BrowserKnowledgeLoader', () => {
        let loader: BrowserKnowledgeLoader;
        let fetchMock: any;

        beforeEach(() => {
            fetchMock = vi.fn();
            global.fetch = fetchMock;
            loader = new BrowserKnowledgeLoader();
        });

        it('should load content from URL', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('Test content')
            });

            const result = await loader.loadContent({
                path: 'https://example.com/test.md',
                metadata: { type: 'documentation' }
            });

            expect(result).toEqual({
                text: 'Test content',
                metadata: { type: 'documentation' },
                source: 'https://example.com/test.md',
                type: 'static'
            });
            expect(fetchMock).toHaveBeenCalledWith('https://example.com/test.md');
        });

        it('should load inline content', async () => {
            const result = await loader.loadContent({
                content: 'Test content',
                metadata: { type: 'rules' }
            });

            expect(result).toEqual({
                text: 'Test content',
                metadata: { type: 'rules' },
                source: 'inline',
                type: 'static'
            });
        });

        it('should throw error if fetch fails', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            await expect(loader.loadContent({
                path: 'https://example.com/test.md'
            })).rejects.toThrow('Failed to load knowledge file');
        });

        it('should check if URL exists', async () => {
            fetchMock
                .mockResolvedValueOnce({ ok: true })  // First call
                .mockResolvedValueOnce({ ok: false }); // Second call

            expect(await loader.exists('https://example.com/exists.md')).toBe(true);
            expect(await loader.exists('https://example.com/not-exists.md')).toBe(false);
        });
    });

    describe('createKnowledgeLoader', () => {
        const originalWindow = global.window;

        beforeEach(() => {
            if ('window' in global) {
                delete (global as any).window;
            }
        });

        afterEach(() => {
            if (originalWindow) {
                (global as any).window = originalWindow;
            }
        });

        it('should create NodeKnowledgeLoader in Node environment', () => {
            const loader = createKnowledgeLoader();
            expect(loader).toBeInstanceOf(NodeKnowledgeLoader);
        });

        it('should create BrowserKnowledgeLoader in browser environment', () => {
            (global as any).window = {};
            const loader = createKnowledgeLoader();
            expect(loader).toBeInstanceOf(BrowserKnowledgeLoader);
        });
    });
}); 