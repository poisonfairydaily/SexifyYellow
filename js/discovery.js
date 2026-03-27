// 評論數據
const postComments = {
    'card-xaiver': [{ user: '酷炫男孩', text: '這驚驚喜太猛了吧！🔥', time: '2小時前' }],
    'card-mina': [{ user: '小雨點', text: '下雨天要注意保暖喔 🌧️', time: '1小時前' }]
};

// 開啟帖子詳情
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
    if (sourceHeart.classList.contains('fa-solid')) {
        detailHeart.className = 'fa-solid fa-heart text-xl text-sexify animate-fade-in';
    } else {
        detailHeart.className = 'fa-regular fa-heart text-xl';
    }

    loadComments(cardId);
    detail.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 鎖定背景
    setTimeout(() => detail.classList.remove('translate-y-full'), 10);
}

// 關閉帖子詳情
function closeDetail() { 
    document.getElementById('post-detail').classList.add('translate-y-full'); 
    document.body.style.overflow = 'auto'; 
    setTimeout(() => document.getElementById('post-detail').classList.add('hidden'), 300); 
}

// 點讚邏輯
function toggleLike(el) {
    const heart = el.querySelector('i');
    const countSpan = el.querySelector('.like-count');
    let count = parseInt(countSpan.innerText);
    if (heart.classList.contains('fa-regular')) {
        heart.className = 'fa-solid fa-heart text-sexify animated heartPop';
        count++;
    } else {
        heart.className = 'fa-regular fa-heart animated heartPop';
        count--;
    }
    countSpan.innerText = count;
}

// 載入評論
function loadComments(id) {
    const list = document.getElementById('comment-list');
    const cms = postComments[id] || [];
    if(cms.length === 0) { 
        list.innerHTML = `<p class="text-center text-gray-300 text-xs py-10">尚無評論，快來搶沙發！</p>`; 
        return; 
    }
    list.innerHTML = cms.map(c => `<div class="flex gap-3 animate-fade-in"><img src="https://i.pravatar.cc/100?u=${c.user}" class="w-8 h-8 rounded-full shadow-sm"><div class="flex-1 bg-gray-50 p-3 rounded-2xl rounded-tl-none"><p class="text-[11px] font-bold text-gray-400">${c.user}</p><p class="text-sm mt-1 text-gray-700 leading-relaxed">${c.text}</p><p class="text-[10px] text-gray-300 mt-2 font-medium">${c.time}</p></div></div>`).join('');
}

// 開啟評論面板
function openComments() { 
    document.getElementById('comment-sheet').classList.remove('hidden'); 
    setTimeout(() => document.getElementById('comment-panel').classList.remove('translate-y-full'), 10); 
}

// 關閉評論面板
function closeComments() { 
    document.getElementById('comment-panel').classList.add('translate-y-full'); 
    setTimeout(() => document.getElementById('comment-sheet').classList.add('hidden'), 300); 
}

// 發送評論
function sendComment() {
    const input = document.getElementById('comment-input');
    const sid = document.getElementById('post-detail').dataset.sourceId;
    if(!input.value.trim() || !sid) return;
    if(!postComments[sid]) postComments[sid] = [];
    postComments[sid].unshift({ user: '我', text: input.value, time: '剛剛' });
    loadComments(sid);
    input.value = '';
}
