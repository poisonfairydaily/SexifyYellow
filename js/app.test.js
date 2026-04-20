const fs = require('fs');
const path = require('path');

describe('window.handleShare', () => {
    let originalWindow;
    let originalConsoleLog;
    let originalAlert;

    beforeAll(() => {
        // Set up globals
        originalWindow = global.window;
        originalConsoleLog = console.log;
        originalAlert = global.alert;

        global.window = {
            location: { origin: 'http://localhost' }
        };
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
        let appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
        eval(appCode);
    });

    afterAll(() => {
        global.window = originalWindow;
        console.log = originalConsoleLog;
        global.alert = originalAlert;
        delete global.document;
    });

    beforeEach(() => {
        console.log = jest.fn();
        global.alert = jest.fn();

        // Reset navigator mocks
        global.navigator = {};
    });

    test('should use navigator.share if available', async () => {
        global.navigator.share = jest.fn().mockResolvedValue();

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.share).toHaveBeenCalledWith({
            title: 'SFY 推薦',
            text: 'Test Title',
            url: 'http://localhost?post=123'
        });
        expect(console.log).not.toHaveBeenCalled();
    });

    test('should use clipboard fallback if navigator.share is not available', async () => {
        global.navigator.clipboard = {
            writeText: jest.fn().mockResolvedValue()
        };

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost?post=123');
        expect(global.alert).toHaveBeenCalledWith('連結已複製到剪貼簿！');
        expect(console.log).not.toHaveBeenCalled();
    });

    test('should log error if navigator.share fails', async () => {
        const error = new Error('Share failed');
        global.navigator.share = jest.fn().mockRejectedValue(error);

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.share).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('分享取消或發生錯誤', error);
    });

    test('should log error if clipboard fallback fails', async () => {
        const error = new Error('Clipboard failed');
        global.navigator.clipboard = {
            writeText: jest.fn().mockRejectedValue(error)
        };

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.clipboard.writeText).toHaveBeenCalled();
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
