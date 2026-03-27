// 創作者發布引擎
document.addEventListener('DOMContentLoaded', () => {
    const entry = document.getElementById('creator-entry-point');
    if (entry) {
        entry.innerHTML = `
            <div class="px-6">
                <button onclick="openUploadModal()" class="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-700 py-3.5 rounded-2xl border border-gray-200 active:scale-95 transition">
                    <i class="fa-solid fa-cloud-arrow-up text-sexify"></i>
                    <span class="text-sm font-bold">發布專屬作品</span>
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
}

function simulatedPublish() {
    const caption = document.getElementById('post-caption').value || '新發布的作品 ✨';
    const price = parseInt(document.getElementById('post-price').value) || 0;
    const mediaType = document.getElementById('media-preview-container').dataset.mediaType;
    if (!mediaType) return alert('請先選取檔案');

    const src = mediaType === 'image' ? document.getElementById('media-preview').src : document.getElementById('video-preview').src;
    
    const newPost = {
        id: 'user-post-' + Date.now(),
        user: 'Me (作者)',
        avatar: 'https://i.pravatar.cc/150?u=me',
        type: mediaType,
        src: src,
        title: caption,
        likes: 0,
        isPaid: price > 0,
        price: price
    };

    const grid = document.getElementById('discovery-grid');
    grid.insertAdjacentHTML('afterbegin', generateCardHtml(newPost));

    switchTab('home-tab', document.querySelector('.nav-btn'));
    closeUploadModal();
}
