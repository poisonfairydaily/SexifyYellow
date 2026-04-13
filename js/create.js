// ==========================================
// js/create.js - Storage 上傳版
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

// 修改點：保留檔案物件以便直接上傳影片，如果是圖片則走 Canvas 壓縮
let currentFile = null;

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    currentFile = file;
    
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
        };
        reader.readAsDataURL(file);
    } else {
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1200; // 貼文可以使用較高畫質

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
                
                preview.src = canvas.toDataURL('image/jpeg', 0.8);
                preview.classList.remove('hidden');
                document.getElementById('media-preview-container').dataset.mediaType = 'image';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function resetUploadForm() {
    document.getElementById('post-caption').value = '';
    document.getElementById('post-price').value = '';
    document.getElementById('post-is-paid').checked = false;
    document.getElementById('media-preview').src = '';
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').src = '';
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.remove('hidden');
    document.getElementById('media-preview-container').dataset.mediaType = 'text';
    currentFile = null;
}

// 核心功能：上傳檔案至 posts 桶
async function uploadPostMedia(fileOrBase64, type, userId) {
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let body, contentType;

    if (type === 'video') {
        body = currentFile; // 影片直接傳原始 File 物件
        contentType = currentFile.type;
    } else {
        const response = await fetch(fileOrBase64);
        body = await response.blob();
        contentType = 'image/jpeg';
    }

    const { data, error } = await window.supabaseClient.storage
        .from('posts')
        .upload(fileName, body, { contentType, upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = window.supabaseClient.storage
        .from('posts')
        .getPublicUrl(fileName);

    return publicUrl;
}

async function publishPost() {
    const caption = document.getElementById('post-caption').value.trim();
    const price = parseFloat(document.getElementById('post-price').value) || 0;
    const isPaid = document.getElementById('post-is-paid') ? document.getElementById('post-is-paid').checked : false;

    const userId = localStorage.getItem('userId');
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');

    if (!userId) return alert('請先登入後再發佈！');

    let mediaType = document.getElementById('media-preview-container').dataset.mediaType || 'text';
    if (mediaType === 'text' && !caption) return alert('請輸入文字內容或上傳相片/影片！');

    publishBtn.innerText = "發佈中...";
    publishBtn.disabled = true;

    try {
        let finalMediaUrl = '';
        if (mediaType === 'image') {
            const base64 = document.getElementById('media-preview').src;
            finalMediaUrl = await uploadPostMedia(base64, 'image', userId);
        } else if (mediaType === 'video') {
            finalMediaUrl = await uploadPostMedia(null, 'video', userId);
        }

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
        
        if (document.getElementById('profile-tab') && !document.getElementById('profile-tab').classList.contains('hidden')) {
            if(typeof renderProfile === 'function') renderProfile();
        } else {
            if(typeof renderDiscovery === 'function') renderDiscovery();
        }

    } catch (err) {
        console.error("發佈失敗:", err);
        alert('發佈失敗：' + err.message);
    } finally {
        publishBtn.innerText = "立即發佈";
        publishBtn.disabled = false;
    }
}
