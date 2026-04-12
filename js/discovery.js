// ==========================================
// js/discovery.js - 留言與收藏擴充版
// ==========================================

let clickTimer = null;

window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;
    
    grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-3xl"></i></div>`;

    try {
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

        // 讀取本地收藏狀態
        let bookmarks = JSON.parse(localStorage.getItem('myBookmarks')) || [];

        grid.innerHTML = posts.map(post => {
            const authorName = post.profiles?.display_name || '未知創作者';
            const authorAvatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${authorName}&background=random`;
            const isLocked = post.is_paid;
            const blurClass = isLocked ? 'blur-md pointer-events-none' : '';
            
            // 檢查是否已收藏
            const isBookmarked = bookmarks.some(b => b.id === post.id);
            const bmIcon = isBookmarked ? 'fa-solid text-yellow-500' : 'fa-regular text-gray-300';
            
            // 將物件轉成字串以供收藏功能寫入
            const safePost = {
                id: post.id,
                caption: post.caption,
                media_url: post.media_url,
                authorName: authorName,
                authorAvatar: authorAvatar
            };
            const postStr = encodeURIComponent(JSON.stringify(safePost));

            return `
            <div class="masonry-item relative shadow-sm border border-gray-100 bg-white overflow-hidden rounded-xl mb-2 cursor-pointer" onclick="viewPost('${post.id}')">
                
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
                            <button class="text-gray-400 text-xs hover:text-sexify transition flex items-center gap-1" onclick="event.stopPropagation(); toggleLike(this, '${post.id}')"><i class="fa-regular fa-heart text-base"></i> <span class="font-bold">${post.likes || 0}</span></button>
                            <button class="text-gray-400 text-xs hover:text-blue-500 transition flex items-center gap-1" onclick="event.stopPropagation(); viewPost('${post.id}')"><i class="fa-regular fa-comment text-base"></i></button>
                        </div>
                        <button class="text-xs hover:text-gray-600 transition" onclick="event.stopPropagation(); toggleBookmark(this, '${post.id}', '${postStr}')"><i class="${bmIcon} fa-bookmark text-base"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error("載入動態失敗:", err);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-500 text-sm mt-10">無法連線到伺服器，請確認資料庫設定。</div>`;
    }
}

// 收藏功能
window.toggleBookmark = function(btn, postId, postStr) {
    let bookmarks = JSON.parse(localStorage.getItem('myBookmarks')) || [];
    const index = bookmarks.findIndex(b => b.id === postId);
    const icon = btn.querySelector('i');
    
    if (index > -1) {
        bookmarks.splice(index, 1);
        icon.classList.replace('fa-solid', 'fa-regular');
        icon.classList.remove('text-yellow-500');
        icon.classList.add('text-gray-300');
    } else {
        const postObj = JSON.parse(decodeURIComponent(postStr));
        bookmarks.push(postObj);
        icon.classList.replace('fa-regular', 'fa-solid');
        icon.classList.remove('text-gray-300');
        icon.classList.add('text-yellow-500');
    }
    localStorage.setItem('myBookmarks', JSON.stringify(bookmarks));
}

// 點讚功能
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
}

// 查看貼文詳情與留言
window.currentViewedPostId = null;
window.viewPost = async function(postId) {
    window.currentViewedPostId = postId;
    const modal = document.getElementById('post-detail-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    const contentDiv = document.getElementById('post-detail-content');
    contentDiv.innerHTML = `<div class="p-10 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;
    
    try {
        const { data: post, error } = await window.supabaseClient
            .from('posts')
            .select('*, profiles(display_name, avatar_url, username)')
            .eq('id', postId)
            .single();
            
        if (error) throw error;
        
        const authorName = post.profiles?.display_name || '未知創作者';
        const authorAvatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${authorName}&background=random`;
        const isLocked = post.is_paid;
        const blurClass = isLocked ? 'blur-md pointer-events-none' : '';

        contentDiv.innerHTML = `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50">
                <img src="${authorAvatar}" class="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm">
                <div class="flex-1">
                    <div class="font-bold text-sm text-gray-900">${authorName}</div>
                    <div class="text-[10px] text-gray-400">${new Date(post.created_at).toLocaleString()}</div>
                </div>
            </div>
            ${post.media_url ? `<img src="${post.media_url}" class="w-full h-auto object-cover ${blurClass}">` : `<div class="p-10 text-center text-gray-400 italic bg-gray-50 ${blurClass}">純文字內容</div>`}
            <div class="p-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed">${post.caption || ''}</div>
        `;
        
        renderComments();
    } catch(e) {
        contentDiv.innerHTML = `<div class="p-10 text-center text-red-500">無法載入貼文內容</div>`;
    }
}

window.closePostDetail = function() {
    const modal = document.getElementById('post-detail-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

window.renderComments = function() {
    const list = document.getElementById('post-comments-list');
    const comments = JSON.parse(localStorage.getItem('comments_' + window.currentViewedPostId)) || [];
    
    if (comments.length === 0) {
        list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前沒有留言，來搶頭香吧！</div>`;
        return;
    }
    
    list.innerHTML = comments.map(c => `
        <div class="flex gap-3 mb-4">
            <img src="${c.avatar}" class="w-8 h-8 rounded-full shadow-sm object-cover border border-gray-100">
            <div class="flex-1 bg-gray-50 border border-gray-100 p-3 rounded-2xl rounded-tl-sm shadow-sm">
                <p class="text-[11px] font-bold text-sexify mb-1">${c.name}</p>
                <p class="text-sm text-gray-800">${c.text}</p>
                <p class="text-[9px] text-gray-400 mt-1.5">${c.time}</p>
            </div>
        </div>
    `).join('');
}

window.submitComment = function() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if(!text) return;
    
    let comments = JSON.parse(localStorage.getItem('comments_' + window.currentViewedPostId)) || [];
    
    const myName = localStorage.getItem('myChatName') || '使用者';
    const avatar = `https://ui-avatars.com/api/?name=${myName}&background=random`;
    
    comments.push({
        name: myName,
        avatar: avatar,
        text: text,
        time: new Date().toLocaleString([], {hour: '2-digit', minute:'2-digit'})
    });
    
    localStorage.setItem('comments_' + window.currentViewedPostId, JSON.stringify(comments));
    input.value = '';
    renderComments();
    
    const list = document.getElementById('post-comments-list');
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
}
