const fs = require('fs');
const path = require('path');

describe('escapeHTML', () => {
    beforeAll(() => {
        const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/profile.js'), 'utf8');

        // Let's create a script element and append it to JSDOM's document body
        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptContent;
        document.head.appendChild(scriptEl);
    });

    test('is defined', () => {
        expect(window.escapeHTML).toBeDefined();
        expect(typeof window.escapeHTML).toBe('function');
    });

    test('returns empty string for falsy values', () => {
        expect(window.escapeHTML(null)).toBe('');
        expect(window.escapeHTML(undefined)).toBe('');
        expect(window.escapeHTML('')).toBe('');
        expect(window.escapeHTML(0)).toBe('');
        expect(window.escapeHTML(false)).toBe('');
    });

    test('does not modify safe strings', () => {
        expect(window.escapeHTML('hello world')).toBe('hello world');
        expect(window.escapeHTML('12345')).toBe('12345');
        expect(window.escapeHTML('alpha_beta-gamma')).toBe('alpha_beta-gamma');
    });

    test('escapes & character', () => {
        expect(window.escapeHTML('AT&T')).toBe('AT&amp;T');
        expect(window.escapeHTML('&&')).toBe('&amp;&amp;');
    });

    test('escapes < and > characters', () => {
        expect(window.escapeHTML('<div>')).toBe('&lt;div&gt;');
        expect(window.escapeHTML('a < b > c')).toBe('a &lt; b &gt; c');
    });

    test('escapes double quotes', () => {
        expect(window.escapeHTML('He said "hello"')).toBe('He said &quot;hello&quot;');
        expect(window.escapeHTML('""')).toBe('&quot;&quot;');
    });

    test('escapes single quotes', () => {
        expect(window.escapeHTML("It's a test")).toBe('It&#39;s a test');
        expect(window.escapeHTML("''")).toBe('&#39;&#39;');
    });

    test('escapes a combination of characters', () => {
        expect(window.escapeHTML('<script>alert("XSS & \'hacks\'")</script>'))
            .toBe('&lt;script&gt;alert(&quot;XSS &amp; &#39;hacks&#39;&quot;)&lt;/script&gt;');
    });

    test('converts non-string inputs to string before escaping', () => {
        expect(window.escapeHTML(123)).toBe('123');
        expect(window.escapeHTML({ toString: () => '<obj>' })).toBe('&lt;obj&gt;');
    });
});

describe('uploadToR2', () => {
    let originalFetch;
    let originalSupabaseClient;
    let originalDateNow;

    beforeAll(() => {
        originalFetch = global.fetch;
        originalSupabaseClient = window.supabaseClient;
        originalDateNow = Date.now;

        // Mock Date.now to have predictable file names if needed
        Date.now = jest.fn(() => 1234567890);

        window.WORKER_URL = 'http://mock-worker-url';
    });

    afterAll(() => {
        global.fetch = originalFetch;
        window.supabaseClient = originalSupabaseClient;
        Date.now = originalDateNow;
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock getAuthenticatedUserId to return a valid user
        window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null })
            }
        };

        // Suppress console.error in tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        console.error.mockRestore();
    });

    test('successful upload returns URL', async () => {
        const mockUrl = 'https://example.com/avatar.webp';

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                blob: () => Promise.resolve(new Blob(['mock data'], { type: 'image/png' }))
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ url: mockUrl })
            }));

        const url = await window.uploadToR2('data:image/png;base64,mock', 'avatar');

        expect(url).toBe(mockUrl);
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch.mock.calls[1][0]).toBe('http://mock-worker-url/upload');
    });

    test('throws error when worker returns failed status code', async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                blob: () => Promise.resolve(new Blob(['mock data'], { type: 'image/png' }))
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: false,
                status: 500
            }));

        await expect(window.uploadToR2('data:image/png;base64,mock', 'avatar'))
            .rejects
            .toThrow("Worker 回傳失敗狀態碼: 500");

        expect(console.error).toHaveBeenCalled();
    });

    test('throws error when worker response is missing url', async () => {
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                blob: () => Promise.resolve(new Blob(['mock data'], { type: 'image/png' }))
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ error: 'something went wrong' })
            }));

        await expect(window.uploadToR2('data:image/png;base64,mock', 'avatar'))
            .rejects
            .toThrow("Worker 回傳網址失敗");

        expect(console.error).toHaveBeenCalled();
    });

    test('rethrows generic fetch errors', async () => {
        const networkError = new Error("Network connection failed");

        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                blob: () => Promise.resolve(new Blob(['mock data'], { type: 'image/png' }))
            }))
            .mockImplementationOnce(() => Promise.reject(networkError));

        await expect(window.uploadToR2('data:image/png;base64,mock', 'avatar'))
            .rejects
            .toThrow("Network connection failed");

        expect(console.error).toHaveBeenCalledWith("R2 Upload Error:", networkError);
    });
});
