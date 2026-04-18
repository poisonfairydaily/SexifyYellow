// ==========================================
// js/discovery.js - 按讚邏輯與 UI 渲染修復版
// ==========================================

window.toggleLike = async function(postId, currentCount, isLiked) {
    try {
        const myId = await getAuthenticatedUserId();
        if (!myId) return alert('請先登入');

        // 1. 計算新的按讚數
        const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

        // 2. 同步更新資料庫 - posts 表的計數
        const { error: postErr } = await window.supabaseClient
            .from('posts')
            .update({ likes_count: newCount })
            .eq('id', postId);

        if (postErr) throw new Error("無法更新貼文按讚數: " + postErr.message);

        // 3. 更新 likes 紀錄表
        if (isLiked) {
            await window.supabaseClient.from('likes').delete().eq('post_id', postId).eq('user_id', myId);
        } else {
            await window.supabaseClient.from('likes').insert({ post_id: postId, user_id: myId });
            // 選擇性：發送通知
            await window.supabaseClient.from('notifications').insert({ user_id: postId, actor_id: myId, type: 'like' }).maybeSingle();
        }

        // 4. 重新渲染當前視圖 (或者手動更新 DOM 以提升效能)
        if (typeof renderDiscovery === 'function') renderDiscovery();
        
    } catch (err) {
        console.error("Like Error:", err);
        alert("操作失敗，請檢查網路或資料庫設定");
    }
};

// 建議在 renderDiscovery 渲染時，確保傳入正確的 likes_count
// HTML 模板中的點擊事件應修改為：
// onclick="toggleLike('${p.id}', ${p.likes_count || 0}, ${isLiked})"
