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

describe('viewOtherProfile Error Handling', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="other-profile-modal" class="hidden translate-x-full"></div>
        `;

        // Mock getAuthenticatedUserId globally
        window.getAuthenticatedUserId = jest.fn().mockResolvedValue('user-1');
        console.error = jest.fn(); // Mock console.error
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('handles Supabase fetch error correctly', async () => {
        const mockError = new Error('Database connection failed');

        // Mock window.supabaseClient.from().select().eq().single() chain
        window.supabaseClient = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: null, error: mockError })
                    })
                })
            })
        };

        await window.viewOtherProfile('user-2');

        // Check if getAuthenticatedUserId was called
        expect(window.getAuthenticatedUserId).toHaveBeenCalled();

        // Check if modal was opened
        const modal = document.getElementById('other-profile-modal');
        expect(modal.classList.contains('flex')).toBe(true);
        expect(modal.classList.contains('hidden')).toBe(false);

        // Check if console.error was called with the mock error
        expect(console.error).toHaveBeenCalledWith(mockError);
    });
});

describe('switchFansTab Error Handling', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="tab-fans" class="text-gray-400 border-transparent">粉絲</div>
            <div id="tab-subs" class="text-gray-400 border-transparent">訂閱</div>
            <div id="fans-subs-list"></div>
        `;

        window.getAuthenticatedUserId = jest.fn().mockResolvedValue('user-1');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('handles Supabase fetch error correctly for fans tab', async () => {
        const mockError = new Error('Database connection failed');

        window.supabaseClient = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: mockError })
                })
            })
        };

        await window.switchFansTab('fans');

        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toContain('讀取失敗');
    });

    test('handles Supabase fetch error correctly for subs tab', async () => {
        const mockError = new Error('Database connection failed');

        window.supabaseClient = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: mockError })
                })
            })
        };

        await window.switchFansTab('subs');

        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toContain('讀取失敗');
    });

    test('handles empty state correctly for fans tab', async () => {
        window.supabaseClient = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: [], error: null })
                })
            })
        };

        await window.switchFansTab('fans');
        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toContain('目前還沒有粉絲');
    });

    test('handles empty state correctly for subs tab', async () => {
        window.supabaseClient = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: [], error: null })
                })
            })
        };

        await window.switchFansTab('subs');
        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toContain('尚未訂閱任何用戶');
    });

    test('handles missing user profile correctly for fans tab (graceful degradation)', async () => {
        window.supabaseClient = {
            from: jest.fn((table) => {
                if (table === 'subscriptions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ id: 'sub-1', subscriber_id: 'user-2', creator_id: 'user-1' }],
                                error: null
                            })
                        })
                    };
                }
                if (table === 'profiles') {
                    return {
                        select: jest.fn().mockReturnValue({
                            in: jest.fn().mockResolvedValue({ data: [] }) // Missing user record
                        })
                    };
                }
            })
        };

        await window.switchFansTab('fans');
        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toBe(''); // Should return empty string for missing user
    });

    test('handles missing user profile correctly for subs tab (graceful degradation)', async () => {
        window.supabaseClient = {
            from: jest.fn((table) => {
                if (table === 'subscriptions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ id: 'sub-1', subscriber_id: 'user-1', creator_id: 'user-2' }],
                                error: null
                            })
                        })
                    };
                }
                if (table === 'profiles') {
                    return {
                        select: jest.fn().mockReturnValue({
                            in: jest.fn().mockResolvedValue({ data: null }) // Missing user record (null data)
                        })
                    };
                }
            })
        };

        await window.switchFansTab('subs');
        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toBe(''); // Should return empty string for missing user
    });

    test('handles database error when fetching profiles for fans tab', async () => {
        const mockError = new Error('Profile fetch failed');
        window.supabaseClient = {
            from: jest.fn((table) => {
                if (table === 'subscriptions') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({
                                data: [{ id: 'sub-1', subscriber_id: 'user-2', creator_id: 'user-1' }],
                                error: null
                            })
                        })
                    };
                }
                if (table === 'profiles') {
                    return {
                        select: jest.fn().mockReturnValue({
                            in: jest.fn().mockResolvedValue({ data: null, error: mockError }) // Force an error
                        })
                    };
                }
            })
        };

        await window.switchFansTab('fans');
        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toBe(''); // It shouldn't crash, instead it will map over subs, and fail to find the user profile.
    });

    test('handles unexpected synchronous errors in fans tab', async () => {
        // By making from() throw a synchronous error, we test the catch block explicitly.
        window.supabaseClient = {
            from: jest.fn().mockImplementation(() => {
                throw new Error('Unexpected sync error');
            })
        };

        await window.switchFansTab('fans');
        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toContain('讀取失敗');
    });

    test('handles database error correctly when missing table properties', async () => {
        window.supabaseClient = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    // Intentionally return undefined for data and error to trigger fallback/crash behaviors safely handled by try-catch
                    eq: jest.fn().mockResolvedValue({ data: undefined, error: undefined })
                })
            })
        };

        await window.switchFansTab('fans');
        const list = document.getElementById('fans-subs-list');
        expect(list.innerHTML).toContain('目前還沒有粉絲');
    });
});
