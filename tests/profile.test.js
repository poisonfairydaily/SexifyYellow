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

describe('openEditProfile try/catch block', () => {
    let originalAlert;
    let originalGetAuthenticatedUserId;

    beforeEach(() => {
        // Mock DOM elements
        document.body.innerHTML = `
            <div id="edit-profile-modal" class="hidden"></div>
            <input id="edit-display-name" />
            <input id="edit-bio" />
            <img id="edit-banner-preview" />
            <div id="banner-placeholder"></div>
            <canvas id="avatar-canvas"></canvas>
        `;

        originalAlert = window.alert;
        window.alert = jest.fn();

        window.supabaseClient = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
                data: {
                    display_name: 'Test User',
                    bio: 'Test Bio',
                    avatar_url: 'http://example.com/avatar.jpg',
                    banner_url: 'http://example.com/banner.jpg'
                }
            })
        };

        window.resetAvatarTransform = jest.fn();

        originalGetAuthenticatedUserId = global.getAuthenticatedUserId;
        global.getAuthenticatedUserId = jest.fn().mockResolvedValue('test-user-id');
        window.getAuthenticatedUserId = global.getAuthenticatedUserId;
    });

    afterEach(() => {
        window.alert = originalAlert;
        global.getAuthenticatedUserId = originalGetAuthenticatedUserId;
        window.getAuthenticatedUserId = originalGetAuthenticatedUserId;
    });

    test('catches error when getAuthenticatedUserId fails and alerts "無法讀取個人資料"', async () => {
        global.getAuthenticatedUserId = jest.fn().mockRejectedValue(new Error('Auth failed'));
        window.getAuthenticatedUserId = global.getAuthenticatedUserId;

        await window.openEditProfile();

        expect(window.alert).toHaveBeenCalledWith('無法讀取個人資料');

        const modal = document.getElementById('edit-profile-modal');
        expect(modal.classList.contains('hidden')).toBe(true);
        expect(modal.classList.contains('flex')).toBe(false);
    });

    test('catches error when Supabase fails and alerts "無法讀取個人資料"', async () => {
        window.supabaseClient.single = jest.fn().mockRejectedValue(new Error('DB connection failed'));

        await window.openEditProfile();

        expect(window.alert).toHaveBeenCalledWith('無法讀取個人資料');

        const modal = document.getElementById('edit-profile-modal');
        expect(modal.classList.contains('hidden')).toBe(true);
        expect(modal.classList.contains('flex')).toBe(false);
    });

    test('successfully populates DOM on valid profile load', async () => {
        await window.openEditProfile();

        expect(document.getElementById('edit-display-name').value).toBe('Test User');
        expect(document.getElementById('edit-bio').value).toBe('Test Bio');

        const modal = document.getElementById('edit-profile-modal');
        expect(modal.classList.contains('hidden')).toBe(false);
        expect(modal.classList.contains('flex')).toBe(true);
    });
});
