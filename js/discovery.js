// ==========================================
// js/discovery.js - 點讚同步與安全強化版
// ==========================================

let clickTimer = null;

// 內部工具：獲取當前真實經過驗證的 User ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

// ==========================================
// 🛡️ 渲染發現頁面 (包含點讚狀態讀取)
// ==========================================
window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;

    // 1. 顯示載入中
    grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-3xl\"></i></div>`;

    try {
        const myId = await getAuthenticatedUserId();

        // 2. 向 Supabase 請求貼文，並同時抓取該用戶是否有點讚
        // 我們利用 likes 表的 select 來判斷
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

        // 3. 渲染 HTML
        grid.innerHTML = posts.map(post => {
            const profile = post.profiles || {};
            const displayName = window.escapeHTML(profile.display_name || profile.username || '匿名');
            const avatar = profile.avatar_url || `https://ui-avatars.com/api/?name=${displayName}`;
            
            // 判斷當前用戶是否已點讚
            const isLiked = myId ? post.likes.some(l => l.user_id === myId) : false;
            
            // 計算總讚數 (從 likes 陣列的長度獲取)
            const likesCount = post.likes ? post.likes.length : 0;

            return `
            <div class=\"masonry-item relative group\" onclick=\"handlePostClick(event, '${post.id}')\">
                ${post.is_paid ? `<div class=\"absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full z-10 flex items-center gap-1\"><i class=\"fa-solid fa-lock text-[8px]\"></i>付費限定</div>` : ''}
                
                ${post.media_url ? `
                    <div class=\"relative overflow-hidden\">
                        <img src=\"${post.media_url}\" class=\"w-full h-auto object-cover group-hover:scale-105 transition duration-500\" loading=\"lazy\">
                    </div>
                ` : ''}

                <div class=\"p-3\">
                    <p class=\"text-gray-800 text-xs leading-relaxed mb-3 line-clamp-2\">${window.escapeHTML(post.caption)}</p>
                    <div class=\"flex items-center justify-between\">
                        <div class=\"flex items-center gap-2 overflow-hidden\" onclick=\"event.stopPropagation(); viewOtherProfile('${post.user_id}')\">
                            <img src=\"${avatar}\" class=\"w-5 h-5 rounded-full object-cover\">
                            <span class=\"text-[10px] text-gray-500 truncate\">${displayName}</span>
                        </div>
                        <div class=\"flex items-center gap-3\">
                            <div class=\"flex items-center gap-1 cursor-pointer\" onclick=\"event.stopPropagation(); toggleLike('${post.id}', this)\">
                                <i class=\"${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-xs ${isLiked ? 'text-sexify' : 'text-gray-400'}\"></i>
                                <span class=\"text-[10px] ${isLiked ? 'text-sexify' : 'text-gray-400'}\">${likesCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error(\"渲染失敗:\", err);
        grid.innerHTML = `<div class=\"col-span-2 text-center py-20 text-red-400\">載入失敗，請稍後再試</div>`;
    }
}

// ==========================================
// ❤️ 點讚邏輯切換 (與資料庫同步)
// ==========================================
window.toggleLike = async function(postId, btnContainer) {
    const icon = btnContainer.querySelector('i');
    const countSpan = btnContainer.querySelector('span');
    let currentCount = parseInt(countSpan.innerText);
    const myId = await getAuthenticatedUserId();

    if (!myId) return alert('請先登入後再點讚！');

    const isCurrentlyLiked = icon.classList.contains('fa-solid');

    try {
        if (isCurrentlyLiked) {
            // 取消點讚
            const { error } = await window.supabaseClient
                .from('likes')
                .delete()
                .eq('post_id', postId)
                .eq('user_id', myId);
            
            if (error) throw error;

            // UI 更新
            icon.classList.replace('fa-solid', 'fa-regular');
            icon.classList.remove('text-sexify');
            icon.classList.add('text-gray-400');
            countSpan.classList.remove('text-sexify');
            countSpan.classList.add('text-gray-400');
            countSpan.innerText = Math.max(0, currentCount - 1);
        } else {
            // 新增點讚
            const { error } = await window.supabaseClient
                .from('likes')
                .insert([{ post_id: postId, user_id: myId }]);
            
            if (error) throw error;

            // UI 更新
            icon.classList.replace('fa-regular', 'fa-solid');
            icon.classList.add('text-sexify');
            icon.classList.remove('text-gray-400');
            countSpan.classList.add('text-sexify');
            countSpan.classList.remove('text-gray-400');
            countSpan.innerText = currentCount + 1;

            // 觸發愛心噴發特效 (可選)
            if(typeof triggerHeartBurst === 'function') triggerHeartBurst(btnContainer);
        }
    } catch (err) {
        console.error(\"點讚操作失敗:\", err);
    }
}

// ==========================================
// 點擊貼文處理 (雙擊點讚 / 單擊開啟詳情)
// ==========================================
window.handlePostClick = function(event, postId) {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        // 雙擊：執行點讚
        const btnContainer = event.currentTarget.querySelector('.flex.items-center.gap-1');
        if (btnContainer) toggleLike(postId, btnContainer);
    } else {
        clickTimer = setTimeout(() => {
            clickTimer = null;
            // 單擊：開啟詳情
            if(typeof openPostDetail === 'function') openPostDetail(postId);
        }, 300);
    }
}

// 貼文詳情與其餘 Discovery 函數保持不變...
window.openPostDetail = async function(postId) {
    const modal = document.getElementById('post-detail-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    
    try {
        const { data: post, error } = await window.supabaseClient
            .from('posts')
            .select('*, profiles(*)')
            .eq('id', postId)
            .single();

        if (error) throw error;

        document.getElementById('detail-display-name').innerText = post.profiles.display_name || post.profiles.username;
        document.getElementById('detail-username').innerText = '@' + post.profiles.username;
        document.getElementById('detail-avatar').src = post.profiles.avatar_url || 'https://ui-avatars.com/api/?name=U';
        document.getElementById('detail-caption').innerText = post.caption;
        
        const mediaContainer = document.getElementById('detail-media-container');
        if (post.media_url) {
            mediaContainer.innerHTML = `<img src=\"${post.media_url}\" class=\"w-full h-auto\">`;
            mediaContainer.classList.remove('hidden');
        } else {
            mediaContainer.classList.add('hidden');
        }

        const optionsBtn = document.getElementById('post-options-btn');
        const myId = await getAuthenticatedUserId();
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
        console.error(\"讀取詳情失敗:\", err);
    }
}

window.closePostDetail = function() {
    const modal = document.getElementById('post-detail-modal');
    if(modal) modal.classList.add('hidden');
}

window.editPost = async function(postId) {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    
    const newText = prompt(\"請輸入新的貼文內容：\");
    if (newText === null) return;
    try {
        const { error } = await window.supabaseClient.from('posts').update({ caption: newText }).eq('id', postId);
        if(error) throw error;
        const captionElem = document.getElementById('detail-caption');
        if(captionElem) captionElem.innerText = newText;
        renderDiscovery();
    } catch (err) { alert(\"編輯失敗\"); }
}

window.deletePostFromModal = async function(postId) {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    
    if (!confirm(\"確定要刪除這則貼文嗎？\")) return;
    try {
        const { error } = await window.supabaseClient.from('posts').delete().eq('id', postId);
        if(error) throw error;
        closePostDetail();
        renderDiscovery();
    } catch (err) { alert(\"刪除失敗\"); }
}

window.reportPost = function() {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    alert(\"已收到您的檢舉！\");
}
