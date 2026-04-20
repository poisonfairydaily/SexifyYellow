const fs = require('fs');
const path = require('path');

describe('window.handleShare', () => {
    let originalConsoleLog;
    let originalAlert;
    let originalShare;
    let originalClipboard;

    beforeAll(() => {
        originalConsoleLog = console.log;
        originalAlert = global.alert;
        originalShare = global.navigator.share;
        originalClipboard = global.navigator.clipboard;

        // Clean way to handle window.location
        delete global.window.location;
        global.window.location = new URL('http://localhost');

        global.document.addEventListener = jest.fn();

        const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
        eval(appCode);
    });

    afterAll(() => {
        console.log = originalConsoleLog;
        global.alert = originalAlert;
        global.navigator.share = originalShare;
        global.navigator.clipboard = originalClipboard;
    });

    beforeEach(() => {
        console.log = jest.fn();
        global.alert = jest.fn();

        global.navigator.share = jest.fn();
        global.navigator.clipboard = {
            writeText: jest.fn()
        };
    });

    test('should use navigator.share if available', async () => {
        global.navigator.share.mockResolvedValue();

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.share).toHaveBeenCalledWith({
            title: 'SFY 推薦',
            text: 'Test Title',
            url: 'http://localhost?post=123'
        });
        expect(console.log).not.toHaveBeenCalled();
    });

    test('should use clipboard fallback if navigator.share is not available', async () => {
        delete global.navigator.share;
        global.navigator.clipboard.writeText.mockResolvedValue();

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost?post=123');
        expect(global.alert).toHaveBeenCalledWith('連結已複製到剪貼簿！');
        expect(console.log).not.toHaveBeenCalled();
    });

    test('should log error if navigator.share fails', async () => {
        const error = new Error('Share failed');
        global.navigator.share.mockRejectedValue(error);

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.share).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('分享取消或發生錯誤', error);
    });

    test('should log error if clipboard fallback fails', async () => {
        delete global.navigator.share;
        const error = new Error('Clipboard failed');
        global.navigator.clipboard.writeText.mockRejectedValue(error);

        await window.handleShare('123', 'Test Title');

        expect(global.navigator.clipboard.writeText).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('分享取消或發生錯誤', error);
    });
});
