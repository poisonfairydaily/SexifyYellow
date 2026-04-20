const fs = require('fs');
const path = require('path');

describe('window.handleShare', () => {
    let originalWindow;
    let originalNavigator;
    let originalConsoleLog;
    let originalAlert;

    beforeAll(() => {
        // Set up globals
        originalWindow = global.window;
        originalNavigator = global.navigator;
        originalConsoleLog = console.log;
        originalAlert = global.alert;

        global.window = {
            location: { origin: 'http://localhost' }
        };
        global.navigator = {};
        global.document = {
            addEventListener: jest.fn() // to prevent errors when evaluating app.js
        };

        // Load app.js
        const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
        eval(appCode);
    });

    afterAll(() => {
        global.window = originalWindow;
        global.navigator = originalNavigator;
        console.log = originalConsoleLog;
        global.alert = originalAlert;
        delete global.document;
    });

    beforeEach(() => {
        console.log = jest.fn();
        global.alert = jest.fn();
        global.navigator = {}; // Reset navigator mocks
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
