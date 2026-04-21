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

describe('switchFansTab Tests', () => {
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

    describe('Error Handling', () => {
        test('handles Supabase fetch error correctly for fans tab', async () => {
            const mockError = new Error('Database connection failed');
            const mockEq = jest.fn().mockResolvedValue({ data: null, error: mockError });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

            window.supabaseClient = {
                from: mockFrom
            };

            await window.switchFansTab('fans');

            expect(mockFrom).toHaveBeenCalledWith('subscriptions');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockEq).toHaveBeenCalledWith('creator_id', 'user-1');

            const list = document.getElementById('fans-subs-list');
            expect(list.innerHTML).toContain('讀取失敗');
        });

        test('handles Supabase fetch error correctly for subs tab', async () => {
            const mockError = new Error('Database connection failed');
            const mockEq = jest.fn().mockResolvedValue({ data: null, error: mockError });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

            window.supabaseClient = {
                from: mockFrom
            };

            await window.switchFansTab('subs');

            expect(mockFrom).toHaveBeenCalledWith('subscriptions');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockEq).toHaveBeenCalledWith('subscriber_id', 'user-1');

            const list = document.getElementById('fans-subs-list');
            expect(list.innerHTML).toContain('讀取失敗');
        });
    });

    describe('Empty State Handling', () => {
        test('displays empty state for fans tab when no data is returned', async () => {
            const mockEq = jest.fn().mockResolvedValue({ data: [], error: null });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

            window.supabaseClient = {
                from: mockFrom
            };

            await window.switchFansTab('fans');

            expect(mockFrom).toHaveBeenCalledWith('subscriptions');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockEq).toHaveBeenCalledWith('creator_id', 'user-1');

            const list = document.getElementById('fans-subs-list');
            expect(list.innerHTML).toContain('目前還沒有粉絲');
        });

        test('displays empty state for subs tab when no data is returned', async () => {
            const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

            window.supabaseClient = {
                from: mockFrom
            };

            await window.switchFansTab('subs');

            expect(mockFrom).toHaveBeenCalledWith('subscriptions');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockEq).toHaveBeenCalledWith('subscriber_id', 'user-1');

            const list = document.getElementById('fans-subs-list');
            expect(list.innerHTML).toContain('尚未訂閱任何用戶');
        });
    });

    describe('Successful Rendering', () => {
        test('renders list for fans tab correctly', async () => {
            // Mock subscriptions table
            const mockSubsEq = jest.fn().mockResolvedValue({
                data: [{ subscriber_id: 'user-2' }, { subscriber_id: 'user-3' }],
                error: null
            });
            const mockSubsSelect = jest.fn().mockReturnValue({ eq: mockSubsEq });

            // Mock profiles table
            const mockProfsIn = jest.fn().mockResolvedValue({
                data: [
                    { id: 'user-2', display_name: 'Alice', avatar_url: 'alice.jpg' },
                    { id: 'user-3', display_name: 'Bob', avatar_url: 'bob.jpg' }
                ],
                error: null
            });
            const mockProfsSelect = jest.fn().mockReturnValue({ in: mockProfsIn });

            // Combine mocks into the supabaseClient
            const mockFrom = jest.fn((table) => {
                if (table === 'subscriptions') {
                    return { select: mockSubsSelect };
                } else if (table === 'profiles') {
                    return { select: mockProfsSelect };
                }
            });

            window.supabaseClient = {
                from: mockFrom
            };

            await window.switchFansTab('fans');

            expect(mockFrom).toHaveBeenCalledWith('subscriptions');
            expect(mockFrom).toHaveBeenCalledWith('profiles');
            expect(mockProfsIn).toHaveBeenCalledWith('id', ['user-2', 'user-3']);

            const list = document.getElementById('fans-subs-list');
            expect(list.innerHTML).toContain('Alice');
            expect(list.innerHTML).toContain('Bob');
            expect(list.innerHTML).toContain('alice.jpg');
            expect(list.innerHTML).toContain('bob.jpg');
        });

        test('renders list for subs tab correctly', async () => {
            // Mock subscriptions table
            const mockSubsEq = jest.fn().mockResolvedValue({
                data: [{ id: 'sub-1', creator_id: 'user-4' }],
                error: null
            });
            const mockSubsSelect = jest.fn().mockReturnValue({ eq: mockSubsEq });

            // Mock profiles table
            const mockProfsIn = jest.fn().mockResolvedValue({
                data: [
                    { id: 'user-4', display_name: 'Charlie', avatar_url: 'charlie.jpg' }
                ],
                error: null
            });
            const mockProfsSelect = jest.fn().mockReturnValue({ in: mockProfsIn });

            // Combine mocks into the supabaseClient
            const mockFrom = jest.fn((table) => {
                if (table === 'subscriptions') {
                    return { select: mockSubsSelect };
                } else if (table === 'profiles') {
                    return { select: mockProfsSelect };
                }
            });

            window.supabaseClient = {
                from: mockFrom
            };

            await window.switchFansTab('subs');

            expect(mockFrom).toHaveBeenCalledWith('subscriptions');
            expect(mockFrom).toHaveBeenCalledWith('profiles');
            expect(mockProfsIn).toHaveBeenCalledWith('id', ['user-4']);

            const list = document.getElementById('fans-subs-list');
            expect(list.innerHTML).toContain('Charlie');
            expect(list.innerHTML).toContain('charlie.jpg');
            // Subs tab should include unfollow button
            expect(list.innerHTML).toContain('取消追蹤');
            expect(list.innerHTML).toContain("unfollowUserFromList('sub-1', this)");
        });
    });

    describe('Missing Profile Handling', () => {
        test('handles missing user profile gracefully', async () => {
            // Mock subscriptions table with a user that will not be found in profiles
            const mockSubsEq = jest.fn().mockResolvedValue({
                data: [{ subscriber_id: 'user-missing' }],
                error: null
            });
            const mockSubsSelect = jest.fn().mockReturnValue({ eq: mockSubsEq });

            // Mock profiles table to return empty (simulating missing user)
            const mockProfsIn = jest.fn().mockResolvedValue({
                data: [],
                error: null
            });
            const mockProfsSelect = jest.fn().mockReturnValue({ in: mockProfsIn });

            // Combine mocks into the supabaseClient
            const mockFrom = jest.fn((table) => {
                if (table === 'subscriptions') {
                    return { select: mockSubsSelect };
                } else if (table === 'profiles') {
                    return { select: mockProfsSelect };
                }
            });

            window.supabaseClient = {
                from: mockFrom
            };

            await window.switchFansTab('fans');

            const list = document.getElementById('fans-subs-list');
            // Should be empty string from `if(!user) return '';` resulting in empty list.innerHTML
            expect(list.innerHTML).toBe('');
        });
    });
});
