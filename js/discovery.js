// 1. 範例數據庫 (模擬後端回傳)
const initialPosts = [
    {
        id: 'ex-1',
        user: 'Mina_米娜',
        avatar: 'https://i.pravatar.cc/150?u=mina',
        type: 'image',
        src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80',
        title: '今天的天氣很好，適合出門走走 ☀️',
        likes: 1205,
        isPaid: false,
        price: 0
    },
    {
        id: 'ex-2',
        user: 'Xaiver',
        avatar: 'https://i.pravatar.cc/150?u=xaiver',
        type: 'image',
        src: 'https://images.unsplash.com/photo-1529139513065-07b2ee722f5a?w=500&q=80',
        title: '【VIP限定】深夜的私人空間...這是我沒公開過的樣子。',
        likes: 892,
        isPaid: true,
        price: 99
    },
    {
        id: 'ex-3',
        user: 'Sweetie_糖糖',
        avatar: 'https://i.pravatar.cc/150?u=sweet',
        type: 'video',
        src: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-1282-large.mp4',
        title: '跟著音樂動起來 🎵 快來訂閱看更多福利影片！',
        likes: 3421,
        isPaid: false,
        price: 0
    },
    {
        id: 'ex-4',
        user: 'Queen_K',
        avatar: 'https://i.pravatar.cc/150?u=queen',
        type: 'image',
        src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80',
        title: '解鎖這張照片，看看我為你準備的驚喜 🎁',
        likes: 567,
        isPaid: true,
        price: 199
    }
];

const postComments = {
    'ex-1': [{ user: '酷炫男孩', text: '照片拍得好美！', time: '2小時前' }],
    'ex-2': [{ user: '神祕客', text: '已經付費支持了，真的很值得！🔥', time: '1小時前' }]
};

// 2. 渲染發現頁貼文
function renderDiscovery() {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;
    
    // 將預設範例轉為 HTML
    const html = initialPosts.map(post => generateCardHtml(post)).join('');
    grid.innerHTML = html;
}

// 產生卡片 HTML 的共用函數 (發布新貼文也會用到)
function generateCardHtml(post) {
    let mediaHtml = post.type === 'image' 
        ? `<img src="${post.src}" class="w-full h-full object-cover">`
        : `<video src="${post.src}" class="w-full h-full object-cover" muted autoplay loop></video><div class="video-mark"><i class="fa-solid fa-play"></i> VIDEO</div>`;
    
    let lockHtml = post.isPaid ? `<div class="paid-lock"><i class="fa-solid fa-lock text-3xl mb-2 drop-shadow-md"></i><span class="font-black text-sm">${post.price} 金幣</span></div>` : '';

    return `
        <div id="${post.id}" class="masonry-item cursor-pointer animate-fade-in" onclick="openDetail('${post.src}', '${post.user}', '${post.avatar}', '${post.title}', '${post.likes}', '${post.id}', ${post.isPaid}, ${post.price}, '${post.type}')">
            <div class="relative overflow-hidden aspect-[4/5] bg-gray-100">
                ${mediaHtml}
                ${lockHtml}
            </div>
            <div class="p-3 bg-white">
                <h4 class="text-[13px] font-bold mb-2 text-gray-800 line-clamp-2 leading-snug">${post.title}</h4>
                <div class="flex justify-between items-center text-[10px] text-gray-500">
                    <div class="flex items-center gap-1.5"><img src="${post.avatar}" class="w-4 h-4 rounded-full object-cover"><span>${post.user}</span></div>
                    <div class="flex items-center gap-1" onclick="event.stopPropagation(); toggleLike(this)"><i class="fa-regular fa-heart text-xs"></i><span class="like-count">${post.likes}</span></div>
                </div>
            </div>
        </div>
    `;
}

// 3. 詳情頁邏輯 (含付費攔截)
function openDetail(src, user, avatar, title, likes, id, isPaid, price, type) {
    if (isPaid && price > 0) {
        if (!confirm(`【解鎖提示】\n這是一個專屬付費作品，需要 ${price} 金幣解鎖。\n\n確認解鎖觀看嗎？`)) return;
    }

    const detail = document.getElementById('post-detail');
    const container = document.getElementById('detail-media-container');
    
    // 根據類型插入圖片或影片
    if (type === 'video') {
        container.innerHTML = `<video src="${src}" class="w-full max-h-[65vh] object-contain" controls autoplay></video>`;
    } else {
        container.innerHTML = `<img src="${src}" class="w-full object-contain max-h-[65vh]">`;
    }

    document.getElementById('detail-avatar').src = avatar;
    document.getElementById('detail-username').innerText = user;
    document.getElementById('detail-title').innerText = title;
    detail.dataset.sourceId = id;
    detail.querySelector('.like-count').innerText = likes;

    loadComments(id);
    detail.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => detail.classList.remove('translate-y-full'), 10);
}

function closeDetail() {
    document.getElementById('post-detail').classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('post-detail').classList.add('hidden');
        document.getElementById('detail-media-container').innerHTML = ''; // 清空影片防聲音殘留
        document.body.style.overflow = ''; 
    }, 300);
}

// 其他點讚留言邏輯 (同前)
function toggleLike(el) {
    const heart = el.querySelector('i');
    const countSpan = el.querySelector('.like-count');
    let count = parseInt(countSpan.innerText) || 0;
    heart.classList.toggle('fa-regular');
    heart.classList.toggle('fa-solid');
    heart.classList.toggle('text-sexify');
    heart.classList.contains('fa-solid') ? count++ : count--;
    countSpan.innerText = count;
}

function loadComments(id) {
    const list = document.getElementById('comment-list');
    const cms = postComments[id] || [];
    list.innerHTML = cms.length ? cms.map(c => `
        <div class="flex gap-3">
            <img src="https://i.pravatar.cc/100?u=${c.user}" class="w-8 h-8 rounded-full">
            <div class="flex-1 bg-gray-50 p-3 rounded-2xl">
                <p class="text-[11px] font-bold text-gray-400">${c.user}</p>
                <p class="text-sm mt-1 text-gray-800">${c.text}</p>
            </div>
        </div>`).join('') : '<p class="text-center text-gray-300 py-10">尚無留言</p>';
}

function openComments() { 
    document.getElementById('comment-sheet').classList.remove('hidden'); 
    setTimeout(() => document.getElementById('comment-panel').classList.remove('translate-y-full'), 10); 
}

function closeComments() { 
    document.getElementById('comment-panel').classList.add('translate-y-full'); 
    setTimeout(() => document.getElementById('comment-sheet').classList.add('hidden'), 300); 
}

function sendComment() {
    const input = document.getElementById('comment-input');
    const sid = document.getElementById('post-detail').dataset.sourceId;
    if(!input.value.trim()) return;
    if(!postComments[sid]) postComments[sid] = [];
    postComments[sid].unshift({ user: 'Me', text: input.value, time: '剛剛' });
    loadComments(sid);
    input.value = '';
}

// 初始化渲染
document.addEventListener('DOMContentLoaded', renderDiscovery);
