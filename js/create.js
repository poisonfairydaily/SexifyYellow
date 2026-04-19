/**
 * js/create.js - 究極修復完整版
 * 同步 creator.js 的成功上傳邏輯，徹底解決 R2 破圖問題
 */

// --- 🛡️ 工具函數 ---
window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

// 影像預處理 (完全同步 creator.js)
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
            if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
            else { if (height > max_size) { width *= max_size / height; height = max_size; } }
            canvas.width = width; canvas.height = height;
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                resolve(blob);
                URL.revokeObjectURL(img.src);
            }, 'image/webp', 0.85); 
        };
    });
}

// R2 上傳函數 (完全同步 creator.js 成功的雙參數格式)
async function uploadToR2(blob, fileName) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    const formData = new FormData();
    // ✨ 核心修復：強制以「二進制 Blob + 檔名」方式封裝
    formData.append('file', blob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('R2 伺服器拒絕上傳');
    const resData = await response.json();
    if (!resData.success) throw new Error(resData.error || '上傳失敗');
    return resData.url;
}

// --- 🖼️ UI 互動邏輯 ---

window.openUploadModal = function() {
    document.getElementById('upload-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('upload-panel').classList.remove('translate-y-full'), 10);
};

window.closeUploadModal = function() {
    const panel = document.getElementById('upload-panel');
    if (panel) panel.classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('upload-modal').classList.add('hidden');
        resetUploadForm();
    }, 300);
};

let selectedFile = null;

window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; 
    
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? document.getElementById('video-preview') : document.getElementById('media-preview');
    const other = isVideo ? document.getElementById('media-preview') : document.getElementById('video-preview');
    
    if(other) { other.classList.add('hidden'); other.src = ''; }
    document.getElementById('media-placeholder').classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = function(event) {
        preview.src = event.target.result;
        preview.classList.remove('hidden');
        document.getElementById('media-preview-container').dataset.mediaType = isVideo ? 'video' : 'image';
    };
    reader.readAsDataURL(file);
};

function resetUploadForm() {
    selectedFile = null;
    const priceEl = document.getElementById('post-price');
    const captionEl = document.getElementById('post-caption');
    if (priceEl) priceEl.value = '';
    if (captionEl) captionEl.value = '';
    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    if(mediaPreview) { mediaPreview.classList.add('hidden'); mediaPreview.src = ''; }
    if(videoPreview) { videoPreview.classList.add('hidden'); videoPreview.src = ''; }
    document.getElementById('media-placeholder').classList.remove('hidden');
}

// --- 📝 發佈主邏輯 ---

window.publishPost = async function() {
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');
    const originalBtnText = publishBtn.innerText;
    
    publishBtn.innerText = "驗證中...";
    publishBtn.disabled = true;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error('請先登入！');

        const caption = document.getElementById('post-caption').value.trim();
        const price = parseInt(document.getElementById('post-price').value) || 0;
        const isPaid = document.getElementById('view-paid').checked;

        if (!selectedFile && !caption) throw new Error('請輸入內容或上傳檔案');

        let finalMediaUrl = '';

        if (selectedFile) {
            publishBtn.innerText = "🚀 正在優化並上傳...";
            
            // ✨ 這裡完全同步 creator.js 的執行順序
            const webpBlob = await generateWebPBlob(selectedFile);
            
            // 生成檔名：清洗掉非法字元
            const baseName = selectedFile.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_');
            const extension = selectedFile.type.startsWith('video/') ? (selectedFile.name.split('.').pop() || 'mp4') : 'webp';
            const fileName = `${Date.now()}_post_${baseName}.${extension}`;

            // 執行上傳
            finalMediaUrl = await uploadToR2(webpBlob, fileName);
        }

        publishBtn.innerText = "💾 存入資料庫...";
        const { error: dbError } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: window.escapeHTML(caption),
            media_url: finalMediaUrl,
            is_paid: isPaid,
            price: price
        }]);

        if (dbError) throw dbError;

        alert('✨ 發佈成功！');
        window.closeUploadModal();
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();

    } catch (err) {
        alert('發佈失敗: ' + err.message);
    } finally {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
    }
};
