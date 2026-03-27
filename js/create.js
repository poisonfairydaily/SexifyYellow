// ==========================================
// 創作者發布引擎 (處理上傳預覽與發布動態)
// ==========================================

// 1. 初始化：在個人主頁自動插入「發布按鈕」
document.addEventListener('DOMContentLoaded', () => {
    const entryPoint = document.getElementById('creator-entry-point');
    if (entryPoint) {
        entryPoint.innerHTML = `
            <div class="px-6">
                <button onclick="openUploadModal()" class="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-700 py-3.5 rounded-2xl border border-gray-200 active:scale-95 transition">
                    <i class="fa-solid fa-cloud-arrow-up text-sexify"></i>
                    <span class="text-sm font-bold">發布專屬作品</span>
                </button>
            </div>
        `;
    }
});

// 2. 打開與關閉上傳彈窗
function openUploadModal() {
    if(document.getElementById('age-gate').style.display !== 'none') return; // 年齡驗證防護
    document.body.style.overflow = 'hidden'; 
    document.getElementById('upload-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('upload-panel').classList.remove('translate-y-full'), 10);
}

function closeUploadModal() {
    document.body.style.overflow = ''; 
    document.getElementById('upload-panel').classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('upload-modal').classList.add('hidden');
        resetUploadForm();
    }, 300);
}

// 3. 處理手機/電腦選取照片影片的預覽
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const imgPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.getElementById('media-placeholder');
    const container = document.getElementById('media-preview-container');

    imgPreview.classList.add('hidden');
    videoPreview.classList.add('hidden');
    placeholder.classList.add('hidden');

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imgPreview.src = e.target.result;
            imgPreview.classList.remove('hidden');
            container.dataset.mediaType = 'image';
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
        videoPreview.src = URL.createObjectURL(file);
        videoPreview.classList.remove('hidden');
        container.dataset.mediaType = 'video';
    } else {
        alert('格式不支援，請上傳照片或影片。');
        resetUploadForm();
    }
}

// 4. 切換免費/付費 UI
function setPrice(price) {
    const priceInput = document.getElementById('price-input-container');
    const priceField = document.getElementById('post-price');
    if (price > 0) {
        priceInput.classList.remove('hidden');
        priceField.value = price;
    } else {
        priceInput.classList.add('hidden');
        priceField.value = 0;
    }
}

function resetUploadForm() {
    document.getElementById('file-input').value = '';
    document.getElementById('post-caption').value = '';
    document.getElementById('view-free').checked = true;
    setPrice(0);
    document.getElementById('media-preview').classList.add('hidden');
    document.getElementById('video-preview').classList.add('hidden');
    document.getElementById('media-placeholder').classList.remove('hidden');
    delete document.getElementById('media-preview-container').dataset.mediaType;
}

// 5. 核心：將作品發布到首頁瀑布流
function simulatedPublish() {
    const caption = document.getElementById('post-caption').value || '最新發布的專屬內容 ✨';
    const price = parseInt(document.getElementById('post-price').value) || 0;
    const mediaContainer = document.getElementById('media-preview-container');
    const mediaType = mediaContainer.dataset.mediaType;

    if (!mediaType) return alert('請先上傳一張相片或影片！');

    // 取得檔案預覽源
    const mediaSrc = mediaType === 'image' ? document.getElementById('media-preview').src : document.getElementById('video-preview').src;
    
    // 生成動態首頁卡片 HTML
    const cardId = `post-${Date.now()}`;
    const masonryGrid = document.querySelector('#discovery-grid');
    
    let mediaHtml = mediaType === 'image' 
        ? `<img src="${mediaSrc}" class="w-full h-full object-cover">`
        : `<video src="${mediaSrc}" class="w-full h-full object-cover" muted autoplay loop></video><div class="video-mark"><i class="fa-solid fa-play"></i> VIDEO</div>`;
    
    let lockHtml = price > 0 ? `<div class="paid-lock"><i class="fa-solid fa-lock text-3xl mb-2 drop-shadow-md"></i><span class="font-black text-sm">${price} 金幣</span></div>` : '';

    const newCard = `
        <div id="${cardId}" class="masonry-item cursor-pointer animate-fade-in" onclick="openDetail('${mediaSrc}', 'Me (作者)', 'https://i.pravatar.cc/150?u=me', '${caption}', '0', '${cardId}', ${price > 0}, ${price})">
            <div class="relative overflow-hidden aspect-[4/5] bg-gray-100">
                ${mediaHtml}
                ${lockHtml}
            </div>
            <div class="p-3 bg-white">
                <h4 class="text-[13px] font-bold mb-2 text-gray-800 line-clamp-2 leading-snug">${caption}</h4>
                <div class="flex justify-between items-center text-[10px] text-gray-500">
                    <div class="flex items-center gap-1.5"><img src="https://i.pravatar.cc/150?u=me" class="w-4 h-4 rounded-full border border-gray-100 object-cover"><span>Me (作者)</span></div>
                    <div class="flex items-center gap-1" onclick="event.stopPropagation(); toggleLike(this)"><i class="fa-regular fa-heart text-xs"></i><span class="like-count">0</span></div>
                </div>
            </div>
        </div>
    `;

    // 插入瀑布流最上方
    if(masonryGrid) masonryGrid.insertAdjacentHTML('afterbegin', newCard);

    // 切換回首頁並關閉彈窗
    switchTab('home-tab', document.querySelector('.nav-btn'));
    closeUploadModal();
}
