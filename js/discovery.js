// js/discovery.js
let allPosts = [
    { id: 'ex-1', user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/150?u=mina', type: 'image', src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80', title: '今天天氣很好', likes: 1205, isPaid: false, price: 0 },
    { id: 'ex-2', user: 'Xaiver_Fitness', avatar: 'https://i.pravatar.cc/150?u=xaiver', type: 'image', src: 'https://images.unsplash.com/photo-1529139513065-07b2ee722f5a?w=500&q=80', title: '深蹲破紀錄！', likes: 892, isPaid: true, price: 99 }
];

const postComments = {
    'ex-1': [{ user: '酷炫男孩', text: '照片拍得好美！', time: '2小時前' }]
};

function renderDiscovery(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;
    
    let displayPosts = allPosts;
    if (filterKeyword.trim() !== '') {
        const kw = filterKeyword.toLowerCase();
        displayPosts = allPosts.filter(p => p.user.toLowerCase().includes(kw) || p.title.toLowerCase().includes(kw));
    }
    
    if (displayPosts.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-sm">${typeof t === 'function' ? t('no_content') : '找不到內容'}</div>`;
        return;
    }

    grid.innerHTML = displayPosts.map(post => generateCardHtml(post)).join('');
}

function searchPosts() {
    renderDiscovery(document.getElementById('home-search').value);
}

function generateCardHtml(post) {
    let mediaHtml = '';
    if (post.type === 'image') {
        mediaHtml = `<img src="${post.src}" class="w-full h-full object-cover">`;
    } else if (post.type === 'video') {
        mediaHtml = `<video src="${post.src}" class="w-full h-full object-cover" muted autoplay loop></video><div class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md font-bold"><i class="fa-solid fa-play"></i></div>`;
    } else {
        mediaHtml = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-red-50 p-4 text-center"><p class="font-bold text-gray-800 text-sm line-clamp-4 leading-relaxed">${post.title}</p></div>`;
    }
    
    let lockHtml = post.isPaid ? `<div class="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white"><i class="fa-solid fa-lock text-3xl mb-2"></i><span class="font-black text-sm">${post.price} 金幣</span></div>` : '';

    // 注意：把單引號轉義，避免 onclick 報錯
    const safeTitle = post.title.replace(/'/g, "\\'");

    return `
        <div id="${post.id}" class="masonry-item animate-fade-in">
            <div class="relative overflow-hidden aspect-[4/5] bg-gray-100 cursor-pointer" onclick="openDetail('${post.src}', '${post.user}', '${post.avatar}', '${safeTitle}', '${post.likes}', '${post.id}', ${post.isPaid}, ${post.price}, '${post.type}')">
                ${mediaHtml}
                ${lockHtml}
            </div>
            <div class="p-3 bg-white">
                <h4 class="text-[13px] font-bold mb-2 text-gray-800 line-clamp-2 leading-snug cursor-pointer" onclick="openDetail('${post.src}', '${post.user}', '${post.avatar}', '${safeTitle}', '${post.likes}', '${post.id}', ${post.isPaid}, ${post.price}, '${post.type}')">${post.title}</h4>
                <div class="flex justify-between items-center text-[10px] text-gray-500">
                    <div class="flex items-center gap-1.5 cursor-pointer active:scale-95" onclick="openOtherProfile('${post.user}', '${post.avatar}')">
                        <img src="${post.avatar}" class="w-4 h-4 rounded-full object-cover">
                        <span class="font-bold hover:underline">${post.user}</span>
                    </div>
                    <div class="flex items-center gap-1 cursor-pointer" onclick="toggleLike(this)"><i class="fa-regular fa-heart text-xs"></i><span class="like-count">${post.likes}</span></div>
                </div>
            </div>
        </div>
    `;
}

// 完整還原：打開貼文詳情 (包含付費解鎖邏輯)
function openDetail(src, user, avatar, title, likes, id, isPaid, price, type) {
    if (isPaid && price > 0) {
        if (!confirm(`【解鎖提示】\n這是一個專屬付費作品，需要 ${price} 金幣解鎖。\n\n確認解鎖觀看嗎？`)) return;
    }

    const detail = document.getElementById('post-detail');
    const container = document.getElementById('detail-media-container');
    
    if (type === 'video') {
        container.innerHTML = `<video src="${src}" class="w-full max-h-[65vh] object-contain bg-black" controls autoplay></video>`;
    } else if (type === 'image') {
        container.innerHTML = `<img src="${src}" class="w-full object-contain max-h-[65vh]">`;
    } else {
        container.innerHTML = `<div class="w-full h-full min-h-[40vh] flex items-center justify-center bg-gradient-to-br from-pink-50 to-red-50 p-8 text-center"><p class="font-bold text-gray-800 text-lg leading-relaxed">${title}</p></div>`;
    }

    document.getElementById('detail-avatar').src = avatar;
    document.getElementById('detail-username').innerText = user;
    document.getElementById('detail-title').innerText = title;
    detail.dataset.sourceId = id;
    
    // 每次打開重新設定點讚數
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
        document.getElementById('detail-media-container').innerHTML = ''; 
        document.body.style.overflow = ''; 
    }, 300);
}

// 還原：點讚功能
function toggleLike(el) {
    const heart = el.querySelector('i.fa-heart');
    const countSpan = el.querySelector('.like-count');
    let count = parseInt(countSpan.innerText) || 0;
    heart.classList.toggle('fa-regular');
    heart.classList.toggle('fa-solid');
    heart.classList.toggle('text-sexify');
    heart.classList.contains('fa-solid') ? count++ : count--;
    countSpan.innerText = count;
}

// 新增：收藏功能 (Bookmark)
function toggleBookmark(el) {
    const bookmark = el.querySelector('i.fa-bookmark');
    bookmark.classList.toggle('fa-regular');
    bookmark.classList.toggle('fa-solid');
    bookmark.classList.toggle('text-yellow-500'); // 收藏變成黃色
    
    if(bookmark.classList.contains('fa-solid')) {
        // 這裡未來可以寫入後端 API，將 post ID 存入使用者的收藏庫
        console.log("已加入收藏");
    } else {
        console.log("已取消收藏");
    }
}

// 還原：留言系統
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

document.addEventListener('DOMContentLoaded', () => renderDiscovery());
