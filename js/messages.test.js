/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('window.toggleVoiceRecord', () => {
    let originalDateNow;

    beforeAll(() => {
        originalDateNow = Date.now;

        Object.defineProperty(global.navigator, 'mediaDevices', {
            value: {
                getUserMedia: jest.fn().mockResolvedValue({
                    getTracks: () => [{ stop: jest.fn() }]
                })
            },
            writable: true
        });

        // Set up DOM
        document.body.innerHTML = `
            <div onclick="toggleVoiceRecord()"><i></i></div>
            <input id="chat-input" placeholder="original placeholder" />
        `;

        global.window.supabaseClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
            },
            storage: {
                from: jest.fn().mockReturnValue({
                    upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
                    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'mock-url' } })
                })
            }
        };

        class MockMediaRecorder {
            constructor(stream) {
                this.stream = stream;
                this.state = 'inactive';
                this.mimeType = 'audio/webm';
                global.window.mediaRecorder = this;
                global.mediaRecorder = this;
            }
            start() {
                this.state = 'recording';
                if (this.onstart) this.onstart();
            }
            stop() {
                this.state = 'inactive';
                if (this.onstop) {
                    this.onstop();
                }
            }
        }
        global.window.MediaRecorder = MockMediaRecorder;

        global.Date.now = jest.fn().mockReturnValue(123456789);
        global.alert = jest.fn();
        global.console.error = jest.fn();

        const jsPath = path.join(__dirname, 'messages.js');
        const code = fs.readFileSync(jsPath, 'utf8');

        // Execute messages.js code
        eval(code);

        // Ensure getValidUserId is mocked securely
        window.getValidUserId = async () => 'test-user-id';
    });

    afterAll(() => {
        global.Date.now = originalDateNow;
    });

    beforeEach(() => {
        global.window.isRecording = false;
        global.alert.mockClear();

        global.window.handleSendAction = jest.fn().mockResolvedValue();

        global.navigator.mediaDevices.getUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }]
        });

        global.window.supabaseClient.storage.from.mockReturnValue({
            upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
            getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'mock-url' } })
        });
    });

    test('should start and stop recording successfully (happy path)', async () => {
        await global.window.toggleVoiceRecord();
        expect(global.window.isRecording).toBe(true);

        if (global.mediaRecorder && global.mediaRecorder.ondataavailable) {
            global.mediaRecorder.ondataavailable({ data: { size: 10, value: 'test' } });
        }

        await global.window.toggleVoiceRecord();
        expect(global.window.isRecording).toBe(false);

        await new Promise(process.nextTick);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(global.window.handleSendAction).toHaveBeenCalled();
    });

    test('should handle microphone permission denial', async () => {
        global.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error("Permission denied"));

        await global.window.toggleVoiceRecord();

        expect(global.window.isRecording).toBe(false);
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('無法開啟麥克風'));
    });

    test('should handle upload error correctly', async () => {
        const mockUpload = jest.fn().mockRejectedValue(new Error("Upload failed"));
        global.window.supabaseClient.storage.from.mockReturnValue({
            upload: mockUpload,
            getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'mock-url' } })
        });

        await global.window.toggleVoiceRecord();
        expect(global.window.isRecording).toBe(true);

        await global.window.toggleVoiceRecord();

        await new Promise(process.nextTick);
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(global.window.isRecording).toBe(false);
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('語音上傳失敗'));
    });
});
