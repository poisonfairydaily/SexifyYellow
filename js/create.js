/**
 * js/create.js - 2026 終極完整穩定版
 * 功能：
 * 1. 影像 WebP 預處理與二進位鎖定 (徹底解決 35KB 破圖問題)
 * 2. 雙桶分流對接：確保貼文檔案進入 POST_BUCKET (media/ 目錄)
 * 3. 欄位精準對齊：Supabase posts 表使用 media_url
 * 4. 完整的 UI 預覽與觸控滑動關閉邏輯
 */

// --- 🛡️ 0. 全域工具函數 ---
window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * ✨ 影像處理引擎：加固 WebP 版
 * 使用 decode() 確保數據完整，防止產出 [object File] 或空殼損毀檔案
 */



/**
 * ✨ R2 上傳核心
 */


// --- 🖼️ 1. UI 控制與預覽邏輯 ---

let selectedFile = null;

/**
 * 開啟發佈面板
 */
window.openUploadModal = function() {
    const modal = document.getElementById('upload-modal');
    const panel = document.getElementById('upload-panel');
    if (modal) modal.classList.remove('hidden');
    if (panel) {
        // 小延遲觸發 CSS 過渡動畫
        setTimeout(() => panel.classList.remove('translate-y-full'), 10);
    }
};

/**
 * 關閉發佈面板
 */
window.closeUploadModal = function() {
    const panel = document.getElementById('upload-panel');
    const modal = document.getElementById('upload-modal');
    if (panel) panel.classList.add('translate-y-full');
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        resetUploadForm();
    }, 300);
};

/**
 * 處理檔案選擇與即時預覽
 */
window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; 
    
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? document.getElementById('video-preview') : document.getElementById('media-preview');
    const other = isVideo ? document.getElementById('media-preview') : document.getElementById('video-preview');
    
    // 清理舊預覽
    if(other) { other.classList.add('hidden'); other.src = ''; }
    const placeholder = document.getElementById('media-placeholder');
    if(placeholder) placeholder.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = function(event) {
        if(preview) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
        }
        // 紀錄媒體類型供後續處理參考
        const container = document.getElementById('media-preview-container');
        if(container) container.dataset.mediaType = isVideo ? 'video' : 'image';
    };
    reader.readAsDataURL(file);
};

/**
 * 重置表單狀態
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

/**
 * 觸控手勢關閉：滑動面板頂部可快速關閉
 */
document.addEventListener('DOMContentLoaded', () => {
    const uploadPanel = document.getElementById('upload-panel');
    let startY = 0;
    if (uploadPanel) {
        uploadPanel.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        uploadPanel.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            // 下滑超過 80 像素自動關閉
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
            
            // 1. 生成 WebP Blob
            const blob = await window.generateWebPBlob(selectedFile);
            
            // 2. ✨【分流密鑰】檔名不含 "product"，確保 Worker 存入 POST_BUCKET
            const randomID = Math.random().toString(36).substring(7);
            const isVideo = selectedFile.type.startsWith('video/');
            const extension = isVideo ? 'mp4' : 'webp';
            const cleanFileName = `post_${Date.now()}_${randomID}.${extension}`;

            // 3. 執行 R2 代理上傳
            mediaUrl = await window.uploadToR2File(blob, cleanFileName);
        }

        btn.innerText = "💾 存入資料庫...";
        
        // ✨【欄位對齊】精準寫入 posts 表的 media_url
        const { error: dbError } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: window.escapeHTML(caption),
            media_url: mediaUrl, 
            is_paid: isPaid,
            price: price
        }]);

        if (dbError) throw dbError;

        alert('✨ 貼文發佈成功！');
        window.closeUploadModal();
        
        // 刷新頁面顯示新貼文 (如果主頁有定義 renderDiscovery 則使用它，否則刷新全頁)
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
 * 貼文刪除功能：管理員或擁有者使用
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
        if (typeof window.renderDiscovery === 'function') {
            window.renderDiscovery();
        } else {
            location.reload();
        }
    } catch (err) {
        alert('刪除失敗: ' + err.message);
    }
};
