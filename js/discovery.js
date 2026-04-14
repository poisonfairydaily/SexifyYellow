// ==========================================
// js/discovery.js - 雙重查詢與點讚防呆版
// ==========================================

let clickTimer = null;

// ==========================================
// 🛡️ 安全修復版 renderDiscovery (防禦 XSS)
// ==========================================

window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;

    // 1. 顯示載入中動畫
    grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-3xl"></i></div>`;

    try {
        // 2. 向 Supabase 請求資料 (包含關聯的 profiles)
        let query = window.supabaseClient
            .from('posts')
            .select('*, profiles(display_name, avatar_url, username)')
            .order('created_at', { ascending: false });

        // 處理關鍵字搜尋
        if (filterKeyword.trim() !== '') {
            query = query.ilike('caption', `%${filterKeyword}%`);
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        // 3. 處理空狀態 (找不到貼文時)
        if (!posts || posts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-2 text-center py-20 mt-10 text-gray-400 flex flex-col items-center">
                    <i class="fa-solid fa-ghost text-4xl mb-4 opacity-30"></i>
                    <p class="font-bold">目前大廳空空如也</p>
                </div>`;
            return;
        }

        // 4. 取得當前使用者的按讚與收藏狀態 (用於 UI 顯示)
        const myUserId = localStorage.getItem('userId');
        const myLikes = window.myLikesSet || new Set();
        const bookmarks = window.bookmarks || []; // 假設有儲存收藏的全域陣列

        // 5. 渲染貼文並注入 HTML
        grid.innerHTML = posts.map(post => {
            // 🚨 【核心安全防禦】：全面過濾來自資料庫 (使用者輸入) 的字串
            // 使用我們在 supabase-config.js 定義的 window.escapeHTML
            const safeName = window.escapeHTML(post.profiles?.display_name || '未知創作者');
            const safeCaption = window.escapeHTML(post.caption || '');
            const safeAvatar = window.escapeHTML(post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${safeName}`);
            const safeMedia = window.escapeHTML(post.media_url || '');

            // 判斷付費鎖定狀態與模糊效果
            const isLocked = post.is_paid;
            const blurClass = isLocked ? 'blur-md pointer-events-none' : '';
            
            // 判斷 Icon 顏色
            const isBookmarked = bookmarks.some(b => b.id === post.id);
            const bmIcon = isBookmarked ? 'fa-solid text-yellow-500' : 'fa-regular text-gray-300';
            const likeIcon = myLikes.has(post.id) ? 'fa-solid text-sexify' : 'fa-regular text-gray-400';

            return `
            <div class="masonry-item relative shadow-sm border border-gray-100 bg-white overflow-hidden rounded-xl mb-2 cursor-pointer" onclick="viewPost('${post.id}')">
                
                ${isLocked ? `<div class="absolute inset-0 bg-black/20 z-10 flex items-center justify-center flex-col backdrop-blur-[2px]"><i class="fa-solid fa-lock text-white text-2xl mb-2 drop-shadow-md"></i><span class="bg-sexify text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">解鎖 ${post.price || 99} 幣</span></div>` : ''}
                
                <div class="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-full px-2.5 py-1.5 z-20 cursor-pointer hover:bg-black/70 transition" onclick="event.stopPropagation(); window.location.href='profile.html?userId=${post.user_id}'">
                    <img src="${safeAvatar}" class="w-5 h-5 rounded-full border border-white/50 object-cover" onerror="this.src='https://ui-avatars.com/api/?name=User'">
                    <span class="text-white text-[10px] font-bold shadow-sm tracking-wide">${safeName}</span>
                </div>

                <div class="relative bg-gray-100 min-h-[150px]">
                    ${safeMedia ? `<img src="${safeMedia}" class="w-full h-auto object-cover ${blurClass}" loading="lazy">` : `<div class="p-8 text-center text-gray-400 italic ${blurClass}">純文字內容</div>`}
                </div>
                
                <div class="p-3 bg-white relative z-20">
                    <p class="text-[13px] text-gray-800 line-clamp-2 leading-relaxed mb-2 font-medium">${safeCaption}</p>
                    
                    <div class="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                        <div class="flex items-center gap-3">
                            <button onclick="event.stopPropagation(); toggleLike('${post.id}', this)" class="flex items-center gap-1 group">
                                <i class="${likeIcon} text-sm transition-transform group-active:scale-125"></i>
                                <span class="text-[11px] text-gray-500 font-medium">${post.likes_count || 0}</span>
                            </button>
                            <button onclick="event.stopPropagation(); viewPost('${post.id}')" class="flex items-center gap-1 group">
                                <i class="fa-regular fa-comment text-gray-400 text-sm transition-transform group-active:scale-125"></i>
                                <span class="text-[11px] text-gray-500 font-medium">留言</span>
                            </button>
                        </div>
                        <button onclick="event.stopPropagation(); toggleBookmark('${post.id}', this)" class="group">
                            <i class="${bmIcon} text-sm transition-transform group-active:scale-125"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        console.error("載入探索頁面失敗:", error);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10 text-red-400 text-sm font-bold">載入失敗，請檢查網路連線或稍後再試。</div>`;
    }
};

