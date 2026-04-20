// ==========================================
// js/messages.js - 完整升級版 (修復崩潰Bug + 完美自動捲動到底部)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.activeIsGroup = false; 
window.roomChannel = null;

let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;
window.selectedMediaUrl = null;

// 內部工具：將檔案上傳至 Supabase Storage (media 桶)
async function uploadMediaToSupabase(fileBlob, filePath) {
    try {
        const { data, error } = await window.supabaseClient.storage
            .from('media')
            .upload(filePath, fileBlob, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        const { data: publicData } = window.supabaseClient.storage
            .from('media')
            .getPublicUrl(filePath);

        return publicData.publicUrl;
    } catch (err) {
        console.error("Supabase 上傳失敗:", err);
        throw err;
    }
}

function getFallbackAvatar(name) {
    const char = name ? name.charAt(0).toUpperCase() : 'U';
    return `<div class="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold" style="background: linear-gradient(135deg, #FF6B6B, #FF8E53)">${char}</div>`;
}

function safeText(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function getValidUserId() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user ? user.id : null;
}

function generateRoomId(id1, id2) {
    if (!id1 || !id2) return null;
    return [id1, id2].sort().join('_');
}

// ✨ 強化的捲動到底部函數 (保證準確)
window.scrollToBottom = function() {
    const container = document.getElementById('chat-messages');
    if (container) {
        // 立刻捲動
        container.scrollTop = container.scrollHeight;
        // 加入延遲，防止動畫或圖片稍微延遲撐開高度
        setTimeout(() => { if (container) container.scrollTop = container.scrollHeight; }, 100);
        setTimeout(() => { if (container) container.scrollTop = container.scrollHeight; }, 300);
    }
};

function updateOnlineStatusUI(isOnline) {
    const statusText = document.querySelector('#chat-modal span.uppercase');
    if (!statusText) return;
    
    if (window.activeIsGroup) {
        statusText.innerHTML = '● 群組聊天';
        statusText.className = 'text-[10px] font-bold mt-1 uppercase tracking-tighter text-gray-400';
    } else {
        statusText.innerHTML = isOnline ? '● Online' : '● Offline';
        statusText.className = `text-[10px] font-bold mt-1 uppercase tracking-tighter ${isOnline ? 'text-green-500' : 'text-gray-400'}`;
    }
}

window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    const btn = document.getElementById('send-btn');

    if (!content && !window.selectedMediaUrl) return;
    btn.disabled = true;

    try {
        const myId = await getValidUserId();
        if (!myId || !window.activeRoomId) return alert('請先登入');

        const targetReceiver = window.activeIsGroup ? myId : window.activeChatTarget;

        const { error } = await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId,
            sender_name: myId,
            receiver: targetReceiver,
            content: content,
            image_url: window.selectedMediaUrl,
            is_read: window.activeIsGroup ? true : false
        }]);

        if (error) throw error;
        input.value = '';
        window.selectedMediaUrl = null; 
        
        await loadMessages();
        
        if(typeof window.renderMessages === 'function') window.renderMessages();
    } catch (e) {
        alert('傳送失敗');
    } finally {
        btn.disabled = false;
    }
};

