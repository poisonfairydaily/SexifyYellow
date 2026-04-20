// js/upload-helper.js
window.uploadMedia = async function(file) {
    if (!file) return '';
    
    const formData = new FormData();
    formData.append('file', file);

    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('R2 Upload Failed');
    const result = await response.json();
    return result.url; 
};

window.generateWebPBlob = async function(file) {
    if (file.type && file.type.startsWith('video/')) return file;
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const max_size = 1200;
            let width = img.width, height = img.height;
            if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
            else { if (height > max_size) { width *= max_size / height; height = max_size; } }
            canvas.width = width; canvas.height = height;
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85);
        };
        img.onerror = () => {
            console.error("影像載入失敗，採用原始檔案上傳");
            resolve(file);
        };
    });
};

window.uploadToR2File = async function(blob, fileName) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/';
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const response = await fetch(WORKER_URL + 'upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`R2 上傳連線失敗: ${response.status}`);

    const result = await response.json();
    if (!result.success && !result.url) throw new Error(result.error || 'Worker 處理異常');

    return result.url;
};
