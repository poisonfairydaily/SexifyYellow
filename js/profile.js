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

        // 預填編輯表單
        document.getElementById('edit-display-name').value = profile.display_name || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('edit-gender').value = profile.gender || 'Unspecified';
        document.getElementById('edit-social-ig').value = profile.social_ig || '';
        document.getElementById('edit-social-x').value = profile.social_x || '';
        document.getElementById('edit-avatar-preview').src = avatarUrl;

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
                        <h2 class="text-xl font-black text-gray-900">${profile.display_name || '未命名'}</h2>
                        <p class="text-xs text-sexify font-bold mt-0.5 mb-2">@${profile.username || 'unknown'}</p>
                        <p class="text-sm text-gray-600 whitespace-pre-line">${profile.bio || '尚未填寫簡介'}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 pt-2 min-h-[300px]"><div class="masonry-grid px-2">`;
        
        if (myPosts.length > 0) {
            html += myPosts.map(p => `<div class="masonry-item"><img src="${p.media_url}" class="w-full rounded-xl"></div>`).join('');
        } else {
            html += `<div class="col-span-2 text-center py-20 text-gray-400">尚無發佈貼文</div>`;
        }
        container.innerHTML = html + `</div></div>`;

    } catch (err) {
        container.innerHTML = `<div class="p-10 text-center text-red-500 mt-20">讀取失敗。提示：若修改過結構，請嘗試登出並重新註冊。</div>`;
    }
}

window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const userId = localStorage.getItem('userId');
    const updateData = {
        display_name: document.getElementById('edit-display-name').value.trim(),
        bio: document.getElementById('edit-bio').value.trim(),
        gender: document.getElementById('edit-gender').value,
        social_ig: document.getElementById('edit-social-ig').value.trim(),
        social_x: document.getElementById('edit-social-x').value.trim()
    };
    btn.innerText = "處理中..."; btn.disabled = true;

    try {
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

// 🎯 他人主頁控制與追蹤/訊息按鈕邏輯
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
        document.getElementById('other-bio').innerText = user.bio || '這名創作者很神秘，尚未寫下簡介。';
        document.getElementById('other-avatar').src = avatar;

        // 綁定「發訊息」按鈕
        document.getElementById('other-msg-btn').onclick = () => {
            closeOtherProfile();
            if(typeof openChat === 'function') openChat(userId, false, user.display_name, avatar);
        };

        // 綁定「追蹤」按鈕
        const followBtn = document.getElementById('other-follow-btn');
        let subs = JSON.parse(localStorage.getItem('mySubscriptions')) || [];
        if (subs.find(s => s.id === userId)) {
            followBtn.innerText = "已追蹤";
            followBtn.classList.replace('bg-sexify', 'bg-gray-200');
            followBtn.classList.replace('text-white', 'text-gray-700');
        } else {
            followBtn.innerText = "追蹤";
            followBtn.classList.replace('bg-gray-200', 'bg-sexify');
            followBtn.classList.replace('text-gray-700', 'text-white');
            followBtn.onclick = () => {
                subs.push({ id: userId, name: user.display_name, avatar: avatar });
                localStorage.setItem('mySubscriptions', JSON.stringify(subs));
                followBtn.innerText = "已追蹤";
                followBtn.classList.replace('bg-sexify', 'bg-gray-200');
                followBtn.classList.replace('text-white', 'text-gray-700');
                alert(`成功追蹤 ${user.display_name}！`);
            };
        }

        // 抓取貼文
        const { data: posts } = await window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        const grid = document.getElementById('other-posts-grid');
        if (!posts || posts.length === 0) grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚無內容</div>`;
        else grid.innerHTML = posts.map(p => `<div class="masonry-item"><img src="${p.media_url}" class="w-full rounded-xl"></div>`).join('');

    } catch (err) {
        console.error("讀取他人主頁失敗", err);
    }
}

window.closeOtherProfile = function() {
    const modal = document.getElementById('other-profile-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}
