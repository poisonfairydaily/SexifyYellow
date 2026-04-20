const fs = require('fs');
const path = require('path');

describe('window.handleShare', () => {
    let originalAlert;
    let originalShare;
    let originalClipboard;

    beforeAll(() => {
        // Set up globals
        originalWindow = global.window;
        originalConsoleLog = console.log;
        originalAlert = global.alert;

        global.window = {
            location: { origin: 'http://localhost' }
        };
        Object.defineProperty(global, 'navigator', { value: {}, writable: true });
        global.document = {
            addEventListener: jest.fn() // to prevent errors when evaluating app.js
        };

        // Redefine global navigator so it is writable
        Object.defineProperty(global, 'navigator', {
            value: {},
            writable: true,
            configurable: true
        });

        // Load app.js
        const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
        // Let's create a script element and append it to JSDOM's document body
        const scriptEl = document.createElement('script');
        scriptEl.textContent = appCode;
        document.head.appendChild(scriptEl);

        originalAlert = window.alert;
        originalShare = navigator.share;
        originalClipboard = navigator.clipboard;
    });

    afterAll(() => {
        window.alert = originalAlert;
        Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    });

    beforeEach(() => {
        console.log = jest.fn();
        window.alert = jest.fn();
        // clear navigator overrides
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    });

    test('should use navigator.share if available', async () => {
        const mockShare = jest.fn().mockResolvedValue();
        Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });

        await window.handleShare('123', 'Test Title');

        expect(mockShare).toHaveBeenCalledWith({
            title: 'SFY 推薦',
            text: 'Test Title',
            url: window.location.origin + '?post=123'
        });
        expect(console.log).not.toHaveBeenCalled();
    });

    test('should use clipboard fallback if navigator.share is not available', async () => {
        const mockWriteText = jest.fn().mockResolvedValue();
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: mockWriteText },
            configurable: true
        });

        await window.handleShare('123', 'Test Title');

        expect(mockWriteText).toHaveBeenCalledWith(window.location.origin + '?post=123');
        expect(window.alert).toHaveBeenCalledWith('連結已複製到剪貼簿！');
        expect(console.log).not.toHaveBeenCalled();
    });

    test('should log error if navigator.share fails', async () => {
        const error = new Error('Share failed');
        const mockShare = jest.fn().mockRejectedValue(error);
        Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true });

        await window.handleShare('123', 'Test Title');

        expect(mockShare).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('分享取消或發生錯誤', error);
    });

    test('should log error if clipboard fallback fails', async () => {
        const error = new Error('Clipboard failed');
        const mockWriteText = jest.fn().mockRejectedValue(error);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: mockWriteText },
            configurable: true
        });

        await window.handleShare('123', 'Test Title');

        expect(mockWriteText).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('分享取消或發生錯誤', error);
    });
});

describe('window.saveUserProfile', () => {
    let originalLocalStorage;
    let originalSupabaseClient;

    beforeEach(() => {
        // Reset console and alert
        console.error = jest.fn();
        global.alert = jest.fn();

        // Mock localStorage
        let store = {};
        originalLocalStorage = window.localStorage;
        Object.defineProperty(window, "localStorage", { value: {
            getItem: jest.fn(key => store[key] || null),
            setItem: jest.fn((key, value) => { store[key] = value; }),
            removeItem: jest.fn(key => { delete store[key]; }),
            clear: jest.fn(() => { store = {}; })
        }, writable: true });;

        // Ensure closeEditProfile and renderProfile are defined
        global.window.closeEditProfile = jest.fn();
        global.window.renderProfile = jest.fn();

        originalSupabaseClient = global.window.supabaseClient;
    });

    afterEach(() => {
        window.localStorage = originalLocalStorage;
        global.window.supabaseClient = originalSupabaseClient;
        delete global.window.closeEditProfile;
        delete global.window.renderProfile;
    });

    test('should return early if userId is not in localStorage', async () => {
        window.localStorage.getItem.mockReturnValue(null);
        const formData = { display_name: 'Test' };

        await window.saveUserProfile(formData);

        expect(global.window.closeEditProfile).not.toHaveBeenCalled();
    });

    test('should handle public update error', async () => {
        window.localStorage.getItem.mockReturnValue('user123');
        const formData = { display_name: 'Test' };

        const mockError = new Error('Public update failed');
        global.window.supabaseClient = {
            from: jest.fn((table) => {
                if (table === 'profiles') {
                    return {
                        update: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({ error: mockError })
                    };
                }
                return {
                    upsert: jest.fn().mockResolvedValue({ error: null })
                };
            })
        };

        await window.saveUserProfile(formData);

        expect(console.error).toHaveBeenCalledWith('更新個人資料失敗:', mockError);
        expect(global.alert).toHaveBeenCalledWith('更新失敗，請檢查資料格式。');
    });

    test('should handle private update error', async () => {
        window.localStorage.getItem.mockReturnValue('user123');
        const formData = { display_name: 'Test' };

        const mockError = new Error('Private update failed');
        global.window.supabaseClient = {
            from: jest.fn((table) => {
                if (table === 'profiles') {
                    return {
                        update: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({ error: null })
                    };
                }
                return {
                    upsert: jest.fn().mockResolvedValue({ error: mockError })
                };
            })
        };

        await window.saveUserProfile(formData);

        expect(console.error).toHaveBeenCalledWith('更新個人資料失敗:', mockError);
        expect(global.alert).toHaveBeenCalledWith('更新失敗，請檢查資料格式。');
    });

    test('should successfully save user profile', async () => {
        window.localStorage.getItem.mockReturnValue('user123');
        const formData = { display_name: 'Test' };

        global.window.supabaseClient = {
            from: jest.fn((table) => {
                if (table === 'profiles') {
                    return {
                        update: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockResolvedValue({ error: null })
                    };
                }
                return {
                    upsert: jest.fn().mockResolvedValue({ error: null })
                };
            })
        };

        await window.saveUserProfile(formData);

        expect(global.alert).toHaveBeenCalledWith('資料儲存成功！');
        expect(global.window.closeEditProfile).toHaveBeenCalled();
        expect(global.window.renderProfile).toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });
});
