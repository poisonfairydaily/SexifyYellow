const fs = require('fs');
const path = require('path');

describe('window.refreshBalanceUI', () => {
    let originalSupabaseClient;

    beforeAll(() => {
        const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/shop.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptContent;
        document.head.appendChild(scriptEl);
    });

    beforeEach(() => {
        originalSupabaseClient = window.supabaseClient;

        // Set up the DOM elements
        document.body.innerHTML = `
            <div id="user-balance"></div>
            <div id="shop-balance-display"></div>
            <div id="pc-balance"></div>
        `;

        // Mock console.error
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        window.supabaseClient = originalSupabaseClient;
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    test('updates balance UI when user is authenticated and has a balance', async () => {
        // Mock Supabase
        const mockEq = jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { balance: 150 } })
        });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

        window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
            },
            from: mockFrom
        };

        await window.refreshBalanceUI();

        expect(window.supabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockFrom).toHaveBeenCalledWith('profiles');
        expect(mockSelect).toHaveBeenCalledWith('balance');
        expect(mockEq).toHaveBeenCalledWith('id', 'user-123');

        expect(String(document.getElementById('user-balance').innerText)).toBe('150');
        expect(String(document.getElementById('shop-balance-display').innerText)).toBe('150');
        expect(String(document.getElementById('pc-balance').innerText)).toBe('150');
    });

    test('handles missing balance property (sets to 0)', async () => {
        const mockEq = jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: {} })
        });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

        window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
            },
            from: mockFrom
        };

        await window.refreshBalanceUI();

        expect(String(document.getElementById('user-balance').innerText)).toBe('0');
    });

    test('does nothing if user is not authenticated', async () => {
        window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: null } })
            },
            from: jest.fn()
        };

        await window.refreshBalanceUI();

        expect(window.supabaseClient.from).not.toHaveBeenCalled();
        expect(document.getElementById('user-balance').innerText || document.getElementById('user-balance').textContent).toBe('');
    });

    test('catches and logs error when Supabase auth throws', async () => {
        const mockError = new Error('Auth failed');
        window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockRejectedValue(mockError)
            }
        };

        await window.refreshBalanceUI();

        expect(console.error).toHaveBeenCalledWith(mockError);
        expect(document.getElementById('user-balance').innerText || document.getElementById('user-balance').textContent).toBe('');
    });

    test('catches and logs error when Supabase db throws', async () => {
        const mockError = new Error('DB failed');
        const mockEq = jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(mockError)
        });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

        window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
            },
            from: mockFrom
        };

        await window.refreshBalanceUI();

        expect(console.error).toHaveBeenCalledWith(mockError);
        expect(document.getElementById('user-balance').innerText || document.getElementById('user-balance').textContent).toBe('');
    });
});
