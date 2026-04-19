// ==========================================
// js/create.js - Cloudflare R2 上傳版 + 滑動關閉
// ==========================================

window.openUploadModal = function() {
    document.getElementById('upload-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('upload-panel').classList.remove('translate-y-full'), 10);
};

window.closeUploadModal = function() {
    document.getElementById('upload-panel').classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('upload-modal').classList.add('hidden');
        resetUploadForm();
    }, 300);
};

// ✨ 新增：觸控往下滑動關閉面板的邏輯
document.addEventListener('DOMContentLoaded', () => {
    const uploadPanel = document.getElementById('upload-panel');
    let startY = 0;

    if (uploadPanel) {
        uploadPanel.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        uploadPanel.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            // 如果手指往下滑動超過 80px，就觸發關閉
            if (currentY - startY > 80) {
                window.closeUploadModal();
            }
        }, { passive: true });
        
        // 讓白邊也能點擊關閉
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
    
    other.classList.add('hidden');
    other.src = '';
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
    if (priceEl) priceEl.value = '';
    const captionEl = document.getElementById('post-caption');
    if (captionEl) captionEl.value = '';
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

async function uploadToR2(file) {
    const formData = new FormData();
    formData.append('file', file);
    // 你的 Worker 網址
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('上傳到 R2 失敗');
    
    const result = await response.json();
    return result.url;
}

window.publishPost = async function() {
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');
    const originalBtnText = publishBtn.innerText;
    
    publishBtn.innerText = "驗證身分中...";
    publishBtn.disabled = true;

    const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
    if (authError || !user) {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
        return alert('請先登入！');
    }

    const captionEl = document.getElementById('post-caption');
    const caption = captionEl ? captionEl.value.trim() : '';
    const priceEl = document.getElementById('post-price');
    const price = priceEl ? parseInt(priceEl.value) || 0 : 0;
    const viewPaidEl = document.getElementById('view-paid');
    const isPaid = viewPaidEl ? viewPaidEl.checked : false;

    if (!selectedFile && !caption) {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
        return alert('請輸入文字內容或上傳檔案！');
    }

    let finalMediaUrl = '';

    try {
        if (selectedFile) {
            publishBtn.innerText = "上傳媒體中...";
            finalMediaUrl = await uploadToR2(selectedFile);
        }

        publishBtn.innerText = "發佈中...";
        // 加入防 XSS 的安全過濾 (如果 app.js 沒有，這裡用自定義備案)
        const safeCaption = typeof window.escapeHTML === 'function' ? window.escapeHTML(caption) : caption.replace(/[<>&"']/g, '');
        
        const { error } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: safeCaption,
            media_url: finalMediaUrl,
            is_paid: isPaid,
            price: price
        }]);

        if (error) throw error;

        alert('✨ 發佈成功！');
        window.closeUploadModal();
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();

    } catch (err) {
        console.error("發佈流程失敗:", err);
        alert('發佈失敗: ' + err.message);
    } finally {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
    }
};

window.deletePost = async function(postId) {
    if (!confirm('確定要刪除這篇貼文嗎？此動作無法復原。')) return;

    const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
    if (authError || !user) return alert('請先登入！');

    try {
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
        console.error("刪除貼文失敗:", err);
        alert('刪除失敗: ' + err.message);
    }
};
