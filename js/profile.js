// ==========================================
// js/profile.js - 完整版 (包含取消追蹤清單同步)
// ==========================================

async function getAuthenticatedUserId() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user ? user.id : null;
}

window.loadFansSubs = async function(type) {
    const title = document.getElementById('fans-subs-title');
    const list = document.getElementById('fans-subs-list');
    const myId = await getAuthenticatedUserId();

    if (!list || !myId) return;

    list.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-2xl"></i></div>';
    title.innerText = type === 'following' ? '我的關注' : '我的粉絲';

    try {
        let data, error;
        if (type === 'following') {
            ({ data, error } = await window.supabaseClient
                .from('follows')
                .select('id, following_id, profiles!follows_following_id_fkey(*)')
                .eq('follower_id', myId));
        } else {
            ({ data, error } = await window.supabaseClient
                .from('follows')
                .select('id, follower_id, profiles!follows_follower_id_fkey(*)')
                .eq('following_id', myId));
        }

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前空空如也</div>`;
            return;
        }

        list.innerHTML = data.map(item => {
            const user = type === 'following' ? item.profiles : item.profiles;
            if (!user) return '';
            const safeName = window.escapeHTML(user.display_name || user.username || '匿名');
            const safeAvatar = user.avatar_url || `https://ui-avatars.com/api/?name=${safeName}`;
            
            return `
            <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 mb-2">
                <img src="${safeAvatar}" class="w-10 h-10 rounded-full object-cover cursor-pointer" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                <div class="flex-1 font-bold text-gray-800 text-sm truncate">${safeName}</div>
                ${type === 'following' ? 
                    `<button onclick="unfollowUserFromList('${user.id}', this)" class="bg-gray-100 text-gray-500 text-[10px] px-3 py-1.5 rounded-full font-bold active:scale-90 transition">取消追蹤</button>` 
                    : ''}
            </div>`;
        }).join('');
    } catch (e) {
        list.innerHTML = '<div class="text-center py-10 text-red-400">讀取失敗</div>';
    }
}

// ------------------------------------------
// 核心：清單中直接取消追蹤
// ------------------------------------------
window.unfollowUserFromList = async function(targetUid, btn) {
    if (!confirm("確定要取消追蹤嗎？")) return;
    const myId = await getAuthenticatedUserId();
    
    btn.disabled = true;
    btn.innerText = "處理中...";

    try {
        const { error } = await window.supabaseClient
            .from('follows')
            .delete()
            .eq('follower_id', myId)
            .eq('following_id', targetUid);

        if (error) throw error;
        btn.parentElement.remove(); // 直接從 UI 移除
    } catch (e) {
        alert("取消失敗");
        btn.disabled = false;
        btn.innerText = "取消追蹤";
    }
}

// 其餘 Profile 邏輯 (上傳、編輯) 保持完整...
window.openFansSubsModal = function(type) {
    document.getElementById('fans-subs-modal').classList.remove('hidden');
    loadFansSubs(type);
}
window.closeFansSubsModal = function() {
    document.getElementById('fans-subs-modal').classList.add('hidden');
}
