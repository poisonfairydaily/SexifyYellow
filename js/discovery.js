// 1. 模擬評論數據庫
const postComments = {
    'card-xaiver': [{ user: '酷炫男孩', text: '這驚喜太猛了吧！🔥', time: '2小時前' }],
    'card-mina': [{ user: '小雨點', text: '下雨天要注意保暖喔 🌧️', time: '1小時前' }]
};

// 2. 開啟貼文詳情 (包含付費攔截邏輯)
function openDetail(imgSrc, username, avatar, title, likeCount, cardId, isPaid = false, price = 0) {
    // 【新增】如果這是一張付費圖片，先跳出模擬付費確認
    if (isPaid && price > 0) {
        const confirmUnlock = confirm(`【解鎖提示】\n這是一個專屬付費作品，需要 ${price} 金幣解鎖。\n\n你要模擬支付解鎖觀看嗎？`);
        if (!confirmUnlock) return; // 點取消就不打開
    }

    const detail = document.getElementById('post-detail');
    document.getElementById('detail-image').src = imgSrc;
    document.getElementById('detail-avatar').src = avatar;
    document.getElementById('detail-username').innerText = username;
    document.getElementById('detail-title').innerText = title;
    detail.dataset.sourceId = cardId;
    detail.querySelector('.like-count').innerText = likeCount;
    
    // 同步愛心狀態
    const sourceCard = document.getElementById(cardId);
    if(sourceCard) {
        const sourceHeart = sourceCard.querySelector('i');
        const detailHeart = detail.querySelector('.fa-heart');
        if (sourceHeart && sourceHeart.classList.contains('fa-solid')) {
            detailHeart.className = 'fa-solid fa-heart text-xl text-sexify animate-fade-in';
        } else {
            detailHeart.className = 'fa-regular fa-heart text-xl';
        }
    }

    loadComments(cardId);
    detail.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 鎖定背景滾動
    setTimeout(() => detail.classList.remove('translate-y-full'), 10);
}

// 關閉貼文詳情
function closeDetail() {
    document.getElementById('post-detail').classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('post-detail').classList.add('hidden');
        document.body.style.overflow = ''; 
    }, 300);
}

// 3. 點讚邏輯
function toggleLike(el) {
    const heart = el.querySelector('i');
    const countSpan = el.querySelector('.like-count');
    let count = parseInt(countSpan.innerText) || 0;
    
    if (heart.classList.contains('fa-regular')) {
        heart.className = 'fa-solid fa-heart text-xl text-sexify heartPop';
        count++;
    } else {
        heart.className = 'fa-regular fa-heart text-xl heartPop';
        count--;
    }
    countSpan.innerText = count;
}

// 4. 載入與發送留言邏輯
function loadComments(id) {
    const list = document.getElementById('comment-list');
    const cms = postComments[id] || [];
    if(cms.length === 0) { 
        list.innerHTML = `<p class="text-center text-gray-300 text-xs py-10">尚無評論，快來搶沙發！</p>`; 
        return; 
    }
    list.innerHTML = cms.map(c => `
        <div class="flex gap-3 animate-fade-in">
            <img src="https://i.pravatar.cc/100?u=${c.user}" class="w-8 h-8 rounded-full shadow-sm object-cover border border-gray-100">
            <div class="flex-1 bg-gray-50 p-3.5 rounded-2xl rounded-tl-none">
                <p class="text-[11px] font-bold text-gray-400">${c.user}</p>
                <p class="text-[13px] mt-1 text-gray-800 leading-relaxed">${c.text}</p>
                <p class="text-[10px] text-gray-300 mt-2 font-medium">${c.time}</p>
            </div>
        </div>`).join('');
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
    if(!input.value.trim() || !sid) return;
    if(!postComments[sid]) postComments[sid] = [];
    postComments[sid].unshift({ user: 'Me (作者)', text: input.value, time: '剛剛' });
    loadComments(sid);
    input.value = '';
}