// ✨ 修復的渲染對話內容函數 (加上 async，確保資料拿到才畫畫面)
async function drawMessages(messages, profileMap = null) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const myId = await getValidUserId();
    let lastDate = null;

    container.innerHTML = messages.map(m => {
        const isMine = m.sender_name === myId;
        const msgClass = isMine ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none';
        const wrapperClass = isMine ? 'justify-end' : 'justify-start';
        
        const messageDate = new Date(m.created_at).toLocaleDateString();
        let dateSeparator = '';
        if (messageDate !== lastDate) {
            const displayDate = messageDate === new Date().toLocaleDateString() ? '今天' : messageDate;
            dateSeparator = `<div class="flex justify-center my-6"><span class="bg-gray-200 text-gray-500 text-[10px] px-3 py-1 rounded-full font-bold">${displayDate}</span></div>`;
            lastDate = messageDate;
        }

        const cleanContent = safeText(m.content);
        const safeImgUrl = m.image_url ? encodeURI(m.image_url) : null;
        
        const isAudio = safeImgUrl && (safeImgUrl.match(/\.(mp3|wav|m4a)$/i) || safeImgUrl.includes('voice_'));
        const isVideo = safeImgUrl && safeImgUrl.match(/\.(mp4|webm|mov|ogg)$/i) && !isAudio;
        
        let mediaHtml = '';
        if (safeImgUrl) {
            if (isAudio) {
                mediaHtml = `<audio src="${safeImgUrl}" controls class="h-8 mt-1 max-w-[200px] sm:max-w-xs"></audio>`;
            } else if (isVideo) {
                mediaHtml = `<video src="${safeImgUrl}" controls playsinline class="rounded-lg mt-1 max-w-full shadow-sm max-h-48 bg-black object-cover"></video>`;
            } else {
                mediaHtml = `<img src="${safeImgUrl}" class="rounded-lg mt-1 max-w-full shadow-sm object-cover">`;
            }
        }

        let avatarHtml = '';
        let nameHtml = '';
        if (!isMine && window.activeIsGroup && profileMap && profileMap[m.sender_name]) {
            const p = profileMap[m.sender_name];
            avatarHtml = `<img src="${p.avatar_url || 'https://ui-avatars.com/api/?name='+encodeURIComponent(p.display_name)}" class="w-8 h-8 rounded-full mr-2 self-end mb-1 object-cover flex-shrink-0">`;
            nameHtml = `<div class="text-[10px] text-gray-500 mb-0.5 ml-1 font-bold">${safeText(p.display_name)}</div>`;
        }

        return `
            ${dateSeparator}
            <div class="flex ${wrapperClass} mb-4 px-4 animate-fade-in">
                ${avatarHtml}
                <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%]">
                    ${nameHtml}
                    <div class="${msgClass} px-4 py-2 rounded-2xl shadow-sm relative group">
                        ${cleanContent ? `<div class="text-sm whitespace-pre-wrap">${cleanContent}</div>` : ''}
                        ${mediaHtml}
                        <div class="text-[9px] opacity-50 mt-1 text-right">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                        ${isMine ? `<button onclick="window.deleteMessage('${m.id}', '${m.sender_name}', '${m.image_url || ''}')" class="absolute ${isMine ? '-left-8' : '-right-8'} top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 transition p-2"><i class="fa-solid fa-trash-can text-xs"></i></button>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');

    // ✨ 畫面畫好後，立刻捲動到底部
    window.scrollToBottom();

    // ✨ 監聽圖片，如果圖片載入撐開高度，再捲動一次
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        img.onload = () => window.scrollToBottom();
    });
}