// 雲端收藏
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

// 雲端按讚：修復負數防呆與點擊鎖定
window.toggleLike = async function(btn, postId, postOwnerId) {
    if (btn.disabled) return; // 防連點機制
    btn.disabled = true;

    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('span');
    let count = parseInt(countSpan.innerText.trim());
    if (isNaN(count)) count = 0; // 嚴格解析數字

    const myUserId = localStorage.getItem('userId');
    if(!myUserId) {
        btn.disabled = false;
        return alert("請先登入");
    }

    const isLiking = icon.classList.contains('fa-regular');

    if (isLiking) {
        icon.classList.replace('fa-regular', 'fa-solid');
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-sexify', 'scale-125');
        countSpan.innerText = count + 1;
        
        try {
            await window.supabaseClient.from('likes').insert({ post_id: postId, user_id: myUserId });
            await window.supabaseClient.from('posts').update({ likes: count + 1 }).eq('id', postId);
            if (postOwnerId && postOwnerId !== myUserId) {
                await window.supabaseClient.from('notifications').insert({ user_id: postOwnerId, actor_id: myUserId, type: 'like', post_id: postId });
            }
        } catch(e) { console.error("按讚失敗", e); }
    } else {
        const newCount = Math.max(0, count - 1); // 防呆：確保讚數永不為負
        icon.classList.replace('fa-solid', 'fa-regular');
        icon.classList.remove('text-sexify', 'scale-125');
        icon.classList.add('text-gray-400');
        countSpan.innerText = newCount;

        try {
            await window.supabaseClient.from('likes').delete().match({ post_id: postId, user_id: myUserId });
            await window.supabaseClient.from('posts').update({ likes: newCount }).eq('id', postId);
        } catch(e) { console.error("收回讚失敗", e); }
    }
    
    setTimeout(() => {
        icon.classList.remove('scale-125');
        btn.disabled = false;
    }, 300);
}

