const fs = require('fs');
const path = require('path');

describe('window.reportProduct', () => {
    beforeAll(() => {
        const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/shop.js'), 'utf8');

        // Execute shop.js context
        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptContent;
        document.head.appendChild(scriptEl);
    });

    let mockAlert;
    let mockPrompt;

    beforeEach(() => {
        mockAlert = jest.fn();
        mockPrompt = jest.fn();

        window.alert = mockAlert;
        window.prompt = mockPrompt;

        // Mock default behavior for supabase
        window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
            },
            from: jest.fn().mockReturnValue({
                insert: jest.fn().mockResolvedValue({ error: null })
            })
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should do nothing if prompt is cancelled (returns null)', async () => {
        mockPrompt.mockReturnValue(null);
        await window.reportProduct('product-1');

        expect(mockPrompt).toHaveBeenCalled();
        expect(window.supabaseClient.auth.getUser).not.toHaveBeenCalled();
        expect(mockAlert).not.toHaveBeenCalled();
    });

    test('should do nothing if prompt returns empty string', async () => {
        mockPrompt.mockReturnValue('');
        await window.reportProduct('product-1');

        expect(mockPrompt).toHaveBeenCalled();
        expect(window.supabaseClient.auth.getUser).not.toHaveBeenCalled();
        expect(mockAlert).not.toHaveBeenCalled();
    });

    test('should show alert and return if user is not logged in', async () => {
        mockPrompt.mockReturnValue('Spam content');
        window.supabaseClient.auth.getUser = jest.fn().mockResolvedValue({ data: { user: null } });

        await window.reportProduct('product-1');

        expect(window.supabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalledWith("請先登入帳號");
        expect(window.supabaseClient.from).not.toHaveBeenCalled();
    });

    test('should insert report and show success alert on successful execution', async () => {
        mockPrompt.mockReturnValue('Inappropriate image');
        const mockInsert = jest.fn().mockResolvedValue({ error: null });
        window.supabaseClient.from = jest.fn().mockReturnValue({ insert: mockInsert });

        await window.reportProduct('product-1');

        expect(window.supabaseClient.from).toHaveBeenCalledWith('reports');
        expect(mockInsert).toHaveBeenCalledWith([{
            product_id: 'product-1',
            reporter_id: 'user-123',
            reason: 'Inappropriate image'
        }]);
        expect(mockAlert).toHaveBeenCalledWith("📢 感謝檢舉，我們將儘速審核。");
    });

    test('should show failure alert if insert fails with an error', async () => {
        mockPrompt.mockReturnValue('Fake item');
        const mockInsert = jest.fn().mockResolvedValue({ error: new Error('Insert failed') });
        window.supabaseClient.from = jest.fn().mockReturnValue({ insert: mockInsert });

        await window.reportProduct('product-1');

        expect(mockAlert).toHaveBeenCalledWith("檢舉失敗");
    });

    test('should show failure alert if an exception is thrown in try block', async () => {
        mockPrompt.mockReturnValue('Fake item');
        window.supabaseClient.auth.getUser = jest.fn().mockRejectedValue(new Error('Network error'));

        await window.reportProduct('product-1');

        expect(mockAlert).toHaveBeenCalledWith("檢舉失敗");
    });
});
