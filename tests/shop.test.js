const fs = require('fs');
const path = require('path');

describe('refreshBalanceUI', () => {
    beforeAll(() => {
        // Read the contents of shop.js and inject it into JSDOM
        const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/shop.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptContent;
        document.head.appendChild(scriptEl);
    });

    beforeEach(() => {
        // Reset DOM and add necessary elements
        document.body.innerHTML = `
            <div id="user-balance"></div>
            <div id="shop-balance-display"></div>
            <div id="pc-balance"></div>
        `;

        // Mock console.error
        console.error = jest.fn();

        // Reset global mock for supabaseClient
        window.supabaseClient = {
            auth: {
                getUser: jest.fn()
            },
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn()
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('handles error and calls console.error when auth fails', async () => {
        const mockError = new Error('Auth failed');
        window.supabaseClient.auth.getUser.mockRejectedValue(mockError);

        await window.refreshBalanceUI();

        expect(console.error).toHaveBeenCalledWith(mockError);
    });

    test('handles error and calls console.error when profile fetch fails', async () => {
        const mockError = new Error('Profile fetch failed');
        window.supabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
        window.supabaseClient.from = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockRejectedValue(mockError)
                })
            })
        });

        await window.refreshBalanceUI();

        expect(console.error).toHaveBeenCalledWith(mockError);
    });

    test('updates DOM elements with balance on success', async () => {
        window.supabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
        window.supabaseClient.from = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: { balance: 1500 } })
                })
            })
        });

        await window.refreshBalanceUI();

        expect(String(document.getElementById('user-balance').innerText ?? '')).toBe('1500');
        expect(String(document.getElementById('shop-balance-display').innerText ?? '')).toBe('1500');
        expect(String(document.getElementById('pc-balance').innerText ?? '')).toBe('1500');
        expect(console.error).not.toHaveBeenCalled();
    });

    test('updates DOM elements with 0 if balance is null', async () => {
        window.supabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
        window.supabaseClient.from = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: { balance: null } })
                })
            })
        });

        await window.refreshBalanceUI();

        expect(String(document.getElementById('user-balance').innerText ?? '')).toBe('0');
        expect(String(document.getElementById('shop-balance-display').innerText ?? '')).toBe('0');
        expect(String(document.getElementById('pc-balance').innerText ?? '')).toBe('0');
        expect(console.error).not.toHaveBeenCalled();
    });

    test('returns early without updating DOM if no user is found', async () => {
        window.supabaseClient.auth.getUser.mockResolvedValue({ data: { user: null } });

        await window.refreshBalanceUI();

        // Should not have called from() since it returned early
        expect(window.supabaseClient.from).not.toHaveBeenCalled();

        expect(String(document.getElementById('user-balance').innerText ?? '')).toBe('');
        expect(console.error).not.toHaveBeenCalled();
    });
});