// 查看貼文詳情
window.currentViewedPostId = null;
window.currentViewedPostOwnerId = null;
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
        
        window.currentViewedPostOwnerId = post.user_id;
        const myUserId = localStorage.getItem('userId');
        const authorName = post.profiles?.display_name || '未知創作者';
        const authorAvatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${authorName}&background=random`;
        const blurClass = post.is_paid ? 'blur-md pointer-events-none' : '';

        const optionsMenu = document.getElementById('post-options-menu');
        if (post.user_id === myUserId) {
            optionsMenu.innerHTML = `
                <button onclick="editPostContent('${post.id}')" class="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 border-b border-gray-50">編輯貼文</button>
                <button onclick="deletePostFromModal('${post.id}')" class="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-gray-50">刪除貼文</button>
            `;
        } else {
            optionsMenu.innerHTML = `<button onclick="reportPost('${post.id}')" class="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-gray-50">檢舉貼文</button>`;
        }

        const { data: likeData } = await window.supabaseClient.from('likes').select('id').eq('post_id', postId).eq('user_id', myUserId);
        const likeIcon = (likeData && likeData.length > 0) ? 'fa-solid text-sexify' : 'fa-regular text-gray-400';

        let bookmarks = JSON.parse(localStorage.getItem('myBookmarks')) || [];
        const isBookmarked = bookmarks.some(b => b.id === post.id);
        const bmIcon = isBookmarked ? 'fa-solid text-yellow-500' : 'fa-regular text-gray-300';
        
        const safePost = { id: post.id, caption: post.caption, media_url: post.media_url, authorName: authorName, authorAvatar: authorAvatar };
        const postStr = encodeURIComponent(JSON.stringify(safePost));

        contentDiv.innerHTML = `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 cursor-pointer active:bg-gray-50 transition" onclick="closePostDetail(); viewOtherProfile('${post.user_id}')">
                <img src="${authorAvatar}" class="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm">
                <div class="flex-1">
                    <div class="font-bold text-sm text-gray-900">${authorName}</div>
                    <div class="text-[10px] text-gray-400">${new Date(post.created_at).toLocaleString()}</div>
                </div>
                <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
            </div>
            
            ${post.media_url ? `<img src="${post.media_url}" class="w-full h-auto object-cover ${blurClass}">` : `<div class="p-10 text-center text-gray-400 italic bg-gray-50 ${blurClass}">純文字內容</div>`}
            
            <div class="p-4 border-b border-gray-50 flex justify-between items-center">
                <button class="text-xs hover:text-sexify transition flex items-center gap-1.5" onclick="toggleLike(this, '${post.id}', '${post.user_id}')">
                    <i class="${likeIcon} fa-heart text-xl"></i> <span class="font-bold text-gray-400">${post.likes || 0}</span>
                </button>
                <button class="text-xl hover:text-gray-600 transition" onclick="toggleBookmark(this, '${post.id}', '${postStr}')">
                    <i class="${bmIcon} fa-bookmark"></i>
                </button>
            </div>
            
            <div class="p-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed" id="detail-caption">${post.caption || ''}</div>
        `;
        
        renderComments();
    } catch(e) {
        contentDiv.innerHTML = `<div class="p-10 text-center text-red-500">無法載入貼文內容</div>`;
    }
}

// 雲端讀取留言 (全面重構：雙重查詢解決 JOIN 報錯)
window.renderComments = async function() {
    const list = document.getElementById('post-comments-list');
    list.innerHTML = `<div class="text-center py-5"><i class="fa-solid fa-spinner fa-spin text-gray-300"></i></div>`;
    
    try {
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('post_id', window.currentViewedPostId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        if (!comments || comments.length === 0) {
            list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前沒有留言，來搶頭香吧！</div>`;
            return;
        }

        // 雙重安全查詢：獲取所有留言者的 ID，再請求 Profiles
        const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
        let profilesMap = {};
        if (userIds.length > 0) {
            const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
            if (profs) profs.forEach(p => profilesMap[p.id] = p);
        }
        
        list.innerHTML = comments.map(c => {
            const user = profilesMap[c.user_id] || {};
            return `
            <div class="flex gap-3 mb-4">
                <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-8 h-8 rounded-full shadow-sm object-cover border border-gray-100 flex-shrink-0">
                <div class="flex-1 bg-gray-50 border border-gray-100 p-3 rounded-2xl rounded-tl-sm shadow-sm">
                    <p class="text-[11px] font-bold text-sexify mb-1">${user.display_name || '使用者'}</p>
                    <p class="text-sm text-gray-800">${c.content}</p>
                    <p class="text-[9px] text-gray-400 mt-1.5">${new Date(c.created_at).toLocaleString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
            </div>`;
        }).join('');
        setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
    } catch(e) {
        console.error("載入留言失敗", e);
        list.innerHTML = `<div class="text-center py-5 text-red-400 text-xs">載入留言失敗，請確認 RLS 設定。</div>`;
    }
}

// 雲端寫入留言與發送通知
window.submitComment = async function() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if(!text) return;
    
    const myUserId = localStorage.getItem('userId');
    if(!myUserId) return alert("請先登入");

    input.value = '';
    
    try {
        await window.supabaseClient.from('comments').insert({ post_id: window.currentViewedPostId, user_id: myUserId, content: text });
        
        if (window.currentViewedPostOwnerId && window.currentViewedPostOwnerId !== myUserId) {
            await window.supabaseClient.from('notifications').insert({ user_id: window.currentViewedPostOwnerId, actor_id: myUserId, type: 'comment', post_id: window.currentViewedPostId });
        }
        
        renderComments();
    } catch(e) {
        alert("留言失敗");
    }
}

window.editPostContent = async function(postId) {
    document.getElementById('post-options-menu').classList.add('hidden');
    const newText = prompt("請輸入新的貼文內容：");
    if (newText === null) return;
    try {
        await window.supabaseClient.from('posts').update({ caption: newText }).eq('id', postId);
        document.getElementById('detail-caption').innerText = newText;
        if(typeof renderDiscovery === 'function') renderDiscovery();
    } catch (err) {}
}

window.deletePostFromModal = async function(postId) {
    document.getElementById('post-options-menu').classList.add('hidden');
    if (!confirm("確定要刪除這則貼文嗎？")) return;
    try {
        await window.supabaseClient.from('posts').delete().eq('id', postId);
        closePostDetail();
        if(typeof renderDiscovery === 'function') renderDiscovery();
    } catch (err) {}
}

window.reportPost = function() {
    document.getElementById('post-options-menu').classList.add('hidden');
    alert("已收到您的檢舉！");
}

window.closePostDetail = function() {
    const modal = document.getElementById('post-detail-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}
