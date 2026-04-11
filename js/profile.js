// ==========================================
// js/profile.js - 真實資料庫版
// 負責：個人主頁渲染、編輯資料、訂閱/粉絲列表
// ==========================================

// --- 1. 個人主頁渲染 ---
window.renderProfile = async function() {
    const container = document.getElementById('my-profile-container');
    const userId = localStorage.getItem('userId');

    if (!userId) {
        container.innerHTML = `<div class="p-10 text-center text-gray-400">請先登入以查看個人頁面</div>`;
        return;
    }

    container.innerHTML = `<div class="p-10 text-center"><i class="fa-solid fa-spinner fa-spin text-sexify text-2xl"></i></div>`;

    try {
        // 並行抓取：個人資料 + 我的貼文
        const [profileRes, postsRes] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').eq('id', userId).single(),
            window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        if (profileRes.error) throw profileRes.error;
        
        const profile = profileRes.data;
        const myPosts = postsRes.data || [];
        
        // 取得本地儲存的訂閱與粉絲數量 (由訂閱邏輯維護)
        const subsCount = getSubscriptions().length;
        const fansCount = getFans().length;

        // 設定預設值防呆
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name || 'User'}&background=random`;
        const displayName = profile.display_name || '未命名用戶';
        const username = profile.username || `user_${userId.substring(0,6)}`;
        const bio = profile.bio || '這個人很懶，什麼都沒寫...';

        // 預填編輯表單
        document.getElementById('edit-display-name').value = displayName;
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('edit-avatar-preview').src = avatarUrl;

        // 渲染 HTML
        let html = `
            <div class="bg-white">
                <div class="w-full h-32 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>
                
                <div class="px-5 pb-5 relative -mt-10">
                    <div class="flex justify-between items-end mb-3">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm">
                        <button onclick="openEditProfile()" class="bg-gray-100 text-gray-800 px-5 py-2 rounded-full text-xs font-bold active:scale-95 transition">
                            <i class="fa-solid fa-pen mr-1"></i> 編輯資料
                        </button>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900">${displayName}</h2>
                        <p class="text-xs text-gray-400 font-mono mt-0.5 mb-3">ID: @${username}</p>
                        <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">${bio}</p>
                    </div>
                    
                    <div class="flex gap-6 mt-4 pt-4 border-t border-gray-100">
                        <div class="text-center cursor-pointer"><span class="block font-black text-gray-900">${myPosts.length}</span><span class="text-[10px] text-gray-400">貼文</span></div>
                        <div class="text-center cursor-pointer" onclick="openFansSubsModal()"><span class="block font-black text-gray-900">${fansCount}</span><span class="text-[10px] text-gray-400">粉絲</span></div>
                        <div class="text-center cursor-pointer" onclick="openFansSubsModal()"><span class="block font-black text-gray-900">${subsCount}</span><span class="text-[10px] text-gray-400">追蹤中</span></div>
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 pt-2 min-h-[300px]">
                <div class="px-4 py-2"><h3 class="font-bold text-gray-700 text-sm">我的發佈</h3></div>
        `;

        if (myPosts.length === 0) {
            html += `
                <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div class="w-16 h-16 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center text-2xl mb-3"><i class="fa-solid fa-camera"></i></div>
                    <p class="text-gray-500 font-bold mb-1">尚無任何貼文</p>
                    <p class="text-xs text-gray-400">點擊底部導航的「+」開始分享你的生活吧！</p>
                </div>
            `;
        } else {
            html += `<div class="masonry-grid px-2">`;
            html += myPosts.map(post => `
                <div class="masonry-item relative shadow-sm border border-gray-100">
                    ${post.is_paid ? '<div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-md z-10"><i class="fa-solid fa-lock mr-1"></i></div>' : ''}
                    <img src="${post.media_url}" class="w-full h-auto object-cover rounded-t-xl" loading="lazy">
                    <div class="p-2 bg-white rounded-b-xl">
                        <p class="text-[11px] text-gray-600 line-clamp-2">${post.caption || ''}</p>
                    </div>
                </div>
            `).join('');
            html += `</div>`;
        }
        
        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error("讀取個人資料失敗:", err);
        container.innerHTML = `<div class="p-10 text-center text-red-500">無法載入資料，請檢查網路連線</div>`;
    }
}

// --- 2. 編輯並儲存個人資料 ---
window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const newName = document.getElementById('edit-display-name').value.trim();
    const newBio = document.getElementById('edit-bio').value.trim();
    const userId = localStorage.getItem('userId');

    if (!newName) return alert('顯示名稱不能為空！');

    btn.innerText = "儲存中...";
    btn.disabled = true;

    try {
        const { error } = await window.supabaseClient
            .from('profiles')
            .update({ display_name: newName, bio: newBio })
            .eq('id', userId);

        if (error) throw error;
        
        // 更新本地端的名字紀錄
        localStorage.setItem('myChatName', newName);

        closeEditProfile();
        renderProfile(); // 重新渲染畫面

    } catch (err) {
        console.error("更新失敗:", err);
        alert("更新失敗，請稍後再試。");
    } finally {
        btn.innerText = "儲存";
        btn.disabled = false;
    }
}

// --- 3. 訂閱與粉絲系統 (本地陣列管理) ---
// 為了不依賴過於複雜的關聯表，我們使用 localStorage 搭配 Supabase 的 auth metadata 來儲存訂閱清單
function getSubscriptions() { return JSON.parse(localStorage.getItem('mySubscriptions')) || []; }
function getFans() { return JSON.parse(localStorage.getItem('myFans')) || []; }

window.addSubscription = function(targetId, targetName, targetAvatar) {
    let subs = getSubscriptions();
    if (!subs.find(s => s.id === targetId)) {
        subs.push({ id: targetId, name: targetName, avatar: targetAvatar });
        localStorage.setItem('mySubscriptions', JSON.stringify(subs));
        alert(`🎉 成功訂閱 ${targetName}！`);
    }
}

window.renderSubsList = function() {
    const container = document.getElementById('subs-list');
    if (!container) return;
    
    const subs = getSubscriptions();
    
    if (subs.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">目前沒有訂閱任何人</p>`;
    } else {
        container.innerHTML = subs.map(sub => `
            <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm cursor-pointer border border-gray-50 active:bg-gray-50 mb-2" onclick="window.location.href='profile.html?userId=${sub.id}'">
                <img src="${sub.avatar}" class="w-10 h-10 rounded-full object-cover">
                <span class="font-bold text-sm text-gray-800 flex-1">${sub.name}</span>
                <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
            </div>
        `).join('');
    }
}

window.renderFansList = function() {
    const container = document.getElementById('fans-list');
    if (!container) return;
    
    const fans = getFans();
    
    if (fans.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">目前還沒有粉絲，多發佈些內容吧！</p>`;
    } else {
        container.innerHTML = fans.map(fan => `
            <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-50 mb-2">
                <img src="${fan.avatar}" class="w-10 h-10 rounded-full object-cover">
                <span class="font-bold text-sm text-gray-800 flex-1">${fan.name}</span>
            </div>
        `).join('');
    }
}
