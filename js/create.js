/**
 * js/create.js - 究極 WebP 壓縮 + R2 同步上傳完整版
 * 功能：滑動關閉、WebP 智能壓縮、二進制串流修正、Supabase 貼文同步
 * 修正：解決 R2 破圖、MIME 類型不符、Object Preview 顯示文字問題
 */

// --- 🛡️ 0. 工具函數 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 將檔案轉為 WebP Blob (核心修復：確保上傳到 R2 的是標準影像數據)
 */
async function generateWebPBlob(file) {
    // 如果是影片，直接回傳原檔，不進行 WebP 轉換
    if (file.type.startsWith('video/')) return file;

    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const max_size = 1200; // 限制最大寬度/高度，優化載入速度
            let width = img.width, height = img.height;
            
            if (width > height) { 
                if (width > max_size) { height *= max_size / width; width = max_size; } 
            } else { 
                if (height > max_size) { width *= max_size / height; height = max_size; } 
            }
            
            canvas.width = width; 
            canvas.height = height;
            ctx.imageSmoothingEnabled = true; 
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            // 轉換為 WebP 格式，品質設定為 0.85
            canvas.toBlob((blob) => {
                resolve(blob);
                URL.revokeObjectURL(img.src); // 釋放記憶體
            }, 'image/webp', 0.85); 
        };
    });
}

// --- 🖼️ 1. UI 互動與預覽邏輯 ---

window.openUploadModal = function() {
    const modal = document.getElementById('upload-modal');
    const panel = document.getElementById('upload-panel');
    if (modal) modal.classList.remove('hidden');
    if (panel) setTimeout(() => panel.classList.remove('translate-y-full'), 10);
};

window.closeUploadModal = function() {
    const panel = document.getElementById('upload-panel');
    const modal = document.getElementById('upload-modal');
    if (panel) panel.classList.add('translate-y-full');
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        resetUploadForm();
    }, 300);
};

// 觸控往下滑動關閉面板邏輯
document.addEventListener('DOMContentLoaded', () => {
    const uploadPanel = document.getElementById('upload-panel');
    let startY = 0;

    if (uploadPanel) {
        uploadPanel.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        uploadPanel.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            // 手指下滑超過 80px 觸發關閉
            if (currentY - startY > 80) {
                window.closeUploadModal();
            }
        }, { passive: true });
        
        // 面板上方的拖動條點擊也能關閉
        const dragHandle = uploadPanel.querySelector('.w-12.h-1\\.5.bg-gray-200');
        if (dragHandle) {
            dragHandle.style.cursor = 'pointer';
            dragHandle.addEventListener('click', window.closeUploadModal);
        }
    }
});

let selectedFile = null;

/**
 * 處理媒體選擇與預覽
 */
window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; 
    
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? document.getElementById('video-preview') : document.getElementById('media-preview');
    const other = isVideo ? document.getElementById('media-preview') : document.getElementById('video-preview');
    
    // 隱藏另一個預覽框
    if (other) {
        other.classList.add('hidden');
        other.src = '';
    }
    
    // 隱藏佔位符
    const placeholder = document.getElementById('media-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = function(event) {
        if (preview) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
        }
        const container = document.getElementById('media-preview-container');
        if (container) container.dataset.mediaType = isVideo ? 'video' : 'image';
    };
    reader.readAsDataURL(file);
};

/**
 * 重置上傳表單狀態
 */
function resetUploadForm() {
    selectedFile = null;
    ['post-price', 'post-caption'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const viewPaidEl = document.getElementById('view-paid');
    if (viewPaidEl) viewPaidEl.checked = false;

    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.getElementById('media-placeholder');
    const container = document.getElementById('media-preview-container');

    if (mediaPreview) { mediaPreview.classList.add('hidden'); mediaPreview.src = ''; }
    if (videoPreview) { videoPreview.classList.add('hidden'); videoPreview.src = ''; }
    if (placeholder) placeholder.classList.remove('hidden');
    if (container) container.dataset.mediaType = ''; 
    
    // 重置 input file 的數值，讓同一個檔案可以連續選取
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
}

// --- 🚀 2. R2 上傳核心 (修復二進位傳輸問題) ---

/**
 * 執行 R2 上傳
 * ✨ 修正：確保發送的是 Blob + 檔名，觸發 Worker 的 ArrayBuffer 讀取
 */
async function uploadToR2(file) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    
    // 1. 進行影像預處理 (轉為 WebP 節省空間並校正格式)
    const processedBlob = await generateWebPBlob(file);
    
    // 2. 生成標準化檔名
    const timestamp = Date.now();
    const isVideo = file.type.startsWith('video/');
    const extension = isVideo ? (file.name.split('.').pop() || 'mp4') : 'webp';
    const fileName = `${timestamp}_post.${extension}`;

    const formData = new FormData();
    // ✨ 第三個參數 fileName 極其重要，確保 Worker 抓到正確標頭
    formData.append('file', processedBlob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorDetail = await response.text();
        console.error("R2 Worker 錯誤回應:", errorDetail);
        throw new Error('影像上傳失敗，請檢查伺服器連線');
    }
    
    const result = await response.json();
    if (!result.success || !result.url) {
        throw new Error(result.error || 'R2 返回網址無效');
    }
    
    return result.url; // 返回如 https://your-worker.dev/media/xxx.webp
}

// --- 📝 3. 發佈貼文主邏輯 ---

window.publishPost = async function() {
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');
    if (!publishBtn) return;
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

        // 檢查基本內容
        if (!selectedFile && !caption) {
            throw new Error('請輸入文字內容或選擇檔案上傳！');
        }

        let finalMediaUrl = '';

        // 如果有選取檔案，則執行 R2 上傳
        if (selectedFile) {
            publishBtn.innerText = "🚀 正在優化並上傳媒體...";
            finalMediaUrl = await uploadToR2(selectedFile);
        }

        publishBtn.innerText = "💾 正在存入資料庫...";
        const safeCaption = escapeHTML(caption);
        
        // 將資料寫入 Supabase 的 posts 表
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
        
        // 如果有渲染函數則刷新頁面
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();

    } catch (err) {
        console.error("發佈流程失敗:", err);
        alert(err.message);
    } finally {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
    }
};

/**
 * 刪除貼文邏輯
 */
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
        
        // 刷新列表
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
        if (typeof window.renderProfile === 'function') window.renderProfile(); 
    } catch (err) {
        console.error("刪除失敗:", err);
        alert('刪除失敗: ' + err.message);
    }
};