window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    const myId = await getValidUserId();
    if (!container || !myId) return;

    const { data: myGroups } = await window.supabaseClient.from('chat_group_members')
        .select('group_id, last_read_time, chat_groups(name, avatar_url, created_at)').eq('user_id', myId);
    
    const groupMap = {};
    const groupIds = [];
    if (myGroups) {
        myGroups.forEach(g => {
            groupIds.push(g.group_id);
            groupMap[g.group_id] = { ...g.chat_groups, last_read_time: g.last_read_time };
        });
    }

    let orQuery = `sender_name.eq.${myId},receiver.eq.${myId}`;
    if (groupIds.length > 0) {
        orQuery += `,room_id.in.(${groupIds.join(',')})`;
    }

    const { data: msgData } = await window.supabaseClient.from('messages')
        .select('*').or(orQuery)
        .order('created_at', { ascending: false });

    const msgs = msgData || [];
    const rooms = {};
    const unreadCounts = {};

    msgs.forEach(m => { 
        if (!rooms[m.room_id]) rooms[m.room_id] = m; 
        
        const isGroup = groupIds.includes(m.room_id);
        
        if (isGroup) {
            const groupInfo = groupMap[m.room_id];
            const msgTime = new Date(m.created_at).getTime();
            const lastRead = new Date(groupInfo.last_read_time).getTime();
            if (m.sender_name !== myId && msgTime > lastRead) {
                unreadCounts[m.room_id] = (unreadCounts[m.room_id] || 0) + 1;
            }
        } else {
            if (m.receiver === myId && m.is_read === false) {
                unreadCounts[m.room_id] = (unreadCounts[m.room_id] || 0) + 1;
            }
        }
    });

    groupIds.forEach(gid => {
        if (!rooms[gid]) {
            rooms[gid] = {
                room_id: gid,
                content: '群組已建立，快來發送第一則訊息吧！',
                created_at: groupMap[gid].created_at || new Date().toISOString(),
                sender_name: myId,
                receiver: myId
            };
        }
    });
    
    const sortedRooms = Object.values(rooms).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const targetIds = sortedRooms.filter(m => !groupIds.includes(m.room_id)).map(m => m.sender_name === myId ? m.receiver : m.sender_name);
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', targetIds);
    const profMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);

    if (sortedRooms.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-gray-400 text-sm font-bold">目前還沒有訊息喔</div>`;
        return;
    }

    container.innerHTML = sortedRooms.map(m => {
        const isGroup = groupIds.includes(m.room_id);
        let name, avatarPart, onClickStr;

        if (isGroup) {
            const g = groupMap[m.room_id];
            name = g.name || '群組聊天';
            avatarPart = g.avatar_url 
                ? `<img src="${g.avatar_url}" class="w-full h-full rounded-full object-cover border border-gray-100">`
                : `<div class="w-full h-full rounded-full flex items-center justify-center bg-black text-white"><i class="fa-solid fa-users text-lg"></i></div>`;
            onClickStr = `openChat('${m.room_id}', '${safeText(name)}', '${g.avatar_url || ''}', true)`;
        } else {
            const tid = m.sender_name === myId ? m.receiver : m.sender_name;
            const p = profMap[tid];
            name = p?.display_name || '用戶';
            avatarPart = p?.avatar_url 
                ? `<img src="${p.avatar_url}" class="w-full h-full rounded-full object-cover border border-gray-100">`
                : getFallbackAvatar(name);
            onClickStr = `openChat('${tid}', '${safeText(name)}', '${p?.avatar_url || ''}', false)`;
        }
        
        let lastMsg = '';
        if (m.content) {
            lastMsg = safeText(m.content);
        } else if (m.image_url) {
            if (m.image_url.match(/\.(mp4|webm|mov|ogg)$/i) && !m.image_url.includes('voice_')) lastMsg = '[影片]';
            else if (m.image_url.match(/\.(mp3|wav|m4a)$/i) || m.image_url.includes('voice_')) lastMsg = '[語音]';
            else lastMsg = '[圖片]';
        }
        
        const unreads = unreadCounts[m.room_id] || 0;
        const unreadBadge = unreads > 0 
            ? `<div class="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">${unreads > 99 ? '99+' : unreads}</div>` 
            : '';
        
        const textStyle = unreads > 0 ? "text-gray-900 font-bold" : "text-gray-400";
        
        return `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="${onClickStr}">
                <div class="w-14 h-14 bg-gray-100 rounded-full relative flex-shrink-0">${avatarPart}</div>
                <div class="flex-1 overflow-hidden flex flex-col justify-center">
                    <div class="flex justify-between items-center font-bold text-sm text-gray-900 mb-1">
                        <span class="truncate pr-2">${safeText(name)}</span>
                        ${unreadBadge}
                    </div>
                    <div class="text-xs ${textStyle} truncate pr-4">${lastMsg}</div>
                </div>
            </div>`;
    }).join('');

    if(typeof window.updateGlobalMessageBadge === 'function') window.updateGlobalMessageBadge();
};

