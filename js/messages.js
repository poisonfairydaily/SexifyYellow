// ==========================================
// js/messages.js - 終極安全與體驗完整版 (無省略)
// 功能：自動捲動 + 點擊大圖 + R2私密上傳 + JWT防護 + 詐騙過濾 + 快取優化
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.activeIsGroup = false; 
window.roomChannel = null;

let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;
window.selectedMediaUrl = null;
window.selectedMediaIsNsfw = false; 

// ✨ 快取機制：獲取 User ID，避免 Lock Stolen 報錯
async function getValidUserId() {
    if (window.cachedMyUserId) return window.cachedMyUserId;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session && session.user) {
        window.cachedMyUserId = session.user.id;
        return window.cachedMyUserId;
    }
    return null;
}

// ✨ 核心升級：將檔案上傳至 Cloudflare R2
// 註：如果 fileName 包含 "chat"，Worker 會將其放入私密目錄
async function uploadChatMediaToR2(blob, fileName) {
    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 
    const formData = new FormData();
    formData.append('file', blob, fileName); 

    const response = await fetch(WORKER_URL + 'upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`上傳連線失敗`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    return result.url;
}

// ✨ WebP 自動壓縮引擎
async function generateWebPBlob(file) {
    if (!file.type.startsWith('image/')) return file; 
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const max_size = 1200; 
            let width = img.width, height = img.height;
            if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
            else { if (height > max_size) { width *= max_size / height; height = max_size; } }
            canvas.width = width; canvas.height = height;
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85); 
        };
        img.onerror = () => { resolve(file); };
    });
}

function getFallbackAvatar(name) {
    const char = name ? name.charAt(0).toUpperCase() : 'U';
    return `<div class="w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold" style="background: linear-gradient(135deg, #FF6B6B, #FF8E53)">${char}</div>`;
}

function safeText(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function generateRoomId(id1, id2) {
    if (!id1 || !id2) return null;
    return [id1, id2].sort().join('_');
}

window.scrollToBottom = function() {
    const container = document.getElementById('chat-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
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

        if (window.containsToxicContent && window.containsToxicContent(content)) {
            throw new Error("⚠️ 系統偵測到您的內容包含不安全的連結或違規詞彙，請修改後再發送。");
        }

        const targetReceiver = window.activeIsGroup ? myId : window.activeChatTarget;

        const { error } = await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId,
            sender_name: myId,
            receiver: targetReceiver,
            content: content,
            image_url: window.selectedMediaUrl,
            is_read: window.activeIsGroup ? true : false,
            is_nsfw: window.selectedMediaIsNsfw || false 
        }]);

        if (error) throw error;
        input.value = '';
        window.selectedMediaUrl = null; 
        window.selectedMediaIsNsfw = false; 
        
        await loadMessages();
        if(typeof window.renderMessages === 'function') window.renderMessages();
    } catch (e) {
        alert(e.message || '傳送失敗');
    } finally {
        btn.disabled = false;
    }
};

