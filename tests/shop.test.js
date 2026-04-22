const fs = require('fs');
const path = require('path');

describe('window.reportProduct', () => {
    let mockAlert;
    let mockPrompt;
    let mockSupabaseClient;

beforeAll(() => {
        // Setup mock DOM elements before script loads to prevent TypeError
        document.body.innerHTML = `
            <div id="loading"></div>
            <div id="product-container"></div>
            <button id="category-all"></button>
            <button id="category-digital"></button>
            <button id="category-physical"></button>
            <button id="category-service"></button>
            <div id="mobile-menu"></div>
            <div id="unread-badge"></div>
        `;

        // Mock methods that might be called globally
        global.localStorage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {}
        };

        window.getAuthenticatedUserId = jest.fn().mockResolvedValue('user-1');

        const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/shop.js'), 'utf8');

        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptContent;
        document.head.appendChild(scriptEl);
    });

    beforeEach(() => {
        // Reset and setup global mocks
        mockAlert = jest.fn();
        global.alert = mockAlert;

        mockPrompt = jest.fn();
        global.prompt = mockPrompt;

        mockSupabaseClient = {
            auth: {
                getUser: jest.fn()
            },
            from: jest.fn().mockReturnValue({
                insert: jest.fn()
            })
        };
        global.window.supabaseClient = mockSupabaseClient;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return without action if reason is empty or canceled', async () => {
        mockPrompt.mockReturnValue("");

        await window.reportProduct("prod123");

        expect(mockPrompt).toHaveBeenCalledWith("請說明檢舉原因 (濫用檢舉將被限制帳號)：");
        expect(mockAlert).not.toHaveBeenCalled();
        expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
    });

    test('should alert login message if user is not logged in', async () => {
        mockPrompt.mockReturnValue("spam");
        mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null } });

        await window.reportProduct("prod123");

        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalledWith("請先登入帳號");
        expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    test('should successfully report and alert thank you message', async () => {
        mockPrompt.mockReturnValue("inappropriate content");
        mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user456" } } });

        const mockInsert = jest.fn().mockResolvedValue({ error: null });
        mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

        await window.reportProduct("prod789");

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
        expect(mockInsert).toHaveBeenCalledWith([{
            product_id: "prod789", reporter_id: "user456", reason: "inappropriate content"
        }]);
        expect(mockAlert).toHaveBeenCalledWith("📢 感謝檢舉，我們將儘速審核。");
    });

    test('should alert failure message if Supabase insert returns an error', async () => {
        mockPrompt.mockReturnValue("scam");
        mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user456" } } });

        const mockInsert = jest.fn().mockResolvedValue({ error: new Error("Database error") });
        mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

        await window.reportProduct("prod789");

        expect(mockAlert).toHaveBeenCalledWith("檢舉失敗");
    });

    test('should handle exceptions gracefully from getUser and alert failure message', async () => {
        mockPrompt.mockReturnValue("fake");
        mockSupabaseClient.auth.getUser.mockRejectedValue(new Error("Network error"));

        await window.reportProduct("prod789");

        expect(mockAlert).toHaveBeenCalledWith("檢舉失敗");
    });
});
