const fs = require('fs');
const path = require('path');

describe('window.handleShare', () => {
    let originalAlert;
    let originalShare;
    let originalClipboard;

    beforeAll(() => {
        // Set up globals
        originalWindow = global.window;
        originalNavigator = global.navigator;
        originalConsoleLog = console.log;
        originalAlert = global.alert;

        global.window = {
            location: { origin: 'http://localhost' }
        };
        Object.defineProperty(global, 'navigator', { value: {}, writable: true });
        global.document = {
            addEventListener: jest.fn() // to prevent errors when evaluating app.js
        };

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
