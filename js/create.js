// ==========================================
// js/create.js - 效能優化版 (Storage 上傳)
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
    
    if (isVideo) {
        reader.onload = function(event) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
            document.getElementById('media-preview-container').dataset.mediaType = 'video';
            // 存儲原始 File 物件供上傳使用
            window.pendingUploadFile = file;
        };
        reader.readAsDataURL(file);
    } else {
        // 相片 Canvas 壓縮處理
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1200; 

                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                preview.src = compressedBase64;
                preview.classList.remove('hidden');
                document.getElementById('media-preview-container').dataset.mediaType = 'image';
                
                // 將 Base64 轉換為 Blob 以便 Storage 上傳
                fetch(compressedBase64).then(res => res.blob()).then(blob => {
                    window.pendingUploadFile = blob;
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function resetUploadForm() {
    document.getElementById('post-caption').value = '';
    document.getElementById('media-preview').src = '';
    document.getElementById('video-preview').src = '';
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.remove('hidden');
    document.getElementById('media-preview-container').dataset.mediaType = 'text';
    document.getElementById('post-is-paid').checked = false;
    document.getElementById('post-price-input').value = '10';
    document.getElementById('post-price-container').classList.add('hidden');
    window.pendingUploadFile = null;
}

function togglePriceInput(checked) {
    const container = document.getElementById('post-price-container');
    if (checked) container.classList.remove('hidden');
    else container.classList.add('hidden');
}

async function handlePublish() {
    const caption = document.getElementById('post-caption').value.trim();
    const isPaid = document.getElementById('post-is-paid').checked;
    const price = isPaid ? parseFloat(document.getElementById('post-price-input').value) || 0 : 0;
    const userId = localStorage.getItem('userId');
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');

    if (!userId) return alert('請先登入後再發佈！');

    let mediaType = document.getElementById('media-preview-container').dataset.mediaType || 'text';
    if (mediaType === 'text' && !caption) return alert('請輸入文字內容或上傳相片/影片！');

    publishBtn.innerText = "上傳媒體中...";
    publishBtn.disabled = true;

    try {
        let finalMediaUrl = '';

        // 如果有媒體檔案，先上傳到 Supabase Storage
        if (window.pendingUploadFile) {
            const fileName = `${userId}_${Date.now()}`;
            const fileExt = mediaType === 'video' ? 'mp4' : 'jpg';
            const filePath = `${fileName}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                .from('posts')
                .upload(filePath, window.pendingUploadFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = window.supabaseClient.storage
                .from('posts')
                .getPublicUrl(filePath);
            
            finalMediaUrl = publicUrl;
        }

        publishBtn.innerText = "發佈貼文中...";
        const { error } = await window.supabaseClient.from('posts').insert([{
            user_id: userId,
            caption: caption,
            media_url: finalMediaUrl,
            is_paid: isPaid,
            price: price
        }]);

        if (error) throw error;

        alert('✨ 發佈成功！');
        closeUploadModal();
        
        if (typeof renderDiscovery === 'function') renderDiscovery();
        if (typeof renderProfile === 'function') renderProfile();

    } catch (err) {
        console.error("發佈失敗:", err);
        alert('發佈失敗，請檢查網路連線或儲存桶權限。');
    } finally {
        publishBtn.innerText = "立即發佈";
        publishBtn.disabled = false;
    }
}