window.openChat = async function(targetId, displayName, avatarUrl, isGroup = false) {
    const myId = await getValidUserId(); 
    if (!myId) return;
    
    window.activeIsGroup = isGroup;
    window.activeChatTarget = targetId;
    
    const groupOptBtn = document.getElementById('group-options-btn');

    if (isGroup) {
        window.activeRoomId = targetId;
        if(groupOptBtn) {
            groupOptBtn.classList.remove('hidden');
            groupOptBtn.style.display = 'flex'; 
        }
    } else {
        window.activeRoomId = generateRoomId(myId, targetId);
        if(groupOptBtn) {
            groupOptBtn.classList.add('hidden');
            groupOptBtn.style.display = 'none'; 
        }
    }
    
    if(document.getElementById('chat-name')) document.getElementById('chat-name').innerText = safeText(displayName);
    
    const avatarImg = document.getElementById('chat-target-avatar');
    if (avatarImg) {
        if (isGroup && !avatarUrl) {
            avatarImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
        } else {
            avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${safeText(displayName)}&background=random`;
        }
    }
    
    updateOnlineStatusUI(false);
    
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    if (isGroup) {
        await window.supabaseClient.from('chat_group_members')
            .update({ last_read_time: new Date().toISOString() })
            .eq('group_id', window.activeRoomId).eq('user_id', myId);
    } else {
        await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myId);
    }
    
    if(typeof window.renderMessages === 'function') window.renderMessages();
    if(typeof window.updateGlobalMessageBadge === 'function') window.updateGlobalMessageBadge();
    
    // ✨ 載入訊息 (內部會自動呼叫 scrollToBottom)
    await loadMessages();
    
    setupChatRealtime();
};

async function loadMessages() {
    if (!window.activeRoomId) return;
    const { data, error } = await window.supabaseClient.from('messages')
        .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
    
    if (error) return;

    if (window.activeIsGroup) {
        const senderIds = [...new Set(data.map(m => m.sender_name))];
        const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', senderIds);
        const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);
        await drawMessages(data, profileMap);
    } else {
        await drawMessages(data, null);
    }
}

function setupChatRealtime() {
    if (!window.activeRoomId) return;
    if (window.roomChannel) window.roomChannel.unsubscribe();

    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId);

    window.roomChannel
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages', 
            filter: `room_id=eq.${window.activeRoomId}` 
        }, async () => {
            const myId = await getValidUserId();
            
            if (window.activeIsGroup) {
                await window.supabaseClient.from('chat_group_members')
                    .update({ last_read_time: new Date().toISOString() })
                    .eq('group_id', window.activeRoomId).eq('user_id', myId);
            } else {
                await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myId);
            }
            
            await loadMessages();
            
            if(typeof window.renderMessages === 'function') window.renderMessages();
            if(typeof window.updateGlobalMessageBadge === 'function') window.updateGlobalMessageBadge();
        })
        .on('presence', { event: 'sync' }, () => {
            if (window.activeIsGroup) return; 
            const state = window.roomChannel.presenceState();
            const isOnline = Object.values(state).flat().some(p => p.user_id === window.activeChatTarget);
            updateOnlineStatusUI(isOnline);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && !window.activeIsGroup) {
                const myId = await getValidUserId();
                await window.roomChannel.track({
                    user_id: myId,
                    online_at: new Date().toISOString(),
                });
            }
        });
}

window.deleteMessage = async function(msgId, senderId, mediaUrl) {
    const myId = await getValidUserId();
    if (myId !== senderId) return; 
    if (!confirm('確定回收這條訊息？(相關媒體檔案也將從伺服器永久刪除)')) return;
    
    try {
        if (mediaUrl && mediaUrl.includes('/storage/v1/object/public/media/')) {
            const filePath = mediaUrl.split('/storage/v1/object/public/media/')[1];
            if (filePath) {
                await window.supabaseClient.storage.from('media').remove([filePath]);
            }
        }

        await window.supabaseClient.from('messages').delete().eq('id', msgId);
        loadMessages();
        if(typeof window.renderMessages === 'function') window.renderMessages(); 
    } catch (e) { 
        console.error(e);
        alert('回收失敗'); 
    }
};

// ==========================================
// 🌟 建立群組與成員管理功能
// ==========================================

window.openCreateGroupModal = function() {
    const modal = document.getElementById('create-group-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeCreateGroupModal = function() {
    const modal = document.getElementById('create-group-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.handleCreateGroup = async function() {
    const nameInput = document.getElementById('new-group-name');
    const membersInput = document.getElementById('new-group-members-input');
    const name = nameInput.value.trim();
    const membersStr = membersInput ? membersInput.value.trim() : '';

    if (!name) return alert('請輸入群組名稱');
    
    const myId = await getValidUserId();
    if (!myId) return;

    try {
        const { data: groupData, error: groupErr } = await window.supabaseClient.from('chat_groups').insert([{
            name: name,
            owner_id: myId
        }]).select().single();

        if (groupErr) throw groupErr;

        const membersToInsert = [{
            group_id: groupData.id,
            user_id: myId
        }];

        if (membersStr) {
            const terms = membersStr.split(',').map(s => s.trim()).filter(s => s);
            if (terms.length > 0) {
                let orConditions = terms.map(t => `username.ilike.%${t}%,display_name.ilike.%${t}%`).join(',');
                
                const { data: foundUsers } = await window.supabaseClient.from('profiles')
                    .select('id')
                    .or(orConditions);

                if (foundUsers && foundUsers.length > 0) {
                    foundUsers.forEach(u => {
                        if (u.id !== myId) {
                            membersToInsert.push({
                                group_id: groupData.id,
                                user_id: u.id
                            });
                        }
                    });
                }
            }
        }

        await window.supabaseClient.from('chat_group_members').insert(membersToInsert);

        window.closeCreateGroupModal();
        nameInput.value = '';
        if (membersInput) membersInput.value = '';
        alert('群組建立成功！');
        if(typeof window.renderMessages === 'function') window.renderMessages();
    } catch (err) {
        console.error("群組建立失敗", err);
        alert("建立失敗，請稍後再試。");
    }
};

window.openGroupSettings = async function() {
    const modal = document.getElementById('group-settings-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    await window.loadGroupMembers();
};

window.closeGroupSettings = function() {
    const modal = document.getElementById('group-settings-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
};

window.loadGroupMembers = async function() {
    const list = document.getElementById('group-members-list');
    list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-400"></i></div>`;

    const myId = await getValidUserId();

    const { data: groupData } = await window.supabaseClient.from('chat_groups').select('owner_id').eq('id', window.activeRoomId).single();
    const isOwner = groupData && groupData.owner_id === myId;

    const { data: members } = await window.supabaseClient.from('chat_group_members').select('user_id').eq('group_id', window.activeRoomId);
    if (!members) {
        list.innerHTML = `<div class="text-center py-10 text-gray-400">載入失敗</div>`;
        return;
    }

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, username, avatar_url').in('id', userIds);

    if (!profiles) return;

    list.innerHTML = profiles.map(p => `
        <div class="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 mb-2">
            <img src="${p.avatar_url || getFallbackAvatar(p.display_name)}" class="w-10 h-10 rounded-full object-cover">
            <div class="flex-1">
                <p class="text-sm font-bold text-gray-800">${safeText(p.display_name)} ${groupData.owner_id === p.id ? '<span class="text-[10px] bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full ml-1">群主</span>' : ''}</p>
                <p class="text-[10px] text-gray-400">@${safeText(p.username)}</p>
            </div>
            ${(isOwner && p.id !== myId) ? `<button onclick="window.kickGroupMember('${p.id}')" class="text-red-500 text-xs font-bold px-3 py-1 bg-red-50 rounded-lg active:scale-90 transition">踢出</button>` : ''}
        </div>
    `).join('');
};

window.addGroupMember = async function() {
    const input = document.getElementById('group-add-user-input');
    const term = input.value.trim();
    if (!term) return;

    const { data: users } = await window.supabaseClient.from('profiles')
        .select('id')
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .limit(1);

    if (!users || users.length === 0) {
        return alert('找不到該用戶，請確認名稱是否正確');
    }

    const targetUserId = users[0].id;

    const { error } = await window.supabaseClient.from('chat_group_members').insert([{
        group_id: window.activeRoomId,
        user_id: targetUserId
    }]);

    if (error) {
        if (error.code === '23505') alert('該用戶已經在群組中了');
        else alert('新增失敗，可能資料庫權限 (RLS) 不足');
    } else {
        input.value = '';
        alert('加入成功！');
        await window.loadGroupMembers();
    }
};

window.kickGroupMember = async function(userId) {
    if (!confirm('確定要將該成員踢出群組？')) return;
    await window.supabaseClient.from('chat_group_members')
        .delete()
        .eq('group_id', window.activeRoomId).eq('user_id', userId);
    await window.loadGroupMembers();
};

window.leaveGroup = async function() {
    if (!confirm('確定要退出這個群組嗎？')) return;
    
    const myId = await getValidUserId();
    if (!myId || !window.activeRoomId) return;

    try {
        const { data: groupData } = await window.supabaseClient.from('chat_groups').select('owner_id').eq('id', window.activeRoomId).single();
        
        if (groupData && groupData.owner_id === myId) {
            const { data: members } = await window.supabaseClient.from('chat_group_members').select('user_id').eq('group_id', window.activeRoomId);
            const otherMembers = members.filter(m => m.user_id !== myId);
            
            if (otherMembers.length > 0) {
                const newOwnerId = otherMembers[0].user_id;
                await window.supabaseClient.from('chat_groups').update({ owner_id: newOwnerId }).eq('id', window.activeRoomId);
            } else {
                await window.supabaseClient.from('chat_groups').delete().eq('id', window.activeRoomId);
                window.closeGroupSettings();
                window.closeChat();
                if(typeof window.renderMessages === 'function') window.renderMessages();
                return;
            }
        }

        const { error } = await window.supabaseClient.from('chat_group_members')
            .delete()
            .eq('group_id', window.activeRoomId)
            .eq('user_id', myId);

        if (error) throw error;

        alert('已成功退出群組');
        window.closeGroupSettings();
        window.closeChat();
        if(typeof window.renderMessages === 'function') window.renderMessages();
        
    } catch (err) {
        console.error("退出群組失敗:", err);
        alert('退出群組失敗，請確認 Supabase RLS 設定是否允許刪除自己的群組成員紀錄。');
    }
};

// ==========================================
// 🎙️ 語音錄製核心邏輯
// ==========================================
window.toggleVoiceRecord = async function() {
    const btnIcon = document.querySelector('[onclick*="toggleVoiceRecord"] i');
    const input = document.getElementById('chat-input');
    
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                const myId = await getValidUserId();
                
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                
                const filePath = `chat_media/voice_${myId}_${Date.now()}.${ext}`;

                const originalPlaceholder = input.placeholder;
                input.placeholder = "語音上傳中，請稍候...";
                input.disabled = true;

                try {
                    const publicUrl = await uploadMediaToSupabase(audioBlob, filePath);
                    if (publicUrl) {
                        window.selectedMediaUrl = publicUrl;
                        await window.handleSendAction();
                    }
                } catch (e) { 
                    console.error("語音上傳錯誤:", e);
                    alert('語音上傳失敗，請確認網路連線與資料庫權限。'); 
                } finally {
                    input.placeholder = originalPlaceholder;
                    input.disabled = false;
                }
                
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            window.isRecording = true;
            
            if(btnIcon) {
                btnIcon.classList.remove('fa-microphone');
                btnIcon.classList.add('fa-stop', 'text-red-500', 'animate-pulse');
            }
        } catch (e) { 
            console.error("麥克風錯誤:", e);
            alert('無法開啟麥克風。請確認：\n1. 您的網站使用 HTTPS 連線\n2. 已同意瀏覽器存取麥克風權限。'); 
        }
    } else {
        if(mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        window.isRecording = false;
        
        if(btnIcon) {
            btnIcon.classList.add('fa-microphone');
            btnIcon.classList.remove('fa-stop', 'text-red-500', 'animate-pulse');
        }
    }
};

// ==========================================
// 🖼️ 圖片/影片上傳邏輯
// ==========================================
window.handleImageSelection = async function(input) {
    const file = input.files[0];
    if (!file) return;
    
    const chatInput = document.getElementById('chat-input');
    const originalPlaceholder = chatInput.placeholder;
    chatInput.placeholder = "媒體檔案上傳中...";
    chatInput.disabled = true;

    try {
        const myId = await getValidUserId();
        const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        const isVideoUpload = ['mp4', 'webm', 'mov', 'ogg'].includes(ext);
        const prefix = isVideoUpload ? 'vid_' : 'img_';
        
        const filePath = `chat_media/${prefix}${myId}_${Date.now()}.${ext}`;

        const publicUrl = await uploadMediaToSupabase(file, filePath);
        
        if (publicUrl) {
            window.selectedMediaUrl = publicUrl;
            await window.handleSendAction();
        }
    } catch (e) { 
        console.error("上傳錯誤:", e);
        alert('媒體上傳失敗'); 
    } finally {
        chatInput.placeholder = originalPlaceholder;
        chatInput.disabled = false;
        input.value = ''; 
    }
};
