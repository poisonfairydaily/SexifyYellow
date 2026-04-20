const fs = require('fs');
const path = require('path');

describe('uploadMediaToSupabase', () => {
    let uploadMediaToSupabase;
    let originalWindow;
    let originalConsoleError;

    beforeAll(() => {
        originalWindow = global.window;
        originalConsoleError = console.error;
        global.window = {};
        const code = fs.readFileSync(path.join(__dirname, '../js/messages.js'), 'utf-8');

        // Extract the function using new Function to ensure it's captured
        const extractFn = new Function('window', `
            ${code}
            return uploadMediaToSupabase;
        `);
        uploadMediaToSupabase = extractFn(global.window);
    });

    afterAll(() => {
        global.window = originalWindow;
        console.error = originalConsoleError;
    });

    beforeEach(() => {
        console.error = jest.fn();

        // Mock supabaseClient
        global.window.supabaseClient = {
            storage: {
                from: jest.fn().mockReturnThis(),
                upload: jest.fn(),
                getPublicUrl: jest.fn()
            }
        };
    });

    test('should upload successfully and return public url', async () => {
        const fileBlob = new Blob(['test'], { type: 'image/png' });
        const filePath = 'test/path.png';
        const expectedPublicUrl = 'https://example.com/test/path.png';

        global.window.supabaseClient.storage.upload.mockResolvedValueOnce({ data: {}, error: null });
        global.window.supabaseClient.storage.getPublicUrl.mockReturnValueOnce({
            data: { publicUrl: expectedPublicUrl }
        });

        const result = await uploadMediaToSupabase(fileBlob, filePath);

        expect(global.window.supabaseClient.storage.from).toHaveBeenCalledWith('media');
        expect(global.window.supabaseClient.storage.upload).toHaveBeenCalledWith(
            filePath,
            fileBlob,
            { cacheControl: '3600', upsert: false }
        );
        expect(global.window.supabaseClient.storage.getPublicUrl).toHaveBeenCalledWith(filePath);
        expect(result).toBe(expectedPublicUrl);
    });

    test('should throw error if upload fails', async () => {
        const fileBlob = new Blob(['test'], { type: 'image/png' });
        const filePath = 'test/path.png';
        const mockError = new Error('Upload failed');

        global.window.supabaseClient.storage.upload.mockResolvedValueOnce({ data: null, error: mockError });

        await expect(uploadMediaToSupabase(fileBlob, filePath)).rejects.toThrow('Upload failed');

        expect(console.error).toHaveBeenCalledWith('Supabase 上傳失敗:', mockError);
        expect(global.window.supabaseClient.storage.getPublicUrl).not.toHaveBeenCalled();
    });
});
