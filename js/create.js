/**
 * js/create.js - 2026 終極完整穩定版
 * 功能：
 * 1. 影像 WebP 預處理與二進位鎖定 (解決 35KB 破圖問題)
 * 2. 欄位精準對齊 (Posts 表使用 media_url)
 * 3. 檔名自動淨化 (防止長檔名導致 R2 讀取失敗)
 * 4. 完整的 UI 預覽與滑動關閉邏輯
 */

// --- 🛡️ 0. 全域工具函數 ---
window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * ✨ 影像處理：加固 WebP 版
 * 確保解碼完成後再壓縮，並提供原檔回退機制
 */
async function generateWebPBlob(file) {
    // 如果是影片，直接回傳原檔，不進行 WebP 轉換
    if (file.type.startsWith('video/')) return file;

    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        // 使用 decode 確保瀏覽器已完全解析影像數據，避免產出損毀的空殼檔案
        img.decode().then(() => {
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
            
            // 填滿白色背景防止透明區塊在轉換時變黑
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, width, height);
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                // 如果生成的 Blob 過小 (損毀)，則回退使用原始檔案
                if (!blob || blob.size < 2000) {
                    resolve(file);
                } else {
                    resolve(blob);
                }
                URL.revokeObjectURL(img.src);
            }, 'image/webp', 0.85);
        }).catch(err => {
            console.error("影像解碼失敗，改用原始檔案:", err);
            resolve(file); 
        });
    });
}

/**
 * ✨ R2 上傳核心 (強制使用與商店版一致的二進位傳輸模式)
 */
async function uploadToR2(blob, fileName) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    const formData = new FormData();
    // 關鍵：將處理後的數據流與乾淨檔名封裝
    formData.append('file', blob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Worker 回傳異常');
    
    // 返回 Worker 代理網址，確保讀取時具備正確的 CORS 與標頭
    return result.url;
}

// --- 🖼️ 1. UI 控制與預覽邏輯 ---

let selectedFile = null;

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

// 處理媒體選擇預覽
window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; 
    
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? document.getElementById('video-preview') : document.getElementById('media-preview');
    const other = isVideo ? document.getElementById('media-preview') : document.getElementById('video-preview');
    
    // 隱藏非活動的預覽框與佔位符
    if(other) { other.classList.add('hidden'); other.src = ''; }
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

/**
 * 重置上傳表單狀態
 */
function resetUploadForm() {
    selectedFile = null;
    const ids = ['post-price', 'post-caption'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    
    const paidCheck = document.getElementById('view-paid');
    if (paidCheck) paidCheck.checked = false;

    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.getElementById('media-placeholder');
    
    if(mediaPreview) { mediaPreview.classList.add('hidden'); mediaPreview.src = ''; }
    if(videoPreview) { videoPreview.classList.add('hidden'); videoPreview.src = ''; }
    if(placeholder) placeholder.classList.remove('hidden');
    
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
}

// 觸控滑動關閉邏輯 (DOM 載入後執行)
document.addEventListener('DOMContentLoaded', () => {
    const uploadPanel = document.getElementById('upload-panel');
    let startY = 0;
    if (uploadPanel) {
        uploadPanel.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        uploadPanel.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            if (currentY - startY > 80) window.closeUploadModal();
        }, { passive: true });
    }
});

// --- 🚀 2. 發佈貼文主邏輯 ---

window.publishPost = async function() {
    const btn = document.querySelector('#upload-panel button.bg-sexify');
    if(!btn) return;
    const originalText = btn.innerText;
    
    btn.innerText = "驗證身分...";
    btn.disabled = true;

    try {
        const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
        if (authError || !user) throw new Error('請先登入！');

        const caption = document.getElementById('post-caption').value.trim();
        const price = parseInt(document.getElementById('post-price').value) || 0;
        const isPaid = document.getElementById('view-paid').checked;

        if (!selectedFile && !caption) throw new Error('請輸入內容或選擇檔案');

        let mediaUrl = '';

        if (selectedFile) {
            btn.innerText = "🚀 優化媒體上傳中...";
            
            // 1. 生成 WebP Blob (跟商店成功的邏輯一致)
            const blob = await generateWebPBlob(selectedFile);
            
            // 2. 檔名清洗：使用極簡命名法，杜絕特殊字元解析錯誤
            const randomID = Math.random().toString(36).substring(7);
            const extension = selectedFile.type.startsWith('video/') ? (selectedFile.name.split('.').pop() || 'mp4') : 'webp';
            const cleanFileName = `${Date.now()}_${randomID}.${extension}`;

            // 3. 執行 R2 上傳
            mediaUrl = await uploadToR2(blob, cleanFileName);
        }

        btn.innerText = "💾 存入資料庫...";
        
        // ✨ 核心修正：將資料寫入 posts 表的 media_url 欄位
        const { error: dbError } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: window.escapeHTML(caption),
            media_url: mediaUrl, // 貼文表使用 media_url
            is_paid: isPaid,
            price: price
        }]);

        if (dbError) throw dbError;

        alert('✨ 貼文發佈成功！');
        window.closeUploadModal();
        
        // 刷新頁面顯示新內容
        if (typeof window.renderDiscovery === 'function') {
            window.renderDiscovery();
        } else {
            location.reload();
        }

    } catch (err) {
        console.error("發佈失敗詳情:", err);
        alert('發佈失敗: ' + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

/**
 * 貼文刪除功能
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

        alert('🗑️ 貼文已刪除！');
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
    } catch (err) {
        alert('刪除失敗: ' + err.message);
    }
};
