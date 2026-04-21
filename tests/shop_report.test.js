const fs = require('fs');
const path = require('path');

describe('window.reportProduct', () => {
    beforeAll(() => {
        const shopJsPath = path.join(__dirname, '../js/shop.js');
        const shopJsCode = fs.readFileSync(shopJsPath, 'utf8');

        // Evaluate shop.js code in the current global context to make window.reportProduct available
        const scriptEl = document.createElement('script');
        scriptEl.textContent = shopJsCode;
        document.head.appendChild(scriptEl);
    });

    let originalPrompt;
    let originalAlert;
    let originalSupabaseClient;

    beforeEach(() => {
        // Save originals just in case
        originalPrompt = global.prompt;
        originalAlert = global.alert;
        originalSupabaseClient = window.supabaseClient;

        // Mock prompt and alert
        global.prompt = jest.fn();
        global.alert = jest.fn();

        // Setup base mock for supabaseClient
        window.supabaseClient = {
            auth: {
                getUser: jest.fn()
            },
            from: jest.fn().mockReturnThis(),
            insert: jest.fn()
        };
    });

    afterEach(() => {
        // Restore
        global.prompt = originalPrompt;
        global.alert = originalAlert;
        window.supabaseClient = originalSupabaseClient;
        jest.restoreAllMocks();
    });

    test('handles empty reason correctly (cancels prompt)', async () => {
        global.prompt.mockReturnValue('');

        await window.reportProduct('prod123');

        expect(global.prompt).toHaveBeenCalled();
        expect(global.alert).not.toHaveBeenCalled();
        expect(window.supabaseClient.auth.getUser).not.toHaveBeenCalled();
    });

    test('handles not logged in user', async () => {
        global.prompt.mockReturnValue('spam');
        window.supabaseClient.auth.getUser.mockResolvedValue({ data: { user: null } });

        await window.reportProduct('prod123');

        expect(global.prompt).toHaveBeenCalled();
        expect(window.supabaseClient.auth.getUser).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith('請先登入帳號');
        expect(window.supabaseClient.from).not.toHaveBeenCalled();
    });

    test('handles successful report', async () => {
        global.prompt.mockReturnValue('inappropriate content');
        window.supabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user456' } } });

        const insertMock = jest.fn().mockResolvedValue({ error: null });
        window.supabaseClient.from.mockReturnValue({ insert: insertMock });

        await window.reportProduct('prod789');

        expect(global.prompt).toHaveBeenCalled();
        expect(window.supabaseClient.auth.getUser).toHaveBeenCalled();
        expect(window.supabaseClient.from).toHaveBeenCalledWith('reports');
        expect(insertMock).toHaveBeenCalledWith([{
            product_id: 'prod789', reporter_id: 'user456', reason: 'inappropriate content'
        }]);
        expect(global.alert).toHaveBeenCalledWith('📢 感謝檢舉，我們將儘速審核。');
    });

    test('handles database insert error correctly', async () => {
        global.prompt.mockReturnValue('scam');
        window.supabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'user456' } } });

        const mockError = new Error('Database error');
        const insertMock = jest.fn().mockResolvedValue({ error: mockError });
        window.supabaseClient.from.mockReturnValue({ insert: insertMock });

        await window.reportProduct('prod789');

        expect(global.alert).toHaveBeenCalledWith('檢舉失敗');
    });

    test('handles network error (getUser exception) gracefully', async () => {
        global.prompt.mockReturnValue('fake');
        window.supabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

        await window.reportProduct('prod789');

        expect(global.alert).toHaveBeenCalledWith('檢舉失敗');
    });
});
