// --- 1. 個人主頁渲染 (新增讀取進階設定) ---
window.renderProfile = async function() {
    const container = document.getElementById('my-profile-container');
    const userId = localStorage.getItem('userId');

    if (!userId) {
        container.innerHTML = `<div class="p-10 text-center text-gray-400">請先登入以查看個人頁面</div>`;
        return;
    }

    container.innerHTML = `<div class="p-10 text-center"><i class="fa-solid fa-spinner fa-spin text-sexify text-2xl"></i></div>`;

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
        const username = profile.username || `user_${userId.substring(0,6)}`;

        // 🔥 預填所有進階編輯表單
        document.getElementById('edit-display-name').value = displayName;
        document.getElementById('edit-username').value = profile.username || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('edit-gender').value = profile.gender || '';
        document.getElementById('edit-birthday').value = profile.birthday || '';
        document.getElementById('edit-contact-email').value = profile.contact_email || '';
        document.getElementById('edit-social-ig').value = profile.social_ig || '';
        document.getElementById('edit-social-x').value = profile.social_x || '';
        document.getElementById('edit-avatar-preview').src = avatarUrl;

        // 渲染 HTML (保持你原本的 HTML 結構，此處簡略，確保資料有帶入即可)
        let html = `
            <div class="bg-white">
                <div class="w-full h-32 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>
                <div class="px-5 pb-5 relative -mt-10">
                    <div class="flex justify-between items-end mb-3">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm">
                        <button onclick="openEditProfile()" class="bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-bold active:scale-95 transition shadow-sm">
                            編輯資料
                        </button>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900">${displayName}</h2>
                        <p class="text-xs text-sexify font-bold mt-0.5 mb-1">@${username}</p>
                        <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">${profile.bio || '這個人很懶，什麼都沒寫...'}</p>
                        
                        <div class="flex gap-2 mt-2">
                            ${profile.social_ig ? `<a href="https://instagram.com/${profile.social_ig}" target="_blank" class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"><i class="fa-brands fa-instagram"></i></a>` : ''}
                            ${profile.social_x ? `<a href="https://twitter.com/${profile.social_x}" target="_blank" class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"><i class="fa-brands fa-x-twitter"></i></a>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-6 mt-4 pt-4 border-t border-gray-100">
                        <div class="text-center"><span class="block font-black text-gray-900">${myPosts.length}</span><span class="text-[10px] text-gray-400">貼文</span></div>
                        <div class="text-center cursor-pointer" onclick="openFansSubsModal()"><span class="block font-black text-gray-900">${fansCount}</span><span class="text-[10px] text-gray-400">粉絲</span></div>
                        <div class="text-center cursor-pointer" onclick="openFansSubsModal()"><span class="block font-black text-gray-900">${subsCount}</span><span class="text-[10px] text-gray-400">關注中</span></div>
                    </div>
                </div>
            </div>
            `;
        
        // 貼文瀑布流
        html += `<div class="bg-gray-50 pt-2 min-h-[300px]">`;
        if (myPosts.length === 0) {
            html += `<div class="text-center py-16 text-gray-400 text-sm">尚無任何貼文</div>`;
        } else {
            html += `<div class="masonry-grid px-2">`;
            html += myPosts.map(post => `
                <div class="masonry-item relative shadow-sm border border-gray-100">
                    <img src="${post.media_url}" class="w-full h-auto object-cover rounded-t-xl">
                    <div class="p-2 bg-white rounded-b-xl"><p class="text-[11px] text-gray-600 line-clamp-2">${post.caption || ''}</p></div>
                </div>
            `).join('');
            html += `</div>`;
        }
        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error("讀取失敗:", err);
    }
}

// --- 2. 儲存進階個人資料 ---
window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const userId = localStorage.getItem('userId');

    // 收集所有欄位資料
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
                throw new Error("這個用戶 ID (Username) 已經被別人使用了，請換一個！");
            }
            throw error;
        }
        
        localStorage.setItem('myChatName', updateData.display_name);
        closeEditProfile();
        renderProfile(); // 重新整理畫面

    } catch (err) {
        console.error("更新失敗:", err);
        alert(err.message || "更新失敗，請確保資料庫有對應的欄位。");
    } finally {
        btn.innerText = "儲存";
        btn.disabled = false;
    }
}
