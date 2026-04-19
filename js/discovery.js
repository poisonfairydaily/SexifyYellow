// ==========================================
// js/discovery.js - 完整修復全替換版 (解決貼文點擊無法開啟問題)
// ==========================================

window.currentSortType = 'latest';
window.currentViewedPostId = null;

// 取得當前使用者ID
async function getAuthenticatedUserId() {
    if (!window.supabaseClient) return null;
    try {
        const { data: { user }, error } = await window.supabaseClient.auth.getUser();
        if (error || !user) return null;
        return user.id;
    } catch (e) {
        return null;
    }
}

// 防止 XSS 攻擊的字串過濾
function safeEscape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

// 切換頂部分頁 (最新 / 熱門)
window.switchDiscoveryTab = function(btn, sortType) {
    document.querySelectorAll('.discovery-tab-btn').forEach(b => {
        b.classList.remove('bg-black', 'text-white');
        b.classList.add('bg-gray-200', 'text-gray-600');
    });
    if (btn) {
        btn.classList.remove('bg-gray-200', 'text-gray-600');
        btn.classList.add('bg-black', 'text-white');
    }
    window.currentSortType = sortType;
    window.renderDiscovery();
};

// 渲染瀑布流貼文
window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;

    // 載入中的 Loading 狀態
    grid.innerHTML = `<div class="col-span-2 flex justify-center py-20 mt-10"><i class="fa-solid fa-circle-notch fa-spin text-gray-300 text-3xl"></i></div>`;

    try {
        const myId = await getAuthenticatedUserId();
        let query = window.supabaseClient
            .from('posts')
            .select('*, profiles(display_name, avatar_url, username)');

        // 關鍵字搜尋過濾
        if (filterKeyword.trim() !== '') {
            query = query.ilike('caption', `%${filterKeyword}%`);
        }

        // 排序邏輯
        if (window.currentSortType === 'popular') {
            query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data: posts, error } = await query.limit(50);

        if (error) throw error;

        // 空狀態顯示
        if (!posts || posts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 text-sm font-bold"><i class="fa-solid fa-box-open text-3xl mb-2 block opacity-50"></i>目前沒有相關內容</div>`;
            return;
        }

        // 動態生成 HTML 結構
        grid.innerHTML = posts.map(post => {
            const profile = post.profiles || {};
            const avatar = profile.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(profile.display_name || 'U');
            const name = safeEscape(profile.display_name || '未命名');
            const caption = safeEscape(post.caption || '');
            let mediaUrl = post.media_url || 'https://placehold.co/400x400/eeeeee/999999?text=No+Image';
            
            // 處理多圖與單圖，瀑布流預覽只取第一張
            let displayImageUrl = mediaUrl;
            if (mediaUrl.includes(',')) {
                displayImageUrl = mediaUrl.split(',')[0];
            }
            
            // 處理 Cloudflare R2 CORS 修復
            if (displayImageUrl.includes('r2.dev')) {
                const fileName = displayImageUrl.split('/').pop();
                displayImageUrl = `https://sexify-uploader.poisonfairydaily.workers.dev/media/${fileName}`;
            }

            const isPaid = post.is_paid ? `<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-sm shadow-md flex items-center gap-1"><i class="fa-solid fa-lock text-[8px]"></i>付費</div>` : '';

            // ✨ 核心修復：使用 window.openPostDetail 確保全域呼叫，並正確傳遞字串 ID
            return `
            <div class="masonry-item relative shadow-sm border border-gray-100 bg-white rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform duration-200" onclick="window.openPostDetail('${post.id}')">
                <div class="relative w-full bg-gray-50 aspect-auto">
                    <img src="${displayImageUrl}" class="w-full object-cover block" loading="lazy" onerror="this.src='https://placehold.co/400x400/eeeeee/999999?text=Error'">
                    ${isPaid}
                </div>
                <div class="p-3">
                    <p class="text-xs font-bold text-gray-800 line-clamp-2 leading-relaxed break-words mb-2">${caption}</p>
                    <div class="flex items-center justify-between mt-1">
                        <div class="flex items-center gap-1.5 overflow-hidden">
                            <img src="${avatar}" class="w-4 h-4 rounded-full object-cover flex-shrink-0" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                            <span class="text-[10px] text-gray-500 truncate font-medium">${name}</span>
                        </div>
                        <div class="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                            <i class="fa-regular fa-heart"></i> ${post.likes_count || 0}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error("渲染瀑布流失敗:", e);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-400 font-bold text-sm">載入失敗，請稍後再試</div>`;
    }
};

// ==========================================
// 貼文詳情 Modal 控制與邏輯
// ==========================================

window.openPostDetail = async function(postId) {
    if (!postId) return;
    window.currentViewedPostId = postId;
    
    // 增加相容性：支援不同的常見 ID 命名
    const modal = document.getElementById('post-detail-modal') || document.getElementById('post-modal');
    if (!modal) {
        console.error("❌ 找不到貼文詳情的 Modal，請確認 index.html 存在 id='post-detail-modal' 的元素");
        return;
    }

    // 打開 Modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // 針對動畫層進行處理 (若存在)
    const panel = modal.querySelector('.transform') || modal.children[0];
    if (panel) {
        panel.classList.remove('translate-y-full', 'scale-95', 'opacity-0');
    }

    try {
        const myId = await getAuthenticatedUserId();
        
        // 取得單筆貼文資料
        const { data: post, error } = await window.supabaseClient
            .from('posts')
            .select('*, profiles(id, display_name, avatar_url, username)')
            .eq('id', postId)
            .single();

        if (error) throw error;

        // 1. 寫入圖片
        const imgEl = document.getElementById('detail-image') || document.getElementById('post-detail-image') || modal.querySelector('img');
        if (imgEl) {
            let displayImageUrl = post.media_url || '';
            if (displayImageUrl.includes(',')) displayImageUrl = displayImageUrl.split(',')[0]; // 單純詳情暫時顯示首圖
            if (displayImageUrl.includes('r2.dev')) {
                const fileName = displayImageUrl.split('/').pop();
                displayImageUrl = `https://sexify-uploader.poisonfairydaily.workers.dev/media/${fileName}`;
            }
            imgEl.src = displayImageUrl;
        }

        // 2. 寫入作者頭像與名稱
        const avatarEl = document.getElementById('detail-avatar') || document.getElementById('post-detail-avatar');
        if (avatarEl) {
            avatarEl.src = post.profiles?.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(post.profiles?.display_name || 'U');
        }
        
        const nameEl = document.getElementById('detail-name') || document.getElementById('post-detail-name');
        if (nameEl) nameEl.innerText = post.profiles?.display_name || '未命名';

        // 3. 寫入內文 (支援換行)
        const captionEl = document.getElementById('detail-caption') || document.getElementById('post-detail-caption');
        if (captionEl) captionEl.innerHTML = safeEscape(post.caption || '').replace(/\n/g, '<br>');

        // 4. 判斷是否為自己的貼文，顯示右上角的「...」編輯選項按鈕
        const optionsBtn = document.getElementById('post-options-btn') || document.getElementById('detail-options-btn');
        if (optionsBtn) {
            if (myId && post.user_id === myId) {
                optionsBtn.classList.remove('hidden');
            } else {
                optionsBtn.classList.add('hidden');
            }
        }

        // 5. 如果有留言功能，嘗試觸發
        if (typeof window.loadComments === 'function') {
            window.loadComments(postId);
        }

    } catch (e) {
        console.error("載入貼文詳情失敗:", e);
        alert("載入貼文失敗，該貼文可能已被移除。");
        window.closePostDetail();
    }
};

window.closePostDetail = function() {
    const modal = document.getElementById('post-detail-modal') || document.getElementById('post-modal');
    if (modal) {
        const panel = modal.querySelector('.transform') || modal.children[0];
        if (panel) {
            panel.classList.add('translate-y-full', 'scale-95', 'opacity-0');
        }
        
        // 延遲隱藏以配合 CSS 動畫
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            window.currentViewedPostId = null;
            
            // 清理上一張圖片殘留，避免下次點擊出現舊圖閃爍
            const imgEl = document.getElementById('detail-image') || document.getElementById('post-detail-image') || modal.querySelector('img');
            if (imgEl) imgEl.src = '';
        }, 300);
    }
};

