// ==========================================
// js/discovery.js - 數據同步修復版
// ==========================================

let clickTimer = null;

async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

// ------------------------------------------
// 1. 渲染發現頁面 (列表同步)
// ------------------------------------------
window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;

    grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-3xl"></i></div>`;

    try {
        const myId = await getAuthenticatedUserId();

        // 核心：必須 select likes(user_id) 才能知道總數以及「我」是否點讚
        let query = window.supabaseClient
            .from('posts')
            .select(`
                *,
                profiles(display_name, avatar_url, username),
                likes(user_id)
            `)
            .order('created_at', { ascending: false });

        if (filterKeyword.trim() !== '') {
            query = query.ilike('caption', `%${filterKeyword}%`);
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        if (!posts || posts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">目前沒有貼文</div>`;
            return;
        }

        grid.innerHTML = posts.map(post => {
            const profile = post.profiles || {};
            const displayName = window.escapeHTML(profile.display_name || profile.username || '匿名');
            const avatar = profile.avatar_url || `https://ui-avatars.com/api/?name=${displayName}`;
            
            // 同步邏輯：檢查 likes 陣列
            const likesArr = post.likes || [];
            const isLiked = myId ? likesArr.some(l => l.user_id === myId) : false;
            const likesCount = likesArr.length;

            return `
            <div class="masonry-item relative group" onclick="handlePostClick(event, '${post.id}')">
                ${post.is_paid ? `<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full z-10 flex items-center gap-1"><i class="fa-solid fa-lock text-[8px]"></i>付費限定</div>` : ''}
                
                ${post.media_url ? `
                    <div class="relative overflow-hidden">
                        <img src="${post.media_url}" class="w-full h-auto object-cover group-hover:scale-105 transition duration-500" loading="lazy">
                    </div>
                ` : ''}

                <div class="p-3">
                    <p class="text-gray-800 text-xs leading-relaxed mb-3 line-clamp-2">${window.escapeHTML(post.caption)}</p>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 overflow-hidden" onclick="event.stopPropagation(); viewOtherProfile('${post.user_id}')">
                            <img src="${avatar}" class="w-5 h-5 rounded-full object-cover">
                            <span class="text-[10px] text-gray-500 truncate">${displayName}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-1 cursor-pointer" onclick="event.stopPropagation(); toggleLike('${post.id}', this)">
                                <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-xs ${isLiked ? 'text-sexify' : 'text-gray-400'}"></i>
                                <span class="text-[10px] ${isLiked ? 'text-sexify' : 'text-gray-400'}">${likesCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error("渲染失敗:", err);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-400">載入失敗，請稍後再試</div>`;
    }
}

// ------------------------------------------
// 2. 點讚邏輯 (與資料庫完全同步)
// ------------------------------------------
window.toggleLike = async function(postId, btnContainer) {
    const icon = btnContainer.querySelector('i');
    const countSpan = btnContainer.querySelector('span');
    let currentCount = parseInt(countSpan.innerText);
    const myId = await getAuthenticatedUserId();

    if (!myId) return alert('請先登入後再點讚！');

    const isCurrentlyLiked = icon.classList.contains('fa-solid');

    try {
        if (isCurrentlyLiked) {
            const { error } = await window.supabaseClient.from('likes').delete().eq('post_id', postId).eq('user_id', myId);
            if (error) throw error;

            icon.classList.replace('fa-solid', 'fa-regular');
            icon.classList.remove('text-sexify');
            icon.classList.add('text-gray-400');
            countSpan.classList.remove('text-sexify');
            countSpan.classList.add('text-gray-400');
            countSpan.innerText = Math.max(0, currentCount - 1);
        } else {
            const { error } = await window.supabaseClient.from('likes').insert([{ post_id: postId, user_id: myId }]);
            if (error) throw error;

            icon.classList.replace('fa-regular', 'fa-solid');
            icon.classList.add('text-sexify');
            icon.classList.remove('text-gray-400');
            countSpan.classList.add('text-sexify');
            countSpan.classList.remove('text-gray-400');
            countSpan.innerText = currentCount + 1;
        }
        
        // 如果詳情視窗開著，同步更新詳情視窗的讚數 (如果有對應 UI 的話)
    } catch (err) {
        console.error("點讚失敗:", err);
    }
}

// ------------------------------------------
// 3. 貼文詳情 (修正：進入詳情也要抓點讚狀態)
// ------------------------------------------
window.openPostDetail = async function(postId) {
    const modal = document.getElementById('post-detail-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    
    // 初始化 UI 為載入中
    document.getElementById('detail-caption').innerText = "載入中...";

    try {
        const myId = await getAuthenticatedUserId();
        const { data: post, error } = await window.supabaseClient
            .from('posts')
            .select('*, profiles(*), likes(user_id)')
            .eq('id', postId)
            .single();

        if (error) throw error;

        const profile = post.profiles || {};
        const likesArr = post.likes || [];
        const isLiked = myId ? likesArr.some(l => l.user_id === myId) : false;
        const likesCount = likesArr.length;

        document.getElementById('detail-display-name').innerText = profile.display_name || profile.username;
        document.getElementById('detail-username').innerText = '@' + profile.username;
        document.getElementById('detail-avatar').src = profile.avatar_url || `https://ui-avatars.com/api/?name=U`;
        document.getElementById('detail-caption').innerText = post.caption;
        
        // 這裡如果你在 index.html 有讚數顯示，也請同步更新
        // 例如：document.getElementById('detail-like-count').innerText = likesCount;

        const mediaContainer = document.getElementById('detail-media-container');
        if (post.media_url) {
            mediaContainer.innerHTML = `<img src="${post.media_url}" class="w-full h-auto">`;
            mediaContainer.classList.remove('hidden');
        } else {
            mediaContainer.classList.add('hidden');
        }

        // 權限：只有本人可以顯示選單
        const optionsBtn = document.getElementById('post-options-btn');
        if (post.user_id === myId) {
            optionsBtn.classList.remove('hidden');
            optionsBtn.onclick = () => {
                const menu = document.getElementById('post-options-menu');
                menu.classList.toggle('hidden');
                document.getElementById('edit-post-btn').onclick = () => editPost(post.id);
                document.getElementById('delete-post-btn').onclick = () => deletePostFromModal(post.id);
            };
        } else {
            optionsBtn.classList.add('hidden');
        }

    } catch (err) {
        console.error("讀取詳情失敗:", err);
    }
}

window.handlePostClick = function(event, postId) {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        const btnContainer = event.currentTarget.querySelector('.flex.items-center.gap-1');
        if (btnContainer) toggleLike(postId, btnContainer);
    } else {
        clickTimer = setTimeout(() => {
            clickTimer = null;
            openPostDetail(postId);
        }, 300);
    }
}

window.closePostDetail = function() {
    const modal = document.getElementById('post-detail-modal');
    if(modal) modal.classList.add('hidden');
}

window.editPost = async function(postId) {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    const newText = prompt("請輸入新的貼文內容：");
    if (newText === null) return;
    try {
        const { error } = await window.supabaseClient.from('posts').update({ caption: newText }).eq('id', postId);
        if(error) throw error;
        document.getElementById('detail-caption').innerText = newText;
        renderDiscovery();
    } catch (err) { alert("編輯失敗"); }
}

window.deletePostFromModal = async function(postId) {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    if (!confirm("確定要刪除這則貼文嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('posts').delete().eq('id', postId);
        if(error) throw error;
        closePostDetail();
        renderDiscovery();
    } catch (err) { alert("刪除失敗"); }
}

window.reportPost = function() {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    alert("已收到您的檢舉！");
}
