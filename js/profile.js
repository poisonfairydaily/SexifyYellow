// js/profile.js (擴充功能 4)

async function renderUserList(type) { // type: 'followers' or 'following'
    const { data: user } = await supabase.auth.getUser();
    const { data: list, error } = await supabase.from(type).select('*, profiles!target_user_id(*)').eq('user_id', user.user.id);

    const container = document.getElementById('main-content');
    let html = `<div class="p-4 space-y-4">`;
    
    list.forEach(item => {
        const profile = item.profiles;
        html += `
            <div class="flex items-center justify-between bg-gray-900 p-4 rounded-2xl">
                <div class="flex items-center gap-4" onclick="viewUserProfile('${profile.id}')">
                    <img src="${profile.avatar_url}" class="w-12 h-12 rounded-full object-cover">
                    <div>
                        <div class="font-bold">${profile.username}</div>
                        <div class="text-xs text-gray-500">${profile.bio || '尚未填寫簡介'}</div>
                    </div>
                </div>
                <button onclick="startPrivateChat('${profile.id}', '${profile.username}')" 
                        class="p-2 bg-pink-500/20 text-pink-500 rounded-full border border-pink-500/30">
                    💬
                </button>
            </div>
        `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

// 發起私聊功能
async function startPrivateChat(targetUserId, targetUsername) {
    const { data: user } = await supabase.auth.getUser();
    
    // 檢查是否已有現有對話
    const { data: existingChat } = await supabase.rpc('get_private_chat', { 
        uid1: user.user.id, 
        uid2: targetUserId 
    });

    if (existingChat) {
        openChatRoom(existingChat.id, targetUsername);
    } else {
        // 創建新對話
        const { data: newChat } = await supabase.from('chats').insert({ type: 'private' }).select().single();
        await supabase.from('chat_participants').insert([
            { chat_id: newChat.id, user_id: user.user.id },
            { chat_id: newChat.id, user_id: targetUserId }
        ]);
        openChatRoom(newChat.id, targetUsername);
    }
    switchTab('messages'); // 切換到訊息標籤頁
}
