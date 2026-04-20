
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

describe('executeSecurePurchase', () => {
    beforeEach(() => {
        global.document = {
            createElement: (tag) => ({ textContent: '', innerHTML: '' }),
            addEventListener: () => {},
            getElementById: () => null,
            body: { style: {} }
        };
        global.window = {};
        global.alert = jest.fn();
        global.confirm = jest.fn(() => true);
        global.prompt = jest.fn();

        // Load shop.js
        const shopJsPath = path.join(__dirname, 'shop.js');
        const shopJsCode = fs.readFileSync(shopJsPath, 'utf8');
        eval(shopJsCode);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should alert when not logged in', async () => {
        global.window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: null } })
            }
        };

        await window.executeSecurePurchase('prod_1', 'Test Item', 100, 5, 'digital');
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('交易異常'));
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('請先登入帳號'));
    });

    test('should return early and not call DB if user cancels', async () => {
        global.confirm.mockReturnValueOnce(false);

        const getUserMock = jest.fn().mockResolvedValue({ data: { user: { id: 'user1' } } });
        global.window.supabaseClient = {
            auth: { getUser: getUserMock }
        };

        await window.executeSecurePurchase('prod_1', 'Test Item', 100, 5, 'digital');
        expect(getUserMock).not.toHaveBeenCalled();
    });

    test('should alert when balance is insufficient', async () => {
        global.window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user1' } } })
            },
            from: jest.fn().mockImplementation((table) => {
                if (table === 'profiles') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: jest.fn().mockResolvedValue({ data: { balance: 50 } })
                            })
                        })
                    };
                }
            })
        };

        await window.executeSecurePurchase('prod_1', 'Test Item', 100, 5, 'digital');
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('餘額不足'));
    });

    test('should update balance and insert order on successful purchase', async () => {
        global.window.showNotification = jest.fn();
        global.window.closeProductModal = jest.fn();
        global.window.refreshBalanceUI = jest.fn();
        global.window.renderShop = jest.fn();

        const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
        const insertMock = jest.fn().mockResolvedValue({ error: null });

        global.window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user1' } } })
            },
            from: jest.fn().mockImplementation((table) => {
                if (table === 'profiles') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: jest.fn().mockResolvedValue({ data: { balance: 200 } })
                            })
                        }),
                        update: updateMock
                    };
                }
                if (table === 'orders') {
                    return { insert: insertMock };
                }
            })
        };

        await window.executeSecurePurchase('prod_1', 'Test Item', 100, 5, 'digital');

        expect(updateMock).toHaveBeenCalledWith({ balance: 100 });
        expect(insertMock).toHaveBeenCalledWith({
            user_id: 'user1',
            product_id: 'prod_1',
            amount: 100,
            amount_usd: 0,
            category: 'digital',
            status: 'pending'
        });
        expect(global.window.refreshBalanceUI).toHaveBeenCalled();
    });

    test('should insert order with correct physical category and USD amount', async () => {
        global.window.showNotification = jest.fn();
        global.window.closeProductModal = jest.fn();
        global.window.refreshBalanceUI = jest.fn();
        global.window.renderShop = jest.fn();

        const insertMock = jest.fn().mockResolvedValue({ error: null });

        global.window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user1' } } })
            },
            from: jest.fn().mockImplementation((table) => {
                if (table === 'profiles') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: jest.fn().mockResolvedValue({ data: { balance: 200 } })
                            })
                        }),
                        update: () => ({ eq: jest.fn().mockResolvedValue({ error: null }) })
                    };
                }
                if (table === 'orders') {
                    return { insert: insertMock };
                }
            })
        };

        await window.executeSecurePurchase('prod_2', 'Physical Item', 100, 5, 'physical');

        expect(insertMock).toHaveBeenCalledWith({
            user_id: 'user1',
            product_id: 'prod_2',
            amount: 100,
            amount_usd: 5,
            category: 'physical',
            status: 'pending'
        });
    });

    test('should alert on database error', async () => {
        global.window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user1' } } })
            },
            from: jest.fn().mockImplementation((table) => {
                if (table === 'profiles') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: jest.fn().mockRejectedValue(new Error("DB Error"))
                            })
                        })
                    };
                }
            })
        };

        await window.executeSecurePurchase('prod_1', 'Test Item', 100, 5, 'digital');
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('交易異常'));
    });
});
