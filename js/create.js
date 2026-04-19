/**
 * js/create.js - 究極 WebP 壓縮 + R2 同步上傳版
 * 包含：滑動關閉、WebP 智能壓縮、二進制串流修正
 */

// --- 🛡️ 0. 工具函數 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 將檔案轉為 WebP Blob (核心修復：確保上傳到 R2 的是標準影像格式)
async function generateWebPBlob(file) {
    // 如果是影片，直接回傳原檔，不進行 WebP 轉換
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
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85); 
        };
    });
}

// --- 🖼️ 1. UI 互動與預覽邏輯 ---

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

// 觸控往下滑動關閉面板
document.addEventListener('DOMContentLoaded', () => {
    const uploadPanel = document.getElementById('upload-panel');
    let startY = 0;

    if (uploadPanel) {
        uploadPanel.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        uploadPanel.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            if (currentY - startY > 80) {
                window.closeUploadModal();
            }
        }, { passive: true });
        
        const dragHandle = uploadPanel.querySelector('.w-12.h-1\\.5.bg-gray-200');
        if(dragHandle) {
            dragHandle.style.cursor = 'pointer';
            dragHandle.addEventListener('click', window.closeUploadModal);
        }
    }
});

let selectedFile = null;

window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; 
    
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? document.getElementById('video-preview') : document.getElementById('media-preview');
    const other = isVideo ? document.getElementById('media-preview') : document.getElementById('video-preview');
    
    if(other) {
        other.classList.add('hidden');
        other.src = '';
    }
    const placeholder = document.getElementById('media-placeholder');
    if(placeholder) placeholder.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = function(event) {
        if(preview) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
        }
        const container = document.getElementById('media-preview-container');
        if(container) container.dataset.mediaType = isVideo ? 'video' : 'image';
    };
    reader.readAsDataURL(file);
};

function resetUploadForm() {
    selectedFile = null;
    ['post-price', 'post-caption'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const viewPaidEl = document.getElementById('view-paid');
    if (viewPaidEl) viewPaidEl.checked = false;

    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.getElementById('media-placeholder');
    const container = document.getElementById('media-preview-container');

    if(mediaPreview) { mediaPreview.classList.add('hidden'); mediaPreview.src = ''; }
    if(videoPreview) { videoPreview.classList.add('hidden'); videoPreview.src = ''; }
    if(placeholder) placeholder.classList.remove('hidden');
    if(container) container.dataset.mediaType = ''; 
}

// --- 🚀 2. R2 上傳核心 (核心修復處) ---

async function uploadToR2(file) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    
    // 1. 進行影像預處理 (轉為 WebP)
    const processedBlob = await generateWebPBlob(file);
    
    // 2. 生成檔名
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    const fileName = file.type.startsWith('video/') ? `${timestamp}_${safeName}` : `${timestamp}_${safeName}.webp`;

    const formData = new FormData();
    // ✨ 這裡一定要帶入檔名，讓 Worker 能夠識別擴展名
    formData.append('file', processedBlob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorDetail = await response.text();
        console.error("R2 上傳報錯回應:", errorDetail);
        throw new Error('影像傳輸失敗，伺服器拒絕請求');
    }
    
    const result = await response.json();
    if (!result.success || !result.url) throw new Error(result.error || 'R2 返回網址無效');
    
    return result.url;
}

// --- 📝 3. 發佈主邏輯 ---

window.publishPost = async function() {
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');
    if(!publishBtn) return;
    const originalBtnText = publishBtn.innerText;
    
    publishBtn.innerText = "驗證身分中...";
    publishBtn.disabled = true;

    try {
        const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
        if (authError || !user) throw new Error('請先登入！');

        const captionEl = document.getElementById('post-caption');
        const caption = captionEl ? captionEl.value.trim() : '';
        const priceEl = document.getElementById('post-price');
        const price = priceEl ? parseInt(priceEl.value) || 0 : 0;
        const viewPaidEl = document.getElementById('view-paid');
        const isPaid = viewPaidEl ? viewPaidEl.checked : false;

        if (!selectedFile && !caption) throw new Error('請輸入文字內容或上傳檔案！');

        let finalMediaUrl = '';

        if (selectedFile) {
            publishBtn.innerText = "🚀 正在優化影像並上傳...";
            finalMediaUrl = await uploadToR2(selectedFile);
        }

        publishBtn.innerText = "💾 寫入資料庫...";
        const safeCaption = escapeHTML(caption);
        
        const { error: dbError } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: safeCaption,
            media_url: finalMediaUrl,
            is_paid: isPaid,
            price: price
        }]);

        if (dbError) throw dbError;

        alert('✨ 貼文發佈成功！');
        window.closeUploadModal();
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();

    } catch (err) {
        console.error("發佈流程失敗:", err);
        alert(err.message);
    } finally {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
    }
};

window.deletePost = async function(postId) {
    if (!confirm('確定要刪除這篇貼文嗎？此動作無法復原。')) return;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error('請先登入！');

        const { error } = await window.supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId)
            .eq('user_id', user.id);

        if (error) throw error;

        alert('🗑️ 貼文已成功刪除！');
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
        if (typeof window.renderProfile === 'function') window.renderProfile(); 
    } catch (err) {
        alert('刪除失敗: ' + err.message);
    }
};
