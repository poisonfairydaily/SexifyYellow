/**
 * js/create.js - 2026 終極修復版
 * 修正：解決檔名混亂、35KB 破圖、及 R2 讀取失敗問題
 */

window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * ✨ 影像處理引擎：加固版
 * 確保解碼完成後再壓縮，並提供原檔回退機制
 */
async function generateWebPBlob(file) {
    if (file.type.startsWith('video/')) return file;

    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
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
            
            ctx.fillStyle = "white"; // 防止透明底變黑
            ctx.fillRect(0, 0, width, height);
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                // 如果壓縮失敗或檔案太小，回退使用原檔
                if (!blob || blob.size < 2000) {
                    resolve(file);
                } else {
                    resolve(blob);
                }
                URL.revokeObjectURL(img.src);
            }, 'image/webp', 0.85);
        }).catch(err => {
            console.error("Canvas 處理失敗，改用原檔:", err);
            resolve(file); 
        });
    });
}

/**
 * ✨ R2 上傳引擎
 * 完全對接 creator.js 的三參數傳輸模式
 */
async function uploadToR2(blob, fileName) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    const formData = new FormData();
    // 關鍵：(鍵名, 數據流, 乾淨的檔名)
    formData.append('file', blob, fileName);

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`R2 上傳失敗: ${response.status}`);
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Worker 回傳異常');
    
    return result.url;
}

// --- UI 控制邏輯 ---

let selectedFile = null;

window.openUploadModal = function() {
    document.getElementById('upload-modal').classList.remove('hidden');
    setTimeout(() => {
        const panel = document.getElementById('upload-panel');
        if(panel) panel.classList.remove('translate-y-full');
    }, 10);
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
    const placeholder = document.getElementById('media-placeholder');
    
    if(other) other.classList.add('hidden');
    if(placeholder) placeholder.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = function(event) {
        if(preview) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
        }
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
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
}

// --- 🚀 發佈主邏輯 (修正檔名生成) ---

window.publishPost = async function() {
    const btn = document.querySelector('#upload-panel button.bg-sexify');
    if(!btn) return;
    const originalText = btn.innerText;
    
    btn.innerText = "驗證中...";
    btn.disabled = true;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error('請先登入');

        const caption = document.getElementById('post-caption').value.trim();
        const price = parseInt(document.getElementById('post-price').value) || 0;
        const isPaid = document.getElementById('view-paid').checked;

        let mediaUrl = '';

        if (selectedFile) {
            btn.innerText = "🚀 上傳中...";
            const blob = await generateWebPBlob(selectedFile);
            
            // ✨ 核心修復：極簡命名法，杜絕 .webp.webp 的發生
            // 隨機字串 + 時間戳，確保檔名唯一且乾淨
            const randomString = Math.random().toString(36).substring(2, 8);
            const extension = selectedFile.type.startsWith('video/') ? 'mp4' : 'webp';
            const fileName = `${Date.now()}_${randomString}.${extension}`;

            mediaUrl = await uploadToR2(blob, fileName);
            console.log("R2 上傳成功，網址：", mediaUrl);
        }

        btn.innerText = "💾 存入資料庫...";
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
        
        // 刷新頁面確保看到新貼文
        location.reload(); 

    } catch (err) {
        console.error("發佈失敗詳情:", err);
        alert('發佈失敗: ' + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};
