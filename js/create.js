// ==========================================
// js/create.js - 真實資料庫版 (加強防呆)
// ==========================================

function openUploadModal() {
    document.getElementById('upload-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('upload-panel').classList.remove('translate-y-full'), 10);
}

function closeUploadModal() {
    document.getElementById('upload-panel').classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('upload-modal').classList.add('hidden');
        resetUploadForm();
    }, 300);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
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
}

function resetUploadForm() {
    const priceEl = document.getElementById('post-price');
    if (priceEl) priceEl.value = '';
    
    const captionEl = document.getElementById('post-caption');
    if (captionEl) captionEl.value = '';
    
    const viewFreeEl = document.getElementById('view-free');
    if (viewFreeEl) viewFreeEl.checked = true;

    if(typeof setPrice === 'function') setPrice(0);
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.remove('hidden');
    document.getElementById('media-preview-container').dataset.mediaType = ''; 
    document.getElementById('media-preview').src = '';
}

// 🔥 真正推送到 Supabase 的發佈邏輯 (已修復缺少 UI 節點報錯的問題)
window.publishPost = async function() {
    const captionEl = document.getElementById('post-caption');
    const caption = captionEl ? captionEl.value.trim() : '';
    
    // 安全抓取價格，若沒這個輸入框預設為 0
    const priceEl = document.getElementById('post-price');
    const price = priceEl ? parseInt(priceEl.value) || 0 : 0;
    
    // 安全抓取付費開關，若沒這個開關預設為免費 (false)
    const viewPaidEl = document.getElementById('view-paid');
    const isPaid = viewPaidEl ? viewPaidEl.checked : false;

    const userId = localStorage.getItem('userId');
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');

    if (!userId) return alert('請先登入後再發佈！');

    let mediaType = document.getElementById('media-preview-container').dataset.mediaType || 'text';
    if (mediaType === 'text' && !caption) return alert('請輸入文字內容或上傳相片/影片！');

    // 取得預覽圖片的 base64 碼 (正式產品建議串接 Storage，目前我們存進 DB)
    let mediaUrl = '';
    if (mediaType === 'image') mediaUrl = document.getElementById('media-preview').src;
    if (mediaType === 'video') mediaUrl = document.getElementById('video-preview').src;

    publishBtn.innerText = "發佈中...";
    publishBtn.disabled = true;

    try {
        const { error } = await window.supabaseClient.from('posts').insert([{
            user_id: userId,
            caption: caption,
            media_url: mediaUrl,
            is_paid: isPaid,
            price: price
        }]);

        if (error) throw error;

        alert('✨ 發佈成功！');
        closeUploadModal();
        
        // 自動刷新目前所在的頁面
        if (document.getElementById('profile-tab').classList.contains('active') && typeof renderProfile === 'function') {
            renderProfile();
        } else if (document.getElementById('home-tab').classList.contains('active') && typeof renderDiscovery === 'function') {
            renderDiscovery();
        }

    } catch (err) {
        console.error("發佈失敗:", err);
        alert('發佈失敗：' + err.message);
    } finally {
        publishBtn.innerText = "發佈";
        publishBtn.disabled = false;
    }
}
