// ==========================================
// js/discovery.js - 讚數即時同步版
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
                </div>`;
            return;
        }

        const myUserId = localStorage.getItem('userId');
        let myLikes = new Set();
        if (myUserId) {
            const { data: likes } = await window.supabaseClient.from('likes').select('post_id').eq('user_id', myUserId);
            if (likes) likes.forEach(l => myLikes.add(l.post_id));
        }

        grid.innerHTML = posts.map(post => {
            const isLiked = myLikes.has(post.id);
            const avatar = post.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=U';
            return `
            <div class="masonry-item group relative" id="grid-post-${post.id}">
                <div class="relative overflow-hidden cursor-pointer" onclick="handlePostClick(event, '${post.id}')">
                    <img src="${post.media_url || 'https://picsum.photos/400/600?random='+post.id}" class="w-full object-cover">
                    ${post.is_paid ? '<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-bold backdrop-blur-md">付費限定</div>' : ''}
                </div>
                <div class="p-3">
                    <p class="text-xs text-gray-800 line-clamp-2 mb-2 font-medium leading-relaxed">${post.caption || ''}</p>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5 overflow-hidden flex-1" onclick="viewOtherProfile('${post.user_id}')">
                            <img src="${avatar}" class="w-5 h-5 rounded-full object-cover border border-gray-100">
                            <span class="text-[10px] text-gray-500 truncate font-semibold">${post.profiles?.display_name || '用戶'}</span>
                        </div>
                        <div class="flex items-center gap-1 cursor-pointer active:scale-125 transition" onclick="toggleLikeInGrid('${post.id}', this)">
                            <i class="${isLiked ? 'fa-solid text-sexify' : 'fa-regular text-gray-300'} fa-heart text-xs grid-heart"></i>
                            <span class="text-[10px] text-gray-400 font-bold grid-like-count">${post.like_count || 0}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error(e);
    }
}

window.handlePostClick = function(e, postId) {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        triggerBigHeart(e);
        const gridHeart = document.querySelector(`#grid-post-${postId} .grid-heart`);
        if (gridHeart && gridHeart.classList.contains('fa-regular')) {
            toggleLikeInGrid(postId, gridHeart.parentElement);
        }
    } else {
        clickTimer = setTimeout(() => {
            clickTimer = null;
            viewPostDetail(postId);
        }, 250);
    }
}

function triggerBigHeart(e) {
    const heart = document.createElement('i');
    heart.className = 'fa-solid fa-heart big-heart-anim';
    heart.style.left = `${e.clientX}px`;
    heart.style.top = `${e.clientY}px`;
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 800);
}

window.toggleLikeInGrid = async function(postId, container) {
    const myUserId = localStorage.getItem('userId');
    if (!myUserId) return alert("請先登入後再點讚！");
    
    const icon = container.querySelector('.grid-heart');
    const countEl = container.querySelector('.grid-like-count');
    const isLiked = icon.classList.contains('fa-solid');
    let currentCount = parseInt(countEl.innerText);

    // 立即反應 UI
    icon.classList.toggle('fa-solid', !isLiked);
    icon.classList.toggle('fa-regular', isLiked);
    icon.classList.toggle('text-sexify', !isLiked);
    icon.classList.toggle('text-gray-300', isLiked);
    countEl.innerText = isLiked ? currentCount - 1 : currentCount + 1;

    try {
        if (isLiked) {
            await window.supabaseClient.from('likes').delete().eq('post_id', postId).eq('user_id', myUserId);
            await window.supabaseClient.rpc('decrement_like', { post_id_val: postId });
        } else {
            await window.supabaseClient.from('likes').insert({ post_id: postId, user_id: myUserId });
            await window.supabaseClient.rpc('increment_like', { post_id_val: postId });
        }
    } catch (e) {
        // 若失敗則恢復 UI
        console.error("讚更新失敗");
    }
}

