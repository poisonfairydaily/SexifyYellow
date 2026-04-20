
const fs = require('fs');
const path = require('path');

/**
 * shop.test.js - Tests for shop.js functions
 */

// Load the production code
const shopJs = fs.readFileSync(path.resolve(__dirname, 'shop.js'), 'utf8');

describe('getSafeImageUrl', () => {
    let getSafeImageUrl;

    beforeEach(() => {
        // Setup mock environment
        global.window = {};
        global.document = {
            createElement: jest.fn().mockReturnValue({}),
            addEventListener: jest.fn(),
            body: {
                appendChild: jest.fn(),
                style: {}
            }
        };
        global.WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";

        // Execute the production code in the global context
        // In a real browser, this would define window.getSafeImageUrl
        eval(shopJs);

        getSafeImageUrl = global.window.getSafeImageUrl;
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    test('returns placeholder for empty or null url', () => {
        const placeholder = 'https://placehold.co/400x400/eeeeee/999999?text=No+Image';
        expect(getSafeImageUrl('')).toBe(placeholder);
        expect(getSafeImageUrl(null)).toBe(placeholder);
        expect(getSafeImageUrl(undefined)).toBe(placeholder);
    });

    test('handles R2 URLs by prepending WORKER_URL and extracting filename', () => {
        const r2Url = 'https://something.r2.dev/image.jpg';
        const expected = `${global.WORKER_URL}/media/image.jpg`;
        expect(getSafeImageUrl(r2Url)).toBe(expected);

        const r2UrlWithPath = 'https://another.r2.dev/subfolder/photo.png';
        expect(getSafeImageUrl(r2UrlWithPath)).toBe(`${global.WORKER_URL}/media/photo.png`);
    });

    test('handles multiple URLs by taking only the first one', () => {
        const urls = 'https://external.com/1.jpg,https://external.com/2.jpg';
        expect(getSafeImageUrl(urls)).toBe('https://external.com/1.jpg');

        const r2AndHttp = 'https://some.r2.dev/img.jpg,http://example.com/other.jpg';
        expect(getSafeImageUrl(r2AndHttp)).toBe(`${global.WORKER_URL}/media/img.jpg`);
    });

    test('returns external http and https URLs as is', () => {
        const httpUrl = 'http://example.com/photo.png';
        const httpsUrl = 'https://example.com/photo.png';
        expect(getSafeImageUrl(httpUrl)).toBe(httpUrl);
        expect(getSafeImageUrl(httpsUrl)).toBe(httpsUrl);
    });

    test('returns internal path as is when supabaseClient is not available', () => {
        const internalPath = 'products/myimage.jpg';
        expect(getSafeImageUrl(internalPath)).toBe(internalPath);
    });

    test('uses supabaseClient to get public URL for internal paths', () => {
        const internalPath = 'products/myimage.jpg';
        const bucket = 'custom-bucket';
        const mockPublicUrl = 'https://supabase.co/storage/v1/public/custom-bucket/products/myimage.jpg';

        global.window.supabaseClient = {
            storage: {
                from: jest.fn().mockReturnThis(),
                getPublicUrl: jest.fn().mockReturnValue({
                    data: { publicUrl: mockPublicUrl }
                })
            }
        };

        const result = getSafeImageUrl(internalPath, bucket);

        expect(global.window.supabaseClient.storage.from).toHaveBeenCalledWith(bucket);
        expect(global.window.supabaseClient.storage.getPublicUrl).toHaveBeenCalledWith(internalPath);
        expect(result).toBe(mockPublicUrl);
    });

    test('uses default "previews" bucket if not specified', () => {
        const internalPath = 'img.png';
        global.window.supabaseClient = {
            storage: {
                from: jest.fn().mockReturnThis(),
                getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'some-url' } })
            }
        };

        getSafeImageUrl(internalPath);
        expect(global.window.supabaseClient.storage.from).toHaveBeenCalledWith('previews');
    });
});
