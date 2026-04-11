// ==========================================
// js/profile.js - 完整進階資料庫版
// 包含性別、生日、社群連結的存取與 UI 渲染
// ==========================================

window.renderProfile = async function() {
    const container = document.getElementById('my-profile-container');
    const userId = localStorage.getItem('userId');

    if (!userId) {
        container.innerHTML = `<div class="p-10 text-center text-gray-400 mt-20">請先登入以查看個人頁面</div>`;
        return;
    }

    container.innerHTML = `<div class="p-10 text-center mt-20"><i class="fa-solid fa-spinner fa-spin text-sexify text-2xl"></i></div>`;

    try {
        const [profileRes, postsRes] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').eq('id', userId).single(),
            window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        if (profileRes.error) throw profileRes.error;
        
        const profile = profileRes.data;
        const myPosts = postsRes.data || [];
        const subsCount = getSubscriptions().length;
        const fansCount = getFans().length;

        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name || 'User'}&background=random`;
        const displayName = profile.display_name || '未命名用戶';
        const username = profile.username || `user_${userId.substring(0,8)}`;

        // 預填所有進階編輯表單
        document.getElementById('edit-display-name').value = displayName;
        document.getElementById('edit-username').value = profile.username || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('edit-gender').value = profile.gender || '';
        document.getElementById('edit-birthday').value = profile.birthday || '';
        document.getElementById('edit-contact-email').value = profile.contact_email || '';
        document.getElementById('edit-social-ig').value = profile.social_ig || '';
        document.getElementById('edit-social-x').value = profile.social_x || '';
        document.getElementById('edit-avatar-preview').src = avatarUrl;

        // 渲染 HTML
        let html = `
            <div class="bg-white pb-4 shadow-sm relative">
                <div class="w-full h-40 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>
                <div class="px-5 relative -mt-12">
                    <div class="flex justify-between items-end mb-3">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm">
                        <button onclick="openEditProfile()" class="bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-bold active:scale-95 transition shadow-sm mb-2">
                            編輯資料
                        </button>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900">${displayName}</h2>
                        <p class="text-xs text-sexify font-bold mt-0.5 mb-2">@${username}</p>
                        <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">${profile.bio || '這個人很懶，什麼都沒寫...'}</p>
                        
                        <div class="flex gap-2 mt-3">
                            ${profile.social_ig ? `<a href="https://instagram.com/${profile.social_ig}" target="_blank" class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 hover:text-pink-600 transition"><i class="fa-brands fa-instagram"></i></a>` : ''}
                            ${profile.social_x ? `<a href="https://twitter.com/${profile.social_x}" target="_blank" class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 hover:text-blue-500 transition"><i class="fa-brands fa-x-twitter"></i></a>` : ''}
                        </div>
                    </div>
                    
                    <div class="flex gap-8 mt-5 pt-4 border-t border-gray-100">
                        <div class="text-center cursor-pointer"><span class="block font-black text-gray-900 text-lg">${myPosts.length}</span><span class="text-[10px] text-gray-400 font-bold">貼文</span></div>
                        <div class="text-center cursor-pointer" onclick="openFansSubsModal()"><span class="block font-black text-gray-900 text-lg">${fansCount}</span><span class="text-[10px] text-gray-400 font-bold">粉絲</span></div>
                        <div class="text-center cursor-pointer" onclick="openFansSubsModal()"><span class="block font-black text-gray-900 text-lg">${subsCount}</span><span class="text-[10px] text-gray-400 font-bold">關注中</span></div>
                    </div>
                </div>
            </div>
        `;
        
        // 貼文瀑布流
        html += `<div class="bg-gray-50 pt-2 min-h-[300px]">`;
        if (myPosts.length === 0) {
            html += `
                <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
                    <div class="w-16 h-16 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center text-2xl mb-3"><i class="fa-solid fa-camera"></i></div>
                    <p class="text-gray-500 font-bold mb-1">尚無任何貼文</p>
                    <p class="text-xs text-gray-400">點擊底部中央的「+」開始分享生活吧！</p>
                </div>
            `;
        } else {
            html += `<div class="masonry-grid px-2">`;
            html += myPosts.map(post => `
                <div class="masonry-item relative shadow-sm border border-gray-100">
                    ${post.is_paid ? '<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md z-10"><i class="fa-solid fa-lock mr-1 text-sexify"></i>VIP</div>' : ''}
                    <img src="${post.media_url}" class="w-full h-auto object-cover rounded-t-xl" loading="lazy">
                    <div class="p-2 bg-white rounded-b-xl"><p class="text-[11px] text-gray-600 line-clamp-2">${post.caption || ''}</p></div>
                </div>
            `).join('');
            html += `</div>`;
        }
        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error("讀取失敗:", err);
        container.innerHTML = `<div class="p-10 text-center text-red-500 mt-20">讀取失敗，請確認網路或資料庫結構設定正確。</div>`;
    }
}

window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const userId = localStorage.getItem('userId');

    const updateData = {
        display_name: document.getElementById('edit-display-name').value.trim(),
        username: document.getElementById('edit-username').value.trim(),
        bio: document.getElementById('edit-bio').value.trim(),
        gender: document.getElementById('edit-gender').value,
        birthday: document.getElementById('edit-birthday').value,
        contact_email: document.getElementById('edit-contact-email').value.trim(),
        social_ig: document.getElementById('edit-social-ig').value.trim(),
        social_x: document.getElementById('edit-social-x').value.trim()
    };

    if (!updateData.display_name) return alert('顯示名稱不能為空！');

    btn.innerText = "處理中...";
    btn.disabled = true;

    try {
        const { error } = await window.supabaseClient.from('profiles').update(updateData).eq('id', userId);
        if (error) {
            if (error.code === '23505' && error.message.includes('username')) {
                throw new Error("這個用戶 ID 已經被別人使用了，請換一個！");
            }
            throw error;
        }
        
        localStorage.setItem('myChatName', updateData.display_name);
        closeEditProfile();
        renderProfile();

    } catch (err) {
        console.error("更新失敗:", err);
        alert(err.message || "更新失敗，請確保資料庫 profiles 表中已建立這些欄位。");
    } finally {
        btn.innerText = "儲存";
        btn.disabled = false;
    }
}

function getSubscriptions() { return JSON.parse(localStorage.getItem('mySubscriptions')) || []; }
function getFans() { return JSON.parse(localStorage.getItem('myFans')) || []; }

window.renderSubsList = function() {
    const container = document.getElementById('subs-list');
    if (!container) return;
    const subs = getSubscriptions();
    
    if (subs.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4 bg-white rounded-xl border border-gray-100">目前沒有追蹤任何人</p>`;
    } else {
        container.innerHTML = subs.map(sub => `
            <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm cursor-pointer border border-gray-50 active:bg-gray-50 transition" onclick="window.location.href='profile.html?userId=${sub.id}'">
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
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-4 bg-white rounded-xl border border-gray-100">目前還沒有粉絲，多發佈些內容吧！</p>`;
    } else {
        container.innerHTML = fans.map(fan => `
            <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-50">
                <img src="${fan.avatar}" class="w-10 h-10 rounded-full object-cover">
                <span class="font-bold text-sm text-gray-800 flex-1">${fan.name}</span>
            </div>
        `).join('');
    }
}
