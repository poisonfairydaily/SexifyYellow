// ==========================================
// js/create.js - Cloudflare R2 上傳版
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

// 建立一個變數來儲存原始檔案，不要只存 Base64
let selectedFile = null;

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; // 儲存原始檔案供上傳 Worker 使用
    
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
    selectedFile = null;
    const priceEl = document.getElementById('post-price');
    if (priceEl) priceEl.value = '';
    const captionEl = document.getElementById('post-caption');
    if (captionEl) captionEl.value = '';
    const viewFreeEl = document.getElementById('view-free');
    if (viewFreeEl) viewFreeEl.checked = true;

    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.remove('hidden');
    document.getElementById('media-preview-container').dataset.mediaType = ''; 
    document.getElementById('media-preview').src = '';
    document.getElementById('video-preview').src = '';
}

// ✨ 核心功能：上傳檔案到 Cloudflare R2
async function uploadToR2(file) {
    const formData = new FormData();
    formData.append('file', file);

    // 請換成你剛才部署成功的 Worker 網址
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('上傳到 R2 失敗');
    
    const result = await response.json();
    return result.url; // 這裡回傳的是 https://pub-xxx.r2.dev/檔名.jpg
}

window.publishPost = async function() {
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');
    const originalBtnText = publishBtn.innerText;
    
    publishBtn.innerText = "驗證身分中...";
    publishBtn.disabled = true;

    // 1. 安全檢查
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
        // 2. 如果有選擇檔案，先執行 R2 上傳
        if (selectedFile) {
            publishBtn.innerText = "上傳媒體中...";
            finalMediaUrl = await uploadToR2(selectedFile);
            console.log("R2 上傳成功:", finalMediaUrl);
        }

        // 3. 寫入 Supabase 資料庫
        publishBtn.innerText = "發佈中...";
        const { error } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: window.escapeHTML(caption),
            media_url: finalMediaUrl, // 存入 R2 的公開網址
            is_paid: isPaid,
            price: price
        }]);

        if (error) throw error;

        alert('✨ 發佈成功！');
        closeUploadModal();
        if (typeof renderDiscovery === 'function') renderDiscovery();

    } catch (err) {
        console.error("發佈流程失敗:", err);
        alert('發佈失敗: ' + err.message);
    } finally {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
    }
}