async function drawMessages(messages, profileMap = null) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const myId = await getValidUserId();
    let lastDate = null;
    
    // ✨ 取得當前用戶的 JWT Token (用來解鎖私密圖片)
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const jwtToken = session?.access_token || '';

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
        let safeImgUrl = m.image_url ? encodeURI(m.image_url) : null;
        
        // ✨ JWT 鑰匙注入：如果網址屬於聊天室私密目錄，自動在網址尾巴掛上 Token
        if (safeImgUrl && safeImgUrl.includes('/chat/')) {
            safeImgUrl = `${safeImgUrl}?token=${jwtToken}`;
        }
        
        const isAudio = safeImgUrl && (safeImgUrl.match(/\.(mp3|wav|m4a)/i) || safeImgUrl.includes('voice_'));
        const isVideo = safeImgUrl && safeImgUrl.match(/\.(mp4|webm|mov|ogg)/i) && !isAudio;
        
        let mediaHtml = '';
        if (safeImgUrl) {
            const disableBlur = localStorage.getItem('nsfw_unblur_default') === 'true';
            const isNsfw = m.is_nsfw === true; 
            const needsBlur = isNsfw && !disableBlur;
            const blurClass = needsBlur ? 'blur-2xl cursor-pointer select-none' : 'cursor-pointer';

            if (isAudio) {
                mediaHtml = `<audio src="${safeImgUrl}" controls class="h-8 mt-1 max-w-[200px] sm:max-w-xs"></audio>`;
            } else if (isVideo) {
                mediaHtml = `<div class="relative mt-1 max-w-full max-h-48 overflow-hidden rounded-lg">
                                <video src="${safeImgUrl}" class="w-full h-full bg-black object-cover ${blurClass} transition-all duration-300" onclick="window.handleMediaClick('${safeImgUrl}', true, this, ${needsBlur})"></video>
                                ${needsBlur ? '<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><i class="fa-solid fa-eye-slash text-white text-3xl opacity-80"></i></div>' : ''}
                             </div>`;
            } else {
                mediaHtml = `<div class="relative mt-1 max-w-full overflow-hidden rounded-lg">
                                <img src="${safeImgUrl}" class="w-full shadow-sm object-cover ${blurClass} transition-all duration-300" onclick="window.handleMediaClick('${safeImgUrl}', false, this, ${needsBlur})">
                                ${needsBlur ? '<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><i class="fa-solid fa-eye-slash text-white text-3xl opacity-80"></i></div>' : ''}
                             </div>`;
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
                <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%] relative group/msg">
                    ${nameHtml}
                    <div class="${msgClass} px-4 py-2 rounded-2xl shadow-sm relative group">
                        ${cleanContent ? `<div class="text-sm whitespace-pre-wrap">${cleanContent}</div>` : ''}
                        ${mediaHtml}
                        <div class="text-[9px] opacity-50 mt-1 text-right">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                        ${isMine ? `<button onclick="window.deleteMessage('${m.id}', '${m.sender_name}', '${m.image_url || ''}')" class="absolute ${isMine ? '-left-8' : '-right-8'} top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 transition p-2"><i class="fa-solid fa-trash-can text-xs"></i></button>` : ''}
                    </div>
                    ${!isMine ? `<button onclick="window.openReportModal('${m.sender_name}', '${safeText(m.content || '')}', '${safeImgUrl || ''}')" title="檢舉此訊息" class="absolute -right-6 top-1 text-gray-200 hover:text-red-400 opacity-0 group-hover/msg:opacity-100 transition p-1"><i class="fa-solid fa-triangle-exclamation text-xs"></i></button>` : ''}
                </div>
            </div>`;
    }).join('');

    window.scrollToBottom();
    const images = container.querySelectorAll('img');
    images.forEach(img => { img.onload = () => window.scrollToBottom(); });
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
    if (!confirm('確定回收這條訊息？')) return;
    
    try {
        await window.supabaseClient.from('messages').delete().eq('id', msgId);
        loadMessages();
        if(typeof window.renderMessages === 'function') window.renderMessages(); 
    } catch (e) { 
        console.error(e);
        alert('回收失敗'); 
    }
};

// ==========================================
// 🌟 群組與成員管理功能
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
        const { data: groupData, error: groupErr } = await window.supabaseClient.from('chat_groups').insert([{ name: name, owner_id: myId }]).select().single();
        if (groupErr) throw groupErr;

        const membersToInsert = [{ group_id: groupData.id, user_id: myId }];

        if (membersStr) {
            const terms = membersStr.split(',').map(s => s.trim()).filter(s => s);
            if (terms.length > 0) {
                let orConditions = terms.map(t => `username.ilike.%${t}%,display_name.ilike.%${t}%`).join(',');
                const { data: foundUsers } = await window.supabaseClient.from('profiles').select('id').or(orConditions);
                if (foundUsers && foundUsers.length > 0) {
                    foundUsers.forEach(u => { if (u.id !== myId) membersToInsert.push({ group_id: groupData.id, user_id: u.id }); });
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
    
    if (!members) return;
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
    const { data: users } = await window.supabaseClient.from('profiles').select('id').or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(1);
    if (!users || users.length === 0) return alert('找不到該用戶');
    
    const { error } = await window.supabaseClient.from('chat_group_members').insert([{ group_id: window.activeRoomId, user_id: users[0].id }]);
    if (error) alert('新增失敗');
    else { input.value = ''; alert('加入成功！'); await window.loadGroupMembers(); }
};

window.kickGroupMember = async function(userId) {
    if (!confirm('確定要踢出？')) return;
    await window.supabaseClient.from('chat_group_members').delete().eq('group_id', window.activeRoomId).eq('user_id', userId);
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
                await window.supabaseClient.from('chat_groups').update({ owner_id: otherMembers[0].user_id }).eq('id', window.activeRoomId);
            } else {
                await window.supabaseClient.from('chat_groups').delete().eq('id', window.activeRoomId);
                window.closeGroupSettings(); window.closeChat();
                if(typeof window.renderMessages === 'function') window.renderMessages();
                return;
            }
        }
        await window.supabaseClient.from('chat_group_members').delete().eq('group_id', window.activeRoomId).eq('user_id', myId);
        window.closeGroupSettings(); window.closeChat();
        if(typeof window.renderMessages === 'function') window.renderMessages();
    } catch (err) { alert('退出群組失敗'); }
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
            
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
            
            mediaRecorder.onstop = async () => {
                const myId = await getValidUserId();
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                
                const randomID = Math.random().toString(36).substring(7);
                const fileName = `chat_voice_${myId}_${Date.now()}_${randomID}.${ext}`;

                const originalPlaceholder = input.placeholder;
                input.placeholder = "語音上傳中，請稍候...";
                input.disabled = true;

                try {
                    // ✨ 錄音同樣透過 R2 私密渠道上傳
                    const publicUrl = await uploadChatMediaToR2(audioBlob, fileName);
                    if (publicUrl) {
                        window.selectedMediaUrl = publicUrl;
                        await window.handleSendAction();
                    }
                } catch (e) { 
                    alert('語音上傳失敗'); 
                } finally {
                    input.placeholder = originalPlaceholder;
                    input.disabled = false;
                }
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            window.isRecording = true;
            if(btnIcon) { btnIcon.classList.remove('fa-microphone'); btnIcon.classList.add('fa-stop', 'text-red-500', 'animate-pulse'); }
        } catch (e) { 
            alert('無法開啟麥克風。請確認：\n1. 您的網站使用 HTTPS 連線\n2. 已同意瀏覽器存取麥克風權限。'); 
        }
    } else {
        if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        window.isRecording = false;
        if(btnIcon) { btnIcon.classList.add('fa-microphone'); btnIcon.classList.remove('fa-stop', 'text-red-500', 'animate-pulse'); }
    }
};

// ==========================================
// 🖼️ 圖片/影片自動壓縮上傳 (保護隱私版)
// ==========================================
window.handleImageSelection = async function(input) {
    const file = input.files[0];
    if (!file) return;
    
    const chatInput = document.getElementById('chat-input');
    const originalPlaceholder = chatInput.placeholder;
    chatInput.placeholder = "🚀 處理與上傳中...";
    chatInput.disabled = true;

    try {
        const myId = await getValidUserId();
        const isVideoUpload = file.type.startsWith('video/');
        let finalFile = file;
        let ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        
        // 圖片自動壓縮為 WebP
        if (!isVideoUpload) {
            finalFile = await generateWebPBlob(file);
            ext = 'webp';
        }
        
        const prefix = isVideoUpload ? 'chat_vid_' : 'chat_img_';
        const randomID = Math.random().toString(36).substring(7);
        const fileName = `${prefix}${myId}_${Date.now()}_${randomID}.${ext}`;

        // ✨ 透過 R2 私密渠道上傳
        const publicUrl = await uploadChatMediaToR2(finalFile, fileName);
        
        if (publicUrl) {
            window.selectedMediaUrl = publicUrl;
            await window.handleSendAction();
        }
    } catch (e) { 
        alert(e.message || '媒體上傳失敗'); 
    } finally {
        chatInput.placeholder = originalPlaceholder;
        chatInput.disabled = false;
        input.value = ''; 
    }
};

// ==========================================
// 🔍 媒體大圖查看與 NSFW 解鎖燈箱
// ==========================================
window.handleMediaClick = function(url, isVideo, element, isInitiallyBlurred) {
    if (isInitiallyBlurred && element.classList.contains('blur-2xl')) {
        if (confirm('⚠️ 此內容可能含有成人或敏感內容，確定要觀看嗎？\n\n(您可以在設定中關閉此預設警告)')) {
            element.classList.remove('blur-2xl');
            const icon = element.nextElementSibling;
            if (icon) icon.remove();
        }
        return; 
    }
    window.openMediaViewer(url, isVideo);
};

window.openMediaViewer = function(url, isVideo) {
    const existing = document.getElementById('media-lightbox');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'media-lightbox';
    box.className = 'fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300';
    box.onclick = function(e) { if(e.target === box) closeViewer(); };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute top-4 right-4 text-white text-3xl font-bold bg-gray-800 bg-opacity-50 w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-700 transition z-50';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = closeViewer;

    let content = isVideo 
        ? `<video src="${url}" controls autoplay playsinline class="max-w-full max-h-[90vh] rounded-lg shadow-2xl"></video>`
        : `<img src="${url}" class="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain">`;

    box.innerHTML = content;
    box.appendChild(closeBtn);
    document.body.appendChild(box);

    requestAnimationFrame(() => { box.classList.remove('opacity-0'); });

    function closeViewer() {
        box.classList.add('opacity-0');
        setTimeout(() => box.remove(), 300);
    }
};

window.toggleNsfwBlurPreference = function() {
    const current = localStorage.getItem('nsfw_unblur_default') === 'true';
    localStorage.setItem('nsfw_unblur_default', !current);
    alert(!current ? '已設定：成人內容將不再模糊顯示' : '已設定：成人內容將預設模糊保護');
    loadMessages();
};

// ==========================================
// 🚨 用戶檢舉系統 (已修復截圖上傳)
// ==========================================
window.openReportModal = function(reportedUserId, msgContent, msgImageUrl) {
    const reason = prompt("請輸入檢舉原因 (例如：發送非法內容、詐騙、騷擾)：\n\n系統將自動附上該則訊息作為證據。");
    if (!reason) return;

    if (confirm("是否要額外上傳一張螢幕截圖作為補充證據？")) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                // ✨ 截圖使用 "report_" 開頭，會被 Worker 分配到公開的 media/ 資料夾，方便後台管理員直接查看
                const fileName = `report_${Date.now()}_${file.name}`;
                const screenshotUrl = await uploadChatMediaToR2(file, fileName);
                await submitReport(reportedUserId, reason, screenshotUrl, msgContent, msgImageUrl);
            } catch (err) { alert('截圖上傳失敗'); }
        };
        input.click();
    } else {
        submitReport(reportedUserId, reason, null, msgContent, msgImageUrl);
    }
};

async function submitReport(targetId, reason, screenshotUrl, content, imageUrl) {
    const myId = await getValidUserId();
    const { error } = await window.supabaseClient.from('user_reports').insert([{
        reporter_id: myId,
        reported_user_id: targetId,
        reason: reason,
        screenshot_url: screenshotUrl,
        evidence_text: content,
        evidence_image: imageUrl
    }]);

    if (error) {
        alert('檢舉提交失敗，請稍後再試。');
    } else {
        alert('✅ 檢舉已成功提交！管理員會盡快審核。');
    }
}
