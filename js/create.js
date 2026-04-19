/**
 * js/create.js - 2026 終極修復版
 * 修正：欄位對齊 (media_url)、二進位強制轉換、檔名淨化
 */

window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * 影像處理：加固版 (與商店版 creator.js 邏輯同步)
 */
async function generateWebPBlob(file) {
    if (file.type.startsWith('video/')) return file;

    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const max_size = 1200; 
            let width = img.width, height = img.height;

            if (width > height) {
                if (width > max_size) { height *= max_size / width; width = max_size; }
            } else {
                if (height > max_size) { width *= max_size / height; height = max_size; }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                resolve(blob || file);
                URL.revokeObjectURL(img.src);
            }, 'image/webp', 0.85);
        };
        img.onerror = () => resolve(file);
    });
}

/**
 * R2 上傳核心 (強制使用二進位傳輸)
 */
async function uploadToR2(blob, fileName) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    const formData = new FormData();
    // ✨ 確保這裡傳送的是二進位數據 + 乾淨檔名
    formData.append('file', blob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('R2 上傳失敗');
    const result = await response.json();
    return result.url;
}

// --- UI 控制 ---
let selectedFile = null;

window.openUploadModal = function() {
    document.getElementById('upload-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('upload-panel').classList.remove('translate-y-full');
    }, 10);
};

window.closeUploadModal = function() {
    document.getElementById('upload-panel').classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('upload-modal').classList.add('hidden');
        resetUploadForm();
    }, 300);
};

window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; 
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? document.getElementById('video-preview') : document.getElementById('media-preview');
    
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = (event) => {
        preview.src = event.target.result;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
};

function resetUploadForm() {
    selectedFile = null;
    document.getElementById('post-caption').value = '';
    document.getElementById('post-price').value = '';
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.remove('hidden');
}

// --- 🚀 發佈主邏輯 ---
window.publishPost = async function() {
    const btn = document.querySelector('#upload-panel button.bg-sexify');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "🚀 上傳中...";

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error('請先登入');

        let finalUrl = '';
        if (selectedFile) {
            const blob = await generateWebPBlob(selectedFile);
            // ✨ 淨化檔名，防止特殊字元導致 R2 讀取失敗
            const cleanName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
            finalUrl = await uploadToR2(blob, cleanName);
        }

        btn.innerText = "💾 存入資料庫...";
        // ✨ 關鍵：確保這裡使用的是 media_url 欄位
        const { error } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: window.escapeHTML(document.getElementById('post-caption').value),
            media_url: finalUrl, // 貼文用 media_url
            is_paid: document.getElementById('view-paid').checked,
            price: parseInt(document.getElementById('post-price').value) || 0
        }]);

        if (error) throw error;
        alert('✨ 發佈成功！');
        window.closeUploadModal();
        location.reload(); 

    } catch (err) {
        alert('失敗: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
