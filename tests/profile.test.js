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

describe('Fans and Subs Tabs Error Handling', () => {
    let list;
    let btnFans;
    let btnSubs;

    beforeEach(() => {
        // Setup document body
        document.body.innerHTML = `
            <div id="tab-fans"></div>
            <div id="tab-subs"></div>
            <div id="fans-subs-list"></div>
        `;
        list = document.getElementById('fans-subs-list');
        btnFans = document.getElementById('tab-fans');
        btnSubs = document.getElementById('tab-subs');

        // Mock dependencies
        window.getAuthenticatedUserId = jest.fn().mockResolvedValue('test-user-id');
        window.supabaseClient = {
            from: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should show error message when fetching fans fails', async () => {
        window.supabaseClient.from.mockImplementation((table) => {
            if (table === 'subscriptions') {
                return {
                    select: () => ({
                        eq: jest.fn().mockResolvedValue({ data: null, error: new Error('Database Error') })
                    })
                };
            }
        });

        await window.switchFansTab('fans');

        expect(list.innerHTML).toContain('讀取失敗');
    });

    test('should show error message when fetching subs fails', async () => {
        window.supabaseClient.from.mockImplementation((table) => {
            if (table === 'subscriptions') {
                return {
                    select: () => ({
                        eq: jest.fn().mockResolvedValue({ data: null, error: new Error('Database Error') })
                    })
                };
            }
        });

        await window.switchFansTab('subs');

        expect(list.innerHTML).toContain('讀取失敗');
    });
});
