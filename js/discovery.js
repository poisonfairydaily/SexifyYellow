// ==========================================
// js/discovery.js - 真實資料庫版
// ==========================================

let clickTimer = null;

// --- 渲染首頁動態 (真實撈取 Supabase) ---
window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;
    
    grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-3xl"></i></div>`;

    try {
        // 從 posts 撈取資料，並嘗試 join profiles 表以取得頭像與名稱
        let query = window.supabaseClient
            .from('posts')
            .select('*, profiles(display_name, avatar_url, username)')
            .order('created_at', { ascending: false });
        
        if (filterKeyword.trim() !== '') {
            query = query.ilike('caption', `%${filterKeyword}%`);
        }

        const { data: posts, error } = await query;
        
        if (error) throw error;

        if (!posts || posts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-2 text-center py-20 mt-10 text-gray-400 flex flex-col items-center">
                    <i class="fa-solid fa-ghost text-4xl mb-4 opacity-30"></i>
                    <p class="font-bold">目前大廳空空如也</p>
                    <p class="text-xs mt-1">成為第一個發佈貼文的人吧！</p>
                </div>`;
            return;
        }

        grid.innerHTML = posts.map(post => {
            const authorName = post.profiles?.display_name || '未知創作者';
            const authorAvatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${authorName}&background=random`;
            // 處理內容鎖定
            const isLocked = post.is_paid;
            const blurClass = isLocked ? 'blur-md pointer-events-none' : '';
            
            return `
            <div class="masonry-item relative shadow-sm border border-gray-100 bg-white overflow-hidden rounded-xl mb-2" ondblclick="handleDoubleTap(this, '${post.id}')">
                
                ${isLocked ? `<div class="absolute inset-0 bg-black/20 z-10 flex items-center justify-center flex-col backdrop-blur-[2px]"><i class="fa-solid fa-lock text-white text-2xl mb-2 drop-shadow-md"></i><span class="bg-sexify text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">解鎖 ${post.price || 99} 幣</span></div>` : ''}
                
                <div class="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-full px-2.5 py-1.5 z-20 cursor-pointer hover:bg-black/70 transition" onclick="event.stopPropagation(); window.location.href='profile.html?userId=${post.user_id}'">
                    <img src="${authorAvatar}" class="w-5 h-5 rounded-full border border-white/50 object-cover">
                    <span class="text-white text-[10px] font-bold shadow-sm tracking-wide">${authorName}</span>
                </div>

                <div class="relative bg-gray-100 min-h-[150px]">
                    ${post.media_url ? `<img src="${post.media_url}" class="w-full h-auto object-cover ${blurClass}" loading="lazy">` : `<div class="p-8 text-center text-gray-400 italic ${blurClass}">純文字內容</div>`}
                </div>
                
                <div class="p-3 bg-white relative z-20">
                    <p class="text-[13px] text-gray-800 line-clamp-2 leading-relaxed mb-2 font-medium">${post.caption || ''}</p>
                    <div class="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                        <div class="flex gap-4">
                            <button class="text-gray-400 text-xs hover:text-sexify transition flex items-center gap-1" onclick="toggleLike(this, '${post.id}')"><i class="fa-regular fa-heart text-base"></i> <span class="font-bold">${post.likes || 0}</span></button>
                            <button class="text-gray-400 text-xs hover:text-blue-500 transition flex items-center gap-1" onclick="openComments('${post.id}')"><i class="fa-regular fa-comment text-base"></i></button>
                        </div>
                        <button class="text-gray-300 text-xs hover:text-gray-600 transition"><i class="fa-solid fa-bookmark text-base"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error("載入動態失敗:", err);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-500 text-sm mt-10">無法連線到伺服器，請確認資料庫設定。</div>`;
    }
}

// --- 雙擊愛心與留言邏輯 ---
window.handleDoubleTap = function(element, postId) {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        triggerBigHeart(element);
        const likeBtn = element.querySelector('.fa-heart').parentElement;
        if (!likeBtn.querySelector('.fa-solid')) {
            toggleLike(likeBtn, postId);
        }
    } else {
        clickTimer = setTimeout(() => { clickTimer = null; }, 300);
    }
}

window.triggerBigHeart = function(container) {
    const heart = document.createElement('i');
    heart.className = 'fa-solid fa-heart big-heart-anim';
    heart.style.left = '50%';
    heart.style.top = '40%';
    container.appendChild(heart);
    setTimeout(() => heart.remove(), 800);
}

window.toggleLike = function(btn, postId) {
    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('span');
    let count = parseInt(countSpan.innerText) || 0;

    if (icon.classList.contains('fa-regular')) {
        icon.classList.replace('fa-regular', 'fa-solid');
        icon.classList.add('text-sexify', 'scale-125');
        count++;
    } else {
        icon.classList.replace('fa-solid', 'fa-regular');
        icon.classList.remove('text-sexify', 'scale-125');
        count--;
    }
    countSpan.innerText = count;
    setTimeout(() => icon.classList.remove('scale-125'), 200);
    
    // (未來可擴充：將 Like 數寫回 Supabase)
}

window.openComments = function(postId) { 
    document.getElementById('comment-sheet').classList.remove('hidden'); 
    setTimeout(() => document.getElementById('comment-panel').classList.remove('translate-y-full'), 10); 
    
    // 簡單模擬載入留言
    const list = document.getElementById('comment-list');
    list.innerHTML = `<div class="p-10 text-center text-gray-400 text-sm">目前沒有留言，搶頭香！</div>`;
}

window.closeComments = function() { 
    document.getElementById('comment-panel').classList.add('translate-y-full'); 
    setTimeout(() => document.getElementById('comment-sheet').classList.add('hidden'), 300); 
}

window.sendComment = function() {
    const input = document.getElementById('comment-input');
    if(!input.value.trim()) return;
    
    const list = document.getElementById('comment-list');
    if(list.innerText.includes('沒有留言')) list.innerHTML = '';
    
    const myName = localStorage.getItem('myChatName') || '我';
    
    list.innerHTML += `
        <div class="flex gap-3 mb-4">
            <img src="https://ui-avatars.com/api/?name=${myName}&background=random" class="w-8 h-8 rounded-full shadow-sm">
            <div class="flex-1 bg-gray-50 border border-gray-100 p-3 rounded-2xl rounded-tl-sm">
                <p class="text-[11px] font-bold text-sexify">${myName}</p>
                <p class="text-sm mt-1 text-gray-800">${input.value}</p>
            </div>
        </div>`;
    
    input.value = '';
    list.scrollTop = list.scrollHeight;
}
