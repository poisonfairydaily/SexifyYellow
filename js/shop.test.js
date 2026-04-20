
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

describe('refreshBalanceUI', () => {
    let originalConsoleError;
    let mockSupabaseClient;

    beforeEach(() => {
        originalConsoleError = console.error;
        console.error = jest.fn();

        // Clear DOM
        document.body.innerHTML = '';

        // Add required DOM elements
        const balanceDisplay = document.createElement('div');
        balanceDisplay.id = 'user-balance';
        document.body.appendChild(balanceDisplay);

        const shopBalance = document.createElement('div');
        shopBalance.id = 'shop-balance-display';
        document.body.appendChild(shopBalance);

        const pcBalance = document.createElement('div');
        pcBalance.id = 'pc-balance';
        document.body.appendChild(pcBalance);

        // Mock Supabase Client setup
        mockSupabaseClient = {
            auth: {
                getUser: jest.fn()
            },
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn()
        };

        global.window.supabaseClient = mockSupabaseClient;
        global.document = document;
    });

    afterEach(() => {
        console.error = originalConsoleError;
        delete global.window.supabaseClient;
    });

    test('should return early if no user is authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null } });

        await global.window.refreshBalanceUI();

        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockSupabaseClient.from).not.toHaveBeenCalled();

        expect(String(document.getElementById('user-balance').innerText || '')).toBe('');
        expect(String(document.getElementById('shop-balance-display').innerText || '')).toBe('');
        expect(String(document.getElementById('pc-balance').innerText || '')).toBe('');
    });

    test('should update DOM elements with balance if user is authenticated', async () => {
        const mockUser = { id: '123' };
        const mockBalanceData = { balance: 500 };

        mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
        mockSupabaseClient.single.mockResolvedValue({ data: mockBalanceData });

        await global.window.refreshBalanceUI();

        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
        expect(mockSupabaseClient.select).toHaveBeenCalledWith('balance');
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockUser.id);
        expect(mockSupabaseClient.single).toHaveBeenCalled();

        expect(String(document.getElementById('user-balance').innerText)).toBe('500');
        expect(String(document.getElementById('shop-balance-display').innerText)).toBe('500');
        expect(String(document.getElementById('pc-balance').innerText)).toBe('500');
    });

    test('should handle missing elements gracefully', async () => {
        document.body.innerHTML = ''; // Remove DOM elements

        const mockUser = { id: '123' };
        const mockBalanceData = { balance: 500 };

        mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
        mockSupabaseClient.single.mockResolvedValue({ data: mockBalanceData });

        await global.window.refreshBalanceUI();

        expect(mockSupabaseClient.single).toHaveBeenCalled();
        // Just verify it doesn't throw
        expect(console.error).not.toHaveBeenCalled();
    });

    test('should log error if API call fails', async () => {
        const mockError = new Error('API Error');
        mockSupabaseClient.auth.getUser.mockRejectedValue(mockError);

        await global.window.refreshBalanceUI();

        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(mockError);
    });
});
