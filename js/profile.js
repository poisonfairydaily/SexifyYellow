window.previewImage = function(input, imgId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 800;

                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const displayImg = document.getElementById(imgId);
                displayImg.src = canvas.toDataURL('image/jpeg', 0.7);
                displayImg.classList.remove('hidden');
            };
            img.src = event.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// ==========================================
// 1. 個人專頁與編輯資料
// ==========================================
window.renderProfile = async function() {
    const container = document.getElementById('my-profile-container');
    const userId = localStorage.getItem('userId');
    if (!userId) { container.innerHTML = `<div class="p-10 text-center text-gray-400 mt-20">請先登入</div>`; return; }

    container.innerHTML = `<div class="p-10 text-center mt-20"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const [profileRes, postsRes] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').eq('id', userId).single(),
            window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        if (profileRes.error) throw profileRes.error;
        
        const profile = profileRes.data;
        const myPosts = postsRes.data || [];
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name}&background=random`;
        const bannerUrl = profile.banner_url || '';

        document.getElementById('edit-display-name').value = profile.display_name || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('edit-avatar-preview').src = avatarUrl;
        
        if (bannerUrl) {
            document.getElementById('edit-banner-preview').src = bannerUrl;
            document.getElementById('edit-banner-preview').classList.remove('hidden');
        }

        const bannerHtml = bannerUrl ? `<img src="${bannerUrl}" class="w-full h-40 object-cover">` : `<div class="w-full h-40 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>`;

        let html = `
            <div class="bg-white pb-4 shadow-sm relative">
                ${bannerHtml}
                <div class="px-5 relative -mt-12">
                    <div class="flex justify-between items-end mb-3">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm">
                        <button onclick="openEditProfile()" class="bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-bold active:scale-95 transition shadow-sm mb-2">編輯資料</button>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900">${profile.display_name || '未命名'}</h2>
                        <p class="text-xs text-sexify font-bold mt-0.5 mb-2">@${profile.username || 'unknown'}</p>
                        <p class="text-sm text-gray-600 whitespace-pre-line">${profile.bio || '尚未填寫簡介'}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 pt-2 min-h-[300px]"><div class="masonry-grid px-2">`;
        
        if (myPosts.length > 0) {
            html += myPosts.map(p => `
                <div class="masonry-item relative shadow-sm border border-gray-100 bg-white p-2 rounded-xl" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字內容</div>`}
                    <p class="text-xs text-gray-800 line-clamp-2 leading-relaxed">${p.caption || ''}</p>
                </div>
            `).join('');
        } else {
            html += `<div class="col-span-2 text-center py-20 text-gray-400">尚無發佈貼文</div>`;
        }
        container.innerHTML = html + `</div></div>`;

    } catch (err) {
        container.innerHTML = `<div class="p-10 text-center text-red-500 mt-20">讀取失敗，請確認已在 Supabase 建立所有欄位。</div>`;
    }
}

window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const userId = localStorage.getItem('userId');
    btn.innerText = "處理中..."; btn.disabled = true;
    
    try {
        let avatarSrc = document.getElementById('edit-avatar-preview').src;
        let bannerSrc = document.getElementById('edit-banner-preview').src;

        const updateData = {
            display_name: document.getElementById('edit-display-name').value.trim(),
            bio: document.getElementById('edit-bio').value.trim(),
            avatar_url: avatarSrc,
            banner_url: bannerSrc.includes('http') || bannerSrc.startsWith('data:image') ? bannerSrc : null
        };

        const { error } = await window.supabaseClient.from('profiles').update(updateData).eq('id', userId);
        if (error) throw error;

        localStorage.setItem('myChatName', updateData.display_name);
        closeEditProfile();
        renderProfile();
    } catch (err) {
        alert("更新失敗：" + err.message);
    } finally {
        btn.innerText = "儲存"; btn.disabled = false;
    }
}

// ==========================================
// 2. 他人主頁 (新增 Banner 顯示與訂閱通知)
// ==========================================
window.viewOtherProfile = async function(userId) {
    if (userId === localStorage.getItem('userId')) return switchTab('profile-tab', document.querySelectorAll('.nav-btn')[3]);

    const modal = document.getElementById('other-profile-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        const { data: user, error } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;

        const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=random`;
        document.getElementById('other-header-name').innerText = user.display_name;
        document.getElementById('other-display-name').innerText = user.display_name;
        document.getElementById('other-username').innerText = `@${user.username}`;
        document.getElementById('other-bio').innerText = user.bio || '尚未寫下簡介。';
        document.getElementById('other-avatar').src = avatar;

        // 渲染 Banner
        const bannerImg = document.getElementById('other-banner');
        if (user.banner_url) {
            bannerImg.src = user.banner_url;
            bannerImg.classList.remove('hidden');
        } else {
            bannerImg.classList.add('hidden');
        }

        document.getElementById('other-msg-btn').onclick = () => {
            closeOtherProfile();
            if(typeof openChat === 'function') openChat(userId, false, user.display_name, avatar);
        };

        const followBtn = document.getElementById('other-follow-btn');
        const myUserId = localStorage.getItem('userId');
        
        // 檢查是否已從雲端訂閱
        const { data: subData } = await window.supabaseClient.from('subscriptions').select('id').eq('subscriber_id', myUserId).eq('creator_id', userId);
        const isSubbed = subData && subData.length > 0;

        if (isSubbed) {
            followBtn.innerText = "已追蹤";
            followBtn.classList.replace('bg-sexify', 'bg-gray-200');
            followBtn.classList.replace('text-white', 'text-gray-700');
        } else {
            followBtn.innerText = "追蹤";
            followBtn.classList.replace('bg-gray-200', 'bg-sexify');
            followBtn.classList.replace('text-gray-700', 'text-white');
            followBtn.onclick = async () => {
                followBtn.innerText = "處理中...";
                try {
                    await window.supabaseClient.from('subscriptions').insert({ subscriber_id: myUserId, creator_id: userId });
                    // 推送通知給創作者
                    await window.supabaseClient.from('notifications').insert({ user_id: userId, actor_id: myUserId, type: 'subscribe' });
                    
                    followBtn.innerText = "已追蹤";
                    followBtn.classList.replace('bg-sexify', 'bg-gray-200');
                    followBtn.classList.replace('text-white', 'text-gray-700');
                    followBtn.onclick = null; // 取消再次點擊
                } catch(e) {
                    followBtn.innerText = "追蹤失敗";
                }
            };
        }

        const { data: posts } = await window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        const grid = document.getElementById('other-posts-grid');
        if (!posts || posts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚無內容</div>`;
        } else {
            grid.innerHTML = posts.map(p => `
                <div class="masonry-item cursor-pointer bg-white p-2 border border-gray-100 rounded-xl" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字</div>`}
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("讀取他人主頁失敗", err);
    }
}

window.closeOtherProfile = function() {
    const modal = document.getElementById('other-profile-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

// ==========================================
// 3. 粉絲與訂閱用戶面板 (雲端資料庫版)
// ==========================================
window.openFansSubsModal = function() {
    toggleSettings(); 
    const modal = document.getElementById('fans-subs-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    switchFansTab('subs'); 
}

window.closeFansSubsModal = function() {
    const modal = document.getElementById('fans-subs-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

window.switchFansTab = async function(tab) {
    const btnFans = document.getElementById('tab-fans');
    const btnSubs = document.getElementById('tab-subs');
    const list = document.getElementById('fans-subs-list');
    const myUserId = localStorage.getItem('userId');

    list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-300"></i></div>`;

    if (tab === 'fans') {
        btnFans.classList.replace('text-gray-400', 'text-sexify');
        btnFans.classList.replace('border-transparent', 'border-sexify');
        btnSubs.classList.replace('text-sexify', 'text-gray-400');
        btnSubs.classList.replace('border-sexify', 'border-transparent');

        // 查詢粉絲：creator_id 是我的人 (關聯查出他們的 profile)
        const { data } = await window.supabaseClient.from('subscriptions').select('*, subscriber:subscriber_id(id, display_name, avatar_url)').eq('creator_id', myUserId);
        
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前還沒有粉絲</div>`;
        } else {
            list.innerHTML = data.map(sub => {
                const user = sub.subscriber;
                if(!user) return '';
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${user.display_name}</div>
                </div>`;
            }).join('');
        }
    } else {
        btnSubs.classList.replace('text-gray-400', 'text-sexify');
        btnSubs.classList.replace('border-transparent', 'border-sexify');
        btnFans.classList.replace('text-sexify', 'text-gray-400');
        btnFans.classList.replace('border-sexify', 'border-transparent');

        // 查詢訂閱：subscriber_id 是我的人
        const { data } = await window.supabaseClient.from('subscriptions').select('*, creator:creator_id(id, display_name, avatar_url)').eq('subscriber_id', myUserId);

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">尚未訂閱任何用戶</div>`;
        } else {
            list.innerHTML = data.map(sub => {
                const user = sub.creator;
                if(!user) return '';
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${user.display_name}</div>
                    <button onclick="event.stopPropagation(); unfollowUserFromList('${sub.id}', this)" class="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-bold active:scale-90 transition">取消追蹤</button>
                </div>`;
            }).join('');
        }
    }
}

window.unfollowUserFromList = async function(subscriptionId, btn) {
    if (!confirm("確定要取消追蹤嗎？")) return;
    try {
        await window.supabaseClient.from('subscriptions').delete().eq('id', subscriptionId);
        btn.parentElement.classList.add('opacity-0', 'scale-95');
        setTimeout(() => btn.parentElement.remove(), 200);
    } catch(e) {
        alert("取消失敗");
    }
}
