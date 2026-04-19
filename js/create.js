/**
 * js/create.js - 2026 最終修復版
 * 針對 35KB 破圖問題進行 Canvas 繪製加固
 */

window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * ✨ 影像處理引擎：加固版
 * 解決 35KB 破圖問題，確保 Canvas 真正抓到數據
 */
async function generateWebPBlob(file) {
    if (file.type.startsWith('video/')) return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        // 使用 decode 確保瀏覽器已解析影像數據
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
            
            // 填滿白色背景防止透明區塊變黑
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, width, height);
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob || blob.size < 1000) {
                    reject(new Error("影像轉換失敗，產生的檔案過小"));
                } else {
                    resolve(blob);
                }
                URL.revokeObjectURL(img.src);
            }, 'image/webp', 0.85);
        }).catch(err => {
            console.error("圖片解碼失敗:", err);
            // 如果 Canvas 失敗，就直接傳原檔 (最後的保險)
            resolve(file); 
        });
    });
}

/**
 * ✨ R2 上傳引擎：同步 creator.js 成功模式
 */
async function uploadToR2(blob, fileName) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    const formData = new FormData();
    // 確保這裡帶入 Blob 與 檔名
    formData.append('file', blob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Worker 回傳失敗');
    
    return result.url;
}

// --- UI 控制 (保持原樣) ---

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
    const placeholder = document.getElementById('media-placeholder');
    
    // 清除舊預覽
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    if(placeholder) placeholder.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = function(event) {
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
    
    btn.innerText = "驗證身分...";
    btn.disabled = true;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error('請先登入');

        const caption = document.getElementById('post-caption').value.trim();
        const price = parseInt(document.getElementById('post-price').value) || 0;
        const isPaid = document.getElementById('view-paid').checked;

        let mediaUrl = '';

        if (selectedFile) {
            btn.innerText = "🚀 優化影像並上傳...";
            const webpBlob = await generateWebPBlob(selectedFile);
            
            // 檔名清洗
            const safeName = selectedFile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = selectedFile.type.startsWith('video/') ? `${Date.now()}_${safeName}` : `${Date.now()}_${safeName}.webp`;

            mediaUrl = await uploadToR2(webpBlob, fileName);
        }

        btn.innerText = "💾 存入資料庫...";
        const { error } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: window.escapeHTML(caption),
            media_url: mediaUrl,
            is_paid: isPaid,
            price: price
        }]);

        if (error) throw error;

        alert('✨ 發佈成功！');
        window.closeUploadModal();
        location.reload(); 

    } catch (err) {
        console.error("發佈失敗:", err);
        alert('發佈失敗: ' + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};