// ==========================================
// 貼文管理功能 (選項、編輯、刪除、檢舉)
// ==========================================

window.togglePostOptions = function(show) {
    const menu = document.getElementById('post-options-menu');
    if (!menu) return;
    if (show) {
        menu.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
    }
};

window.editPostFromModal = async function() {
    const postId = window.currentViewedPostId;
    if (!postId) return;
    
    window.togglePostOptions(false); // 收起選單
    
    const newText = prompt("請輸入新的貼文內容：");
    if (newText === null || newText.trim() === '') return;

    try {
        const { error } = await window.supabaseClient
            .from('posts')
            .update({ caption: newText })
            .eq('id', postId);
            
        if (error) throw error;
        
        // 即時更新當前彈窗的畫面
        const captionEl = document.getElementById('detail-caption') || document.getElementById('post-detail-caption');
        if (captionEl) captionEl.innerHTML = safeEscape(newText).replace(/\n/g, '<br>');
        
        alert("編輯成功！");
        window.renderDiscovery(); // 背景重刷瀑布流
    } catch (err) {
        console.error(err);
        alert("編輯失敗: " + err.message);
    }
};

window.deletePostFromModal = async function(postId = window.currentViewedPostId) {
    if (!postId) return;
    
    window.togglePostOptions(false); // 收起選單
    
    if (!confirm("確定要刪除這則貼文嗎？刪除後無法復原。")) return;
    
    try {
        const { error } = await window.supabaseClient.from('posts').delete().eq('id', postId);
        if (error) throw error;
        
        alert("貼文已刪除");
        window.closePostDetail();
        window.renderDiscovery(); // 重刷瀑布流
    } catch (err) {
        console.error(err);
        alert("刪除失敗: " + err.message);
    }
};

window.reportPost = async function(postId = window.currentViewedPostId) {
    if (!postId) return;
    
    window.togglePostOptions(false); // 收起選單
    
    const reason = prompt("請填寫檢舉原因 (例如: 色情、暴力、洗版、侵權)：");
    if (!reason || reason.trim() === '') return;

    try {
        const myId = await getAuthenticatedUserId();
        if (!myId) return alert("請先登入會員才能使用檢舉功能！");

        const { error } = await window.supabaseClient.from('reports').insert({
            post_id: postId,
            reporter_id: myId,
            reason: reason.trim()
        });
        
        if (error) throw error;
        
        alert("✅ 已成功送出檢舉！管理員與系統將盡快審核。");
    } catch(e) {
        console.error(e);
        alert("送出檢舉失敗，請確認網路狀態。");
    }
};

// ==========================================
// 頁面初始化載入
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 若頁面有獨立搜尋框，綁定 Enter 鍵觸發搜尋
    const searchInput = document.getElementById('discovery-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.renderDiscovery(e.target.value);
            }
        });
    }

    // 初始載入瀑布流
    if (document.getElementById('discovery-grid')) {
        window.renderDiscovery();
    }
});
