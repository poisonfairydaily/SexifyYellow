// ==========================================
// js/discovery.js - 小紅書完美排版版
// ==========================================

let currentSortType = 'latest';

async function getAuthenticatedUserId() {
    if (!window.supabaseClient) return null;
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

window.switchDiscoveryTab = function(btn, sortType) {
    document.querySelectorAll('.discovery-tab-btn').forEach(b => {
        b.classList.remove('bg-black', 'text-white');
        b.classList.add('bg-gray-200', 'text-gray-600');
    });
    btn.classList.remove('bg-gray-200', 'text-gray-600');
    btn.classList.add('bg-black', 'text-white');
    currentSortType = sortType;
    renderDiscovery();
};

window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;

    grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-3xl"></i></div>`;

    try {
        const myId = await getAuthenticatedUserId();
        let query = window.supabaseClient
            .from('posts')
            .select('*, profiles(display_name, avatar_url, username)');

        if (filterKeyword.trim() !== '') {
            query = query.ilike('caption', `%${filterKeyword}%`);
        }

        if (currentSortType === 'hot') {
            query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        if (!posts || posts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-2 text-center py-20 mt-10 text-gray-400 flex flex-col items-center">
                    <i class="fa-solid fa-ghost text-4xl mb-4 opacity-30"></i>
                    <p class="font-bold">目前空空如也</p>
                </div>`;
            return;
        }

        let myLikes = new Set();
        if (myId) {
            const { data: likeData } = await window.supabaseClient.from('likes').select('post_id').eq('user_id', myId);
            if (likeData) likeData.forEach(l => myLikes.add(l.post_id));
        }

        grid.innerHTML = posts.map(post => {
            const safeName = window.escapeHTML(post.profiles?.display_name || '使用者');
            const safeCaption = window.escapeHTML(post.caption || '');
            const safeAvatar = window.escapeHTML(post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}`);
            const safeMedia = window.escapeHTML(post.media_url || '');

            const isLocked = post.is_paid;
            const blurClass = isLocked ? 'blur-md pointer-events-none' : '';
            const isLiked = myLikes.has(post.id);
            // ✨ 保證愛心一定會渲染的 Class 組合
            const heartClass = isLiked ? 'fa-solid fa-heart text-sexify' : 'fa-regular fa-heart text-gray-500';
            const currentLikes = post.likes_count || post.likes || 0;

            return `
            <div class="masonry-item break-inside-avoid relative shadow-sm border border-gray-100 bg-white rounded-xl mb-3 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform duration-200"
                 style="touch-action: pan-y;"
                 oncontextmenu="event.preventDefault();">

                <div class="relative bg-gray-50 min-h-[120px]"
                     onpointerdown="startLongPress(event, '${post.id}', ${safeMedia ? `'${safeMedia}'` : 'null'})"
                     onpointerup="cancelLongPress(event, '${post.id}')"
                     onpointerleave="cancelLongPress(event, '${post.id}')"
                     onpointercancel="cancelLongPress(event, '${post.id}')">
                     
                    ${safeMedia ? `<img src="${safeMedia}" class="w-full h-auto block object-cover ${blurClass} pointer-events-none" loading="lazy">` : `<div class="p-8 text-center text-gray-400 italic ${blurClass} pointer-events-none">純文字</div>`}
                    ${isLocked ? `<div class="absolute inset-0 bg-black/20 z-10 flex items-center justify-center flex-col backdrop-blur-[2px] pointer-events-none"><i class="fa-solid fa-lock text-white text-2xl mb-2 drop-shadow-md"></i><span class="bg-sexify text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">解鎖內容</span></div>` : ''}
                </div>

                <div class="p-3 bg-white" onclick="handleCardClick(event, '${post.id}')">
                    <p class="text-[13px] text-gray-900 line-clamp-2 leading-snug font-medium mb-2.5">${safeCaption}</p>
                    
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-1.5 flex-1 min-w-0 pr-2 hover:opacity-80 transition" onclick="event.stopPropagation(); if(typeof viewOtherProfile==='function') viewOtherProfile('${post.user_id}')">
                            <img src="${safeAvatar}" class="w-5 h-5 flex-shrink-0 rounded-full object-cover border border-gray-100 bg-gray-50">
                            <span class="text-gray-600 text-[11px] font-medium truncate">${safeName}</span>
                        </div>

                        <div class="flex items-center flex-shrink-0">
                            <button onclick="event.stopPropagation(); toggleLike(this, '${post.id}', '${post.user_id}')" class="flex items-center gap-1 group">
                                <i class="${heartClass} text-[14px] transition-transform group-active:scale-125"></i>
                                <span class="text-[12px] font-medium text-gray-600">${currentLikes}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        console.error("載入失敗:", error);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10 text-red-400 text-sm font-bold">載入失敗。</div>`;
    }
};

window.toggleLike = async function(btn, postId, postOwnerId) {
    if (btn.disabled) return;
    btn.disabled = true;

    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('span');
    let count = parseInt(countSpan.innerText.trim()) || 0;

    const myId = await getAuthenticatedUserId();
    if(!myId) {
        btn.disabled = false;
        return alert("請先登入");
    }

    const isLiking = icon.classList.contains('fa-regular');

    try {
        if (isLiking) {
            icon.classList.replace('fa-regular', 'fa-solid');
            icon.classList.remove('text-gray-500');
            icon.classList.add('text-sexify', 'scale-125');
            countSpan.innerText = count + 1;

            await window.supabaseClient.from('likes').insert({ post_id: postId, user_id: myId });
            await window.supabaseClient.from('posts').update({ likes_count: count + 1 }).eq('id', postId);
        } else {
            const newCount = Math.max(0, count - 1);
            icon.classList.replace('fa-solid', 'fa-regular');
            icon.classList.remove('text-sexify', 'scale-125');
            icon.classList.add('text-gray-500');
            countSpan.innerText = newCount;

            await window.supabaseClient.from('likes').delete().match({ post_id: postId, user_id: myId });
            await window.supabaseClient.from('posts').update({ likes_count: newCount }).eq('id', postId);
        }
    } catch(e) {
        console.error("按讚失敗", e);
    } finally {
        setTimeout(() => {
            icon.classList.remove('scale-125');
            btn.disabled = false;
        }, 300);
    }
}

window.currentViewedPostId = null;
window.currentViewedPostOwnerId = null;

window.handleCardClick = function(e, postId) {
    if (window.isLongPressActive) {
        window.isLongPressActive = false;
        e.preventDefault();
        return;
    }
    if (typeof viewPost === 'function') viewPost(postId);
};

// (底下如有 viewPost, renderComments 等詳情頁邏輯，請保留你原本的)
// =====================================
// 以下為詳情頁、留言等原生功能 (保持不變)
// =====================================
window.viewPost = async function(postId) {
    window.currentViewedPostId = postId;
    const modal = document.getElementById('post-detail-modal');
    if(!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    const contentDiv = document.getElementById('post-detail-content');
    contentDiv.innerHTML = `<div class="p-10 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;
    
    try {
        const myId = await getAuthenticatedUserId();
        const { data: post, error } = await window.supabaseClient
            .from('posts')
            .select('*, profiles(display_name, avatar_url, username)')
            .eq('id', postId)
            .single();
            
        if (error) throw error;
        
        window.currentViewedPostOwnerId = post.user_id;
        const authorName = window.escapeHTML(post.profiles?.display_name || '未知創作者');
        const authorAvatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}`;
        const blurClass = post.is_paid ? 'blur-md pointer-events-none' : '';

        const optionsMenu = document.getElementById('post-options-menu');
        if (optionsMenu) {
            if (post.user_id === myId) {
                optionsMenu.innerHTML = `
                    <button onclick="editPostContent('${post.id}')" class="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 border-b border-gray-50">編輯貼文</button>
                    <button onclick="deletePostFromModal('${post.id}')" class="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-gray-50">刪除貼文</button>
                `;
            } else {
                optionsMenu.innerHTML = `<button onclick="reportPost('${post.id}')" class="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-gray-50">檢舉貼文</button>`;
            }
        }

        let isLiked = false;
        if (myId) {
            const { data: ld } = await window.supabaseClient.from('likes').select('id').eq('post_id', postId).eq('user_id', myId).single();
            if (ld) isLiked = true;
        }
        const likeIcon = isLiked ? 'fa-solid text-sexify' : 'fa-regular text-gray-400';

        let bookmarks = JSON.parse(localStorage.getItem('myBookmarks')) || [];
        const isBookmarked = bookmarks.some(b => b.id === post.id);
        const bmIcon = isBookmarked ? 'fa-solid text-yellow-500' : 'fa-regular text-gray-300';
        
        const currentLikes = post.likes_count || post.likes || 0;
        const postObjStr = encodeURIComponent(JSON.stringify({ id: post.id, caption: post.caption, media_url: post.media_url, authorName, authorAvatar }));

        contentDiv.innerHTML = `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 cursor-pointer active:bg-gray-50 transition" onclick="closePostDetail(); if(typeof viewOtherProfile==='function') viewOtherProfile('${post.user_id}')">
                <img src="${authorAvatar}" class="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" onerror="this.src='https://ui-avatars.com/api/?name=User'">
                <div class="flex-1">
                    <div class="font-bold text-sm text-gray-900">${authorName}</div>
                    <div class="text-[10px] text-gray-400">${new Date(post.created_at).toLocaleString()}</div>
                </div>
                <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
            </div>
            
            ${post.media_url ? `<img src="${post.media_url}" class="w-full h-auto object-cover ${blurClass}">` : `<div class="p-10 text-center text-gray-400 italic bg-gray-50 ${blurClass}">純文字內容</div>`}
            
            <div class="p-4 border-b border-gray-50 flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <button class="text-xs hover:text-sexify transition flex items-center gap-1.5" onclick="toggleLike(this, '${post.id}', '${post.user_id}')">
                        <i class="${likeIcon} fa-heart text-xl"></i> <span class="font-bold text-gray-400">${currentLikes}</span>
                    </button>
                    <button class="text-xl hover:text-gray-600 transition" onclick="handleShare('${post.id}', '${window.escapeHTML(post.caption || '')}')">
                        <i class="fa-solid fa-share-nodes text-gray-400"></i>
                    </button>
                </div>
                <button class="text-xl hover:text-gray-600 transition" onclick="toggleBookmark(this, '${post.id}', '${postObjStr}')">
                    <i class="${bmIcon} fa-bookmark"></i>
                </button>
            </div>
            
            <div class="p-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed" id="detail-caption">${window.escapeHTML(post.caption || '')}</div>
        `;
        
        renderComments();
    } catch(e) {
        contentDiv.innerHTML = `<div class="p-10 text-center text-red-500">無法載入貼文內容</div>`;
    }
}

window.renderComments = async function() {
    const list = document.getElementById('post-comments-list');
    if(!list) return;
    list.innerHTML = `<div class="text-center py-5"><i class="fa-solid fa-spinner fa-spin text-gray-300"></i></div>`;
    
    try {
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('post_id', window.currentViewedPostId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        if (!comments || comments.length === 0) {
            list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前沒有留言</div>`;
            return;
        }

        const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
        let profilesMap = {};
        if (userIds.length > 0) {
            const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
            if (profs) profs.forEach(p => profilesMap[p.id] = p);
        }
        
        list.innerHTML = comments.map(c => {
            const user = profilesMap[c.user_id] || {};
            const safeCName = window.escapeHTML(user.display_name || '使用者');
            const safeContent = window.escapeHTML(c.content || '');
            return `
            <div class="flex gap-3 mb-4">
                <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-8 h-8 rounded-full shadow-sm object-cover border border-gray-100 flex-shrink-0">
                <div class="flex-1 bg-gray-50 border border-gray-100 p-3 rounded-2xl rounded-tl-sm shadow-sm">
                    <p class="text-[11px] font-bold text-sexify mb-1">${safeCName}</p>
                    <p class="text-sm text-gray-800">${safeContent}</p>
                    <p class="text-[9px] text-gray-400 mt-1.5">${new Date(c.created_at).toLocaleString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
            </div>`;
        }).join('');
        setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
    } catch(e) {
        list.innerHTML = `<div class="text-center py-5 text-red-400 text-xs">載入留言失敗。</div>`;
    }
}

window.submitComment = async function() {
    const input = document.getElementById('comment-input');
    const text = input?.value.trim();
    if(!text) return;
    
    const myId = await getAuthenticatedUserId();
    if(!myId) return alert("請先登入");

    input.value = '';
    
    try {
        await window.supabaseClient.from('comments').insert({ 
            post_id: window.currentViewedPostId, 
            user_id: myId, 
            content: text 
        });
        
        const { data: post } = await window.supabaseClient.from('posts').select('comments_count').eq('id', window.currentViewedPostId).single();
        if(post) {
            await window.supabaseClient.from('posts').update({ comments_count: (post.comments_count || 0) + 1 }).eq('id', window.currentViewedPostId);
        }

        if (window.currentViewedPostOwnerId && window.currentViewedPostOwnerId !== myId) {
            await window.supabaseClient.from('notifications').insert({ 
                user_id: window.currentViewedPostOwnerId, actor_id: myId, type: 'comment', post_id: window.currentViewedPostId 
            });
        }
        
        renderComments();
        if (typeof renderDiscovery === 'function') renderDiscovery();
    } catch(e) {
        alert("留言失敗");
    }
}

window.editPostContent = async function(postId) {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    
    const newText = prompt("請輸入新的貼文內容：");
    if (newText === null) return;
    try {
        const { error } = await window.supabaseClient.from('posts').update({ caption: newText }).eq('id', postId);
        if(error) throw error;
        const captionElem = document.getElementById('detail-caption');
        if(captionElem) captionElem.innerText = newText;
        if(typeof renderDiscovery === 'function') renderDiscovery();
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
        if(typeof renderDiscovery === 'function') renderDiscovery();
    } catch (err) { alert("刪除失敗"); }
}

window.reportPost = async function(postId = window.currentViewedPostId) {
    const menu = document.getElementById('post-options-menu');
    if(menu) menu.classList.add('hidden');
    
    const reason = prompt("請填寫檢舉原因 (例如: 色情、暴力、洗版)：");
    if (!reason) return;

    try {
        const myId = await getAuthenticatedUserId();
        if(!myId) return alert("請先登入");

        await window.supabaseClient.from('reports').insert({
            post_id: postId,
            reporter_id: myId,
            reason: reason
        });
        alert("已成功送出檢舉！管理員與系統將盡快審核。");
    } catch(e) {
        alert("送出失敗，請確認網路狀態。");
    }
}

window.closePostDetail = function() {
    const modal = document.getElementById('post-detail-modal');
    if(!modal) return;
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}
