// ==========================================
// js/create.js - 解決卡頓壓縮版
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
        };
        reader.readAsDataURL(file);
    } else {
        // 核心修復：相片 Canvas 壓縮，防止 Base64 過大導致 Supabase 拒絕並卡死
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1000; // 限制最大寬高

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
                
                // 壓縮品質為 70%
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                preview.src = compressedBase64;
                preview.classList.remove('hidden');
                document.getElementById('media-preview-container').dataset.mediaType = 'image';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function resetUploadForm() {
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
}

window.publishPost = async function() {
    const captionEl = document.getElementById('post-caption');
    const caption = captionEl ? captionEl.value.trim() : '';
    
    const priceEl = document.getElementById('post-price');
    const price = priceEl ? parseInt(priceEl.value) || 0 : 0;
    
    const viewPaidEl = document.getElementById('view-paid');
    const isPaid = viewPaidEl ? viewPaidEl.checked : false;

    const userId = localStorage.getItem('userId');
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');

    if (!userId) return alert('請先登入後再發佈！');

    let mediaType = document.getElementById('media-preview-container').dataset.mediaType || 'text';
    if (mediaType === 'text' && !caption) return alert('請輸入文字內容或上傳相片/影片！');

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
        
        if (document.getElementById('profile-tab').classList.contains('active') && typeof renderProfile === 'function') {
            renderProfile();
        } else if (document.getElementById('home-tab').classList.contains('active') && typeof renderDiscovery === 'function') {
            renderDiscovery();
        }

    } catch (err) {
        console.error("發佈失敗:", err);
        alert('發佈失敗，請檢查網路連線或檔案大小。');
    } finally {
        publishBtn.innerText = "發佈";
        publishBtn.disabled = false;
    }
}
