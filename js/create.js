document.addEventListener('DOMContentLoaded', () => {
    const entry = document.getElementById('creator-entry-point');
    if (entry) {
        entry.innerHTML = `
            <div class="px-6">
                <button onclick="openUploadModal()" class="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-700 py-3.5 rounded-2xl border border-gray-200 active:scale-95 transition">
                    <i class="fa-solid fa-cloud-arrow-up text-sexify"></i>
                    <span class="text-sm font-bold">發佈動態或作品</span>
                </button>
            </div>`;
    }
});

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
    preview.classList.remove('hidden');
    document.getElementById('media-placeholder').classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = (event) => {
        preview.src = event.target.result;
        document.getElementById('media-preview-container').dataset.mediaType = isVideo ? 'video' : 'image';
    };
    if(!isVideo) reader.readAsDataURL(file);
    else preview.src = URL.createObjectURL(file);
}

function setPrice(p) {
    const container = document.getElementById('price-input-container');
    p > 0 ? container.classList.remove('hidden') : container.classList.add('hidden');
}

function resetUploadForm() {
    document.getElementById('file-input').value = '';
    document.getElementById('post-caption').value = '';
    document.getElementById('view-free').checked = true;
    setPrice(0);
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.remove('hidden');
    document.getElementById('media-preview-container').dataset.mediaType = ''; // 清除類型
}

function simulatedPublish() {
    const caption = document.getElementById('post-caption').value.trim();
    const price = parseInt(document.getElementById('post-price').value) || 0;
    
    // 判斷是否有上傳媒體，如果沒有就預設為 text (純文字)
    let mediaType = document.getElementById('media-preview-container').dataset.mediaType || 'text';
    
    // 阻擋空白發佈：如果沒圖也沒文字，拒絕發佈
    if (mediaType === 'text' && !caption) {
        return alert('請輸入文字內容或上傳相片/影片！');
    }

    let src = '';
    if (mediaType === 'image') src = document.getElementById('media-preview').src;
    if (mediaType === 'video') src = document.getElementById('video-preview').src;
    
    const newPost = {
        id: 'user-post-' + Date.now(),
        user: currentUser.name, // 使用 profile.js 中設定的名稱
        avatar: currentUser.avatar,
        type: mediaType,
        src: src,
        title: caption || '分享了新內容 ✨',
        likes: 0,
        isPaid: price > 0,
        price: price
    };

    // 將新貼文加到全局陣列的最前面
    if(typeof allPosts !== 'undefined') {
        allPosts.unshift(newPost);
        renderDiscovery(); // 重新渲染首頁
    }

    switchTab('home-tab', document.querySelector('.nav-btn')); // 切換回首頁
    closeUploadModal();
}