window.viewPostDetail = async function(postId) {
    const myUserId = localStorage.getItem('userId');
    const modal = document.getElementById('post-detail-modal');
    modal.classList.remove('hidden');
    
    try {
        const { data: post, error } = await window.supabaseClient
            .from('posts')
            .select('*, profiles(display_name, avatar_url, id)')
            .eq('id', postId)
            .single();
        
        if (error) throw error;

        window.currentViewedPostId = postId;
        window.currentViewedPostOwnerId = post.user_id;

        document.getElementById('detail-avatar').src = post.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=U';
        document.getElementById('detail-name').innerText = post.profiles?.display_name || '用戶';
        document.getElementById('detail-caption').innerText = post.caption || '';
        document.getElementById('detail-media').src = post.media_url || '';
        
        // 核心同步：確保詳情頁讚數與 Grid 同步
        const { count: likeCount } = await window.supabaseClient.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
        document.getElementById('detail-like-count').innerText = likeCount || 0;

        const { data: myLike } = await window.supabaseClient.from('likes').select('*').eq('post_id', postId).eq('user_id', myUserId).single();
        const likeBtnIcon = document.getElementById('detail-like-btn').querySelector('i');
        if (myLike) {
            likeBtnIcon.className = 'fa-solid fa-heart text-2xl text-sexify';
        } else {
            likeBtnIcon.className = 'fa-regular fa-heart text-2xl text-gray-400';
        }

        renderComments();
    } catch (e) {}
}

window.toggleLikeDetail = async function() {
    const myUserId = localStorage.getItem('userId');
    if (!myUserId) return alert("請先登入！");
    
    const btnIcon = document.getElementById('detail-like-btn').querySelector('i');
    const countEl = document.getElementById('detail-like-count');
    const isLiked = btnIcon.classList.contains('fa-solid');
    let currentCount = parseInt(countEl.innerText);

    // 1. 更新詳情頁 UI
    btnIcon.className = isLiked ? 'fa-regular fa-heart text-2xl text-gray-400' : 'fa-solid fa-heart text-2xl text-sexify';
    countEl.innerText = isLiked ? currentCount - 1 : currentCount + 1;

    // 2. 同步更新首頁 Grid UI (防止不同步)
    const gridPost = document.getElementById(`grid-post-${window.currentViewedPostId}`);
    if (gridPost) {
        const gridIcon = gridPost.querySelector('.grid-heart');
        const gridCount = gridPost.querySelector('.grid-like-count');
        gridIcon.classList.toggle('fa-solid', !isLiked);
        gridIcon.classList.toggle('fa-regular', isLiked);
        gridIcon.classList.toggle('text-sexify', !isLiked);
        gridIcon.classList.toggle('text-gray-300', isLiked);
        gridCount.innerText = countEl.innerText;
    }

    try {
        if (isLiked) {
            await window.supabaseClient.from('likes').delete().eq('post_id', window.currentViewedPostId).eq('user_id', myUserId);
            await window.supabaseClient.rpc('decrement_like', { post_id_val: window.currentViewedPostId });
        } else {
            await window.supabaseClient.from('likes').insert({ post_id: window.currentViewedPostId, user_id: myUserId });
            await window.supabaseClient.rpc('increment_like', { post_id_val: window.currentViewedPostId });
        }
    } catch (e) {}
}

window.renderComments = async function() {
    const list = document.getElementById('comment-list');
    const { data: comments } = await window.supabaseClient
        .from('comments')
        .select('*, profiles(display_name, avatar_url)')
        .eq('post_id', window.currentViewedPostId)
        .order('created_at', { ascending: true });

    if (!comments || comments.length === 0) {
        list.innerHTML = `<p class="text-center py-4 text-gray-400 text-xs">暫無留言</p>`;
        return;
    }

    list.innerHTML = comments.map(c => `
        <div class="flex gap-3 mb-4 animate-in fade-in duration-300">
            <img src="${c.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-8 h-8 rounded-full object-cover">
            <div class="flex-1">
                <p class="text-[10px] font-bold text-gray-900 mb-0.5">${c.profiles?.display_name || '用戶'}</p>
                <div class="bg-gray-50 rounded-2xl px-3 py-2 text-xs text-gray-700 leading-relaxed">${c.content}</div>
            </div>
        </div>
    `).join('');
}

window.sendComment = async function() {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    const myUserId = localStorage.getItem('userId');
    if (!content || !myUserId) return;

    try {
        const { error } = await window.supabaseClient.from('comments').insert({
            post_id: window.currentViewedPostId,
            user_id: myUserId,
            content: content
        });
        if (error) throw error;
        input.value = '';
        renderComments();
    } catch(e) { alert("留言失敗"); }
}

window.closePostDetail = () => document.getElementById('post-detail-modal').classList.add('hidden');
