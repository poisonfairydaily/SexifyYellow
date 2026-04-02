// js/messages.js (擴充功能 5)

// 開啟群組設定
async function openGroupSettings(groupId) {
    const { data: user } = await supabase.auth.getUser();
    const { data: members, error } = await supabase.from('group_members').select('*, profiles(username, avatar_url)').eq('group_id', groupId);
    const { data: group } = await supabase.from('groups').select('creator_id').eq('id', groupId).single();

    if (error) return;

    const modal = document.getElementById('group-manage-modal');
    modal.classList.remove('hidden');
    
    const isCreator = group.creator_id === user.user.id;
    const memberList = document.getElementById('group-member-list');
    
    memberList.innerHTML = members.map(m => `
        <div class="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg">
            <div class="flex items-center gap-3">
                <img src="${m.profiles.avatar_url}" class="w-8 h-8 rounded-full">
                <span>${m.profiles.username} ${m.user_id === group.creator_id ? '<span class="text-[10px] bg-pink-500/20 text-pink-500 px-1 rounded">主理人</span>' : ''}</span>
            </div>
            ${isCreator && m.user_id !== user.user.id ? 
                `<button onclick="kickMember('${groupId}', '${m.user_id}')" class="text-red-500 text-sm">踢出</button>` : ''}
        </div>
    `).join('');

    // 退出按鈕邏輯
    const leaveBtn = document.getElementById('leave-group-btn');
    leaveBtn.onclick = () => leaveGroup(groupId, user.user.id);
    leaveBtn.innerText = isCreator ? '解散群組' : '退出群組';
}

// 踢出成員
async function kickMember(groupId, userId) {
    if (!confirm('確定要將該成員移出群組嗎？')) return;
    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (!error) {
        alert('已移出成員');
        openGroupSettings(groupId);
    }
}

// 退出群組
async function leaveGroup(groupId, userId) {
    const { data: group } = await supabase.from('groups').select('creator_id').eq('id', groupId).single();
    
    if (group.creator_id === userId) {
        if (!confirm('你是主理人，退出將會解散群組，確定嗎？')) return;
        await supabase.from('groups').delete().eq('id', groupId);
    } else {
        if (!confirm('確定要退出群組嗎？')) return;
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    }
    closeGroupManage();
    renderChatList(); // 重新載入對話列表
}

function closeGroupManage() {
    document.getElementById('group-manage-modal').classList.add('hidden');
}

// 邀請新成員 (功能 5)
async function inviteNewMember(groupId) {
    const targetUsername = prompt('請輸入要邀請的用戶名稱:');
    if (!targetUsername) return;

    const { data: targetUser } = await supabase.from('profiles').select('id').eq('username', targetUsername).single();
    if (!targetUser) return alert('找不到該用戶');

    const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: targetUser.id });
    if (error) {
        alert('邀請失敗或用戶已在群組中');
    } else {
        alert('邀請成功！');
        openGroupSettings(groupId);
    }
}
