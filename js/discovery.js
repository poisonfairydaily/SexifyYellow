// 1. 帖子數據中心 (在這裡增加新照片)
const posts = [
    { 
        id: 'card-xaiver', 
        user: 'Xaiver', 
        avatar: 'https://i.pravatar.cc/100?u=a1', 
        title: '深夜驚喜！🍆', 
        img: 'image_8436aa.jpg', // 換成你的香蕉圖
        likes: '5',
        isLocked: true 
    },
    { 
        id: 'card-mina', 
        user: 'Mina_米娜', 
        avatar: 'https://i.pravatar.cc/100?u=a2', 
        title: '衣服都被雨水打濕了🌧️', 
        img: 'https://picsum.photos/400/400?random=12', 
        likes: '892',
        isLocked: false 
    }
];

// 2. 渲染首頁卡片
function renderHome() {
    const grid = document.querySelector('.masonry-grid');
    if (!grid) return;
    
    grid.innerHTML = posts.map(p => `
        <div id="${p.id}" class="masonry-item cursor-pointer group" onclick="openDetail('${p.img}', '${p.user}', '${p.avatar}', '${p.title}', '${p.likes}', '${p.id}')">
            <div class="relative overflow-hidden">
                <img src="${p.img}" class="w-full transition-transform duration-500 group-hover:scale-110">
                ${p.isLocked ? `
                <div class="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
                    <i class="fa-solid fa-lock text-white/80 text-2xl shadow-xl"></i>
                </div>` : ''}
            </div>
            <div class="p-2.5">
                <h4 class="text-xs font-bold mb-2">${p.title}</h4>
                <div class="flex justify-between items-center text-[10px] text-gray-500">
                    <div class="flex items-center gap-1.5">
                        <img src="${p.avatar}" class="w-4 h-4 rounded-full">
                        <span>${p.user}</span>
                    </div>
                    <div class="flex items-center gap-0.5" onclick="event.stopPropagation(); toggleLike(this)">
                        <i class="fa-regular fa-heart"></i>
                        <span class="like-count">${p.likes}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 3. 評論數據與詳情邏輯 (保持原本功能並優化)
const postComments = {
    'card-xaiver': [{ user: '酷炫男孩', text: '這驚喜太猛了吧！🔥', time: '2小時前' }],
    'card-mina': [{ user: '小雨點', text: '下雨天要注意保暖喔 🌧️', time: '1小時前' }]
};

function openDetail(imgSrc, username, avatar, title, likeCount, cardId) {
    const detail = document.getElementById('post-detail');
    document.getElementById('detail-image').src = imgSrc;
    document.getElementById('detail-avatar').src = avatar;
    document.getElementById('detail-username').innerText = username;
    document.getElementById('detail-title').innerText = title;
    detail.dataset.sourceId = cardId;
    detail.querySelector('.like-count').innerText = likeCount;
    
    // 同步愛心狀態
    const sourceCard = document.getElementById(cardId);
    const sourceHeart = sourceCard.querySelector('i');
    const detailHeart = detail.querySelector('.fa-heart');
    detailHeart.className = sourceHeart.classList.contains('fa-solid') ? 'fa-solid fa-heart text-xl text-sexify' : 'fa-regular fa-heart text-xl';

    loadComments(cardId);
    detail.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => detail.classList.remove('translate-y-full'), 10);
}

function loadComments(id) {
    const list = document.getElementById('comment-list');
    const cms = postComments[id] || [];
    list.innerHTML = cms.length === 0 ? `<p class="text-center text-gray-300 text-xs py-10">尚無評論，快來搶沙發！</p>` : 
        cms.map(c => `
            <div class="flex gap-3">
                <img src="https://i.pravatar.cc/100?u=${c.user}" class="w-8 h-8 rounded-full">
                <div class="flex-1 bg-gray-50 p-3 rounded-2xl">
                    <p class="text-[11px] font-bold text-gray-400">${c.user}</p>
                    <p class="text-sm mt-1 text-gray-700">${c.text}</p>
                </div>
            </div>
        `).join('');
}
