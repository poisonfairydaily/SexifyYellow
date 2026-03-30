let allPosts = [
    { id: 'ex-1', user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/150?u=mina', type: 'image', src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80', title: '今天天氣很好，出門透透氣✨', likes: 1205, isPaid: false, price: 0 },
    { id: 'ex-2', user: 'Xaiver_Fitness', avatar: 'https://i.pravatar.cc/150?u=xaiver', type: 'image', src: 'https://images.unsplash.com/photo-1529139513065-07b2ee722f5a?w=500&q=80', title: '深蹲破紀錄！', likes: 892, isPaid: true, price: 99 }
];

const postComments = {
    'ex-1': [{ user: '酷炫男孩', text: '照片拍得好美！', time: '2小時前' }]
};

// 用來區分單擊與雙擊的計時器
let clickTimer = null;

function renderDiscovery(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;
    
    let displayPosts = allPosts;
    if (filterKeyword.trim() !== '') {
        const kw = filterKeyword.toLowerCase();
        displayPosts = allPosts.filter(p => p.user.toLowerCase().includes(kw) || p.title.toLowerCase().includes(kw));
    }
    
    // 【升級】精美的空白狀態插畫與按鈕
    if (displayPosts.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 flex flex-col items-center justify-center py-20 animate-fade-in">
                <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Magnifying%20Glass%20Tilted%20Left.png" class="w-24 h-24 mb-4 drop-shadow-md hover:scale-110 transition">
                <h3 class="text-gray-800 font-bold text-lg mb-2">找不到相關內容</h3>
                <p class="text-gray-400 text-xs mb-8 text-center px-4 leading-relaxed">試試看其他關鍵字，<br>或者回首頁看看大家都在討論什麼吧！</p>
                <button onclick="clearSearch()" class="bg-sexify text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-sexify/30 active:scale-95 transition flex items-center gap-2 text-sm">
                    <i class="fa-solid fa-fire"></i> 看看其他熱門內容
                </button>
            </div>`;
        return;
    }

    grid.innerHTML = displayPosts.map(post => generateCardHtml(post)).join('');
}

function searchPosts() {
    renderDiscovery(document.getElementById('home-search').value);
}

function generateCardHtml(post) {
    let mediaHtml = '';
    
    // 【升級】加入 skeleton 骨架屏佔位，圖片 onload 後隱藏骨架並淡入圖片
    if (post.type === 'image' && post.src) {
        mediaHtml = `
            <div class="absolute inset-0 skeleton z-10" id="skel-${post.id}"></div>
            <img src="${post.src}" class="w-full h-full object-cover opacity-0 transition-opacity duration-500" onload="document.getElementById('skel-${post.id}').style.display='none'; this.classList.remove('opacity-0');">
        `;
    } else if (post.type === 'video' && post.src) {
        mediaHtml = `
            <div class="absolute inset-0 skeleton z-10" id="skel-${post.id}"></div>
            <video src="${post.src}" class="w-full h-full object-cover opacity-0 transition-opacity duration-500" muted autoplay loop onloadeddata="document.getElementById('skel-${post.id}').style.display='none'; this.classList.remove('opacity-0');"></video>
            <div class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md font-bold z-20"><i class="fa-solid fa-play"></i></div>
        `;
    } else {
        mediaHtml = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-red-50 p-6 text-center"><p class="font-bold text-gray-800 text-sm line-clamp-4">${post.title}</p></div>`;
    }
    
    let lockHtml = post.isPaid ? `<div class="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white z-30 pointer-events-none"><i class="fa-solid fa-lock text-3xl mb-2"></i><span class="font-black text-sm">${post.price} 金幣</span></div>` : '';

    const safeTitle = post.title.replace(/'/g, "\\'");

    // 【升級】將 onclick 改為 handleMediaClick，讓程式去判斷是單擊還是雙擊
    return `
        <div id="${post.id}" class="masonry-item animate-fade-in relative">
            <div class="relative overflow-hidden aspect-[4/5] bg-gray-100 cursor-pointer" onclick="handleMediaClick(event, '${post.src}', '${post.user}', '${post.avatar}', '${safeTitle}', '${post.likes}', '${post.id}', ${post.isPaid}, ${post.price}, '${post.type}')">
                ${mediaHtml}
                ${lockHtml}
            </div>
            <div class="p-3 bg-white">
                <h4 class="text-[13px] font-bold mb-2 text-gray-800 line-clamp-2 leading-snug cursor-pointer" onclick="openDetail('${post.src}', '${post.user}', '${post.avatar}', '${safeTitle}', '${post.likes}', '${post.id}', ${post.isPaid}, ${post.price}, '${post.type}')">${post.title}</h4>
                <div class="flex justify-between items-center text-[10px] text-gray-500">
                    <div class="flex items-center gap-1.5 cursor-pointer active:scale-95" onclick="event.stopPropagation(); openOtherProfile('${post.user}', '${post.avatar}')">
                        <img src="${post.avatar}" class="w-4 h-4 rounded-full object-cover">
                        <span class="font-bold hover:underline">${post.user}</span>
                    </div>
                    <div class="flex items-center gap-1 cursor-pointer" onclick="toggleLike(this)"><i class="fa-regular fa-heart text-xs"></i><span class="like-count">${post.likes}</span></div>
                </div>
            </div>
        </div>
    `;
}

// 【升級】單擊/雙擊控制器
function handleMediaClick(event, src, user, avatar, title, likes, id, isPaid, price, type) {
    if (clickTimer) {
        // 如果在 250 毫秒內點了第二次，就取消單擊事件，觸發雙擊
        clearTimeout(clickTimer);
        clickTimer = null;
        triggerDoubleTapLike(event, id);
    } else {
        // 第一下點擊，等待 250 毫秒看會不會有第二下
        clickTimer = setTimeout(() => {
            clickTimer = null;
            openDetail(src, user, avatar, title, likes, id, isPaid, price, type);
        }, 250);
    }
}

// 【升級】雙擊觸發巨型愛心動畫與點讚
function triggerDoubleTapLike(e, postId) {
    const container = e.currentTarget;
    
    // 1. 創建一個愛心元素
    const heart = document.createElement('i');
    heart.className = 'fa-solid fa-heart big-heart-anim';
    
    // 2. 獲取點擊位置，讓愛心出現在手指點的地方
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    
    // 3. 把愛心放進去，並在動畫結束後刪除
    container.appendChild(heart);
    setTimeout(() => { heart.remove(); }, 800);
    
    // 4. 連動底部的真實點讚按鈕 (如果還沒按讚的話)
    const card = document.getElementById(postId);
    if (card) {
        const likeBtn = card.querySelector('.fa-heart.fa-regular'); // 找尋空心愛心
        if (likeBtn) {
            likeBtn.parentElement.click(); // 觸發真實的 toggleLike 邏輯
        }
    }
}


// === 以下為原有完整功能，完全未刪減 ===

function openDetail(src, user, avatar, title, likes, id, isPaid, price, type) {
    if (isPaid && price > 0) {
        if (!confirm(`【解鎖提示】\n這是一個專屬付費作品，需要 ${price} 金幣解鎖。\n\n確認解鎖觀看嗎？`)) return;
    }

    const detail = document.getElementById('post-detail');
    const container = document.getElementById('detail-media-container');
    
    if (type === 'video' && src) {
        container.innerHTML = `<video src="${src}" class="w-full max-h-[65vh] object-contain bg-black" controls autoplay></video>`;
    } else if (type === 'image' && src) {
        container.innerHTML = `<img src="${src}" class="w-full object-contain max-h-[65vh]">`;
    } else {
        container.innerHTML = `<div class="w-full h-full min-h-[40vh] flex items-center justify-center bg-gradient-to-br from-pink-50 to-red-50 p-8 text-center"><p class="font-bold text-gray-800 text-lg leading-relaxed">${title}</p></div>`;
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
        document.getElementById('detail-media-container').innerHTML = ''; 
        document.body.style.overflow = ''; 
    }, 300);
}

function goToProfileFromDetail() {
    const sid = document.getElementById('post-detail').dataset.sourceId;
    const post = allPosts.find(p => p.id === sid);
    if(post) {
        closeDetail();
        setTimeout(() => openOtherProfile(post.user, post.avatar), 300);
    }
}

function giveTip() {
    const detail = document.getElementById('post-detail');
    const sid = detail.dataset.sourceId;
    const post = allPosts.find(p => p.id === sid);
    
    if(post) {
        const amount = prompt(`你要打賞給 ${post.user} 多少金幣？`, "50");
        if(amount && !isNaN(amount) && parseInt(amount) > 0) {
            alert(`成功打賞 ${amount} 金幣給 ${post.user}！`);
        }
    }
}

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

function toggleBookmark(el) {
    const bookmark = el.querySelector('i.fa-bookmark');
    bookmark.classList.toggle('fa-regular');
    bookmark.classList.toggle('fa-solid');
    bookmark.classList.toggle('text-yellow-500'); 
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

document.addEventListener('DOMContentLoaded', () => renderDiscovery());