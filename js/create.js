/**
 * js/create.js - 2026 穩定重製版
 * 同步成功模組：100% 移植 creator.js 核心邏輯
 */

// --- 🛡️ 0. 安全工具 ---
window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * 核心：WebP 影像處理引擎 (與 creator.js 1:1 同步)
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

/**
 * 核心：R2 上傳引擎 (強化二進位傳輸)
 */
async function uploadToR2(blob, fileName) {
    // 確保這裡的 URL 與你成功的 creator.js 一致
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    
    const formData = new FormData();
    // ✨ 關鍵：三參數 append，確保二進位 Blob 伴隨檔名發送
    formData.append('file', blob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('R2 伺服器拒絕請求');
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || '上傳解析失敗');
    
    return result.url;
}

// --- 🖼️ 1. UI 與預覽邏輯 ---

let selectedFile = null;

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
    const ids = ['post-price', 'post-caption'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    
    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    if(mediaPreview) { mediaPreview.classList.add('hidden'); mediaPreview.src = ''; }
    if(videoPreview) { videoPreview.classList.add('hidden'); videoPreview.src = ''; }
    document.getElementById('media-placeholder').classList.remove('hidden');
    
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
}

// --- 🚀 2. 發佈貼文主邏輯 ---

window.publishPost = async function() {
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');
    if(!publishBtn) return;
    const originalBtnText = publishBtn.innerText;
    
    publishBtn.innerText = "驗證身分...";
    publishBtn.disabled = true;

    try {
        const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
        if (authError || !user) throw new Error('請先登入！');

        const caption = document.getElementById('post-caption').value.trim();
        const price = parseInt(document.getElementById('post-price').value) || 0;
        const isPaid = document.getElementById('view-paid').checked;

        if (!selectedFile && !caption) throw new Error('請輸入內容或選擇檔案');

        let finalMediaUrl = '';

        if (selectedFile) {
            publishBtn.innerText = "🚀 優化影像並上傳...";
            
            // 1. 生成 WebP Blob (跟 creator 一樣)
            const webpBlob = await generateWebPBlob(selectedFile);
            
            // 2. 生成檔名 (避免特殊字元)
            const safeBaseName = selectedFile.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_');
            const ext = selectedFile.type.startsWith('video/') ? (selectedFile.name.split('.').pop() || 'mp4') : 'webp';
            const fileName = `${Date.now()}_post_${safeBaseName}.${ext}`;

            // 3. 上傳 R2
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

        alert('✨ 貼文發佈成功！');
        window.closeUploadModal();
        
        // 觸發重新渲染 (如果首頁有這個函數)
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
        else location.reload(); // 否則強制重新整理

    } catch (err) {
        console.error("發佈失敗:", err);
        alert('發佈失敗: ' + err.message);
    } finally {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
    }
};
