// ==========================================
// js/messages.js - 聊天與未讀訊息徽章修復版
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     

let selectedMediaFile = null;
let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;

window.typingUsers = new Set();
let typingClearTimer = null;

let myUserId = localStorage.getItem('userId');

function refreshMyUser() {
    myUserId = localStorage.getItem('userId');
}

document.addEventListener('DOMContentLoaded', () => {
    refreshMyUser();
});

function generateRoomId(id1, id2) { 
    return [id1, id2].sort().join('_'); 
}

// 搜尋發起對話
window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input').value.trim();
    const container = document.getElementById('chat-list');
    
    if (!keyword) { renderMessages(); return; }

    container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const { data, error } = await window.supabaseClient.from('profiles').select('id, display_name, username, avatar_url')
            .or(`display_name.ilike.%${keyword}%,username.ilike.%${keyword}%`).neq('id', localStorage.getItem('userId')).limit(10);

        if (error) throw error;
        if (data.length === 0) return container.innerHTML = `<div class="p-6 text-center text-gray-400 text-sm mt-10">找不到相關用戶</div>`;

        container.innerHTML = data.map(user => `
            <div onclick="openChat('${user.id}', false, '${user.display_name}', '${user.avatar_url}')" class="flex items-center gap-3 p-4 bg-white border-b border-gray-50 active:bg-gray-50 cursor-pointer">
                <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1"><h4 class="font-bold text-gray-900 text-sm">${user.display_name}</h4></div>
                <button class="bg-sexify text-white text-xs px-4 py-2 rounded-full font-bold">發訊息</button>
            </div>`).join('');
    } catch (err) { container.innerHTML = `<div class="p-6 text-center text-red-400 text-sm mt-10">搜尋發生錯誤</div>`; }
}

// 收件匣列表
window.renderMessages = async function() {
    refreshMyUser();
    const container = document.getElementById('chat-list');
    if (!container || !myUserId) return;

    if (document.getElementById('inbox-search-input').value) return; 

    container.innerHTML = `<div class="text-center py-10 mt-10"><i class="fa-solid fa-circle-notch fa-spin text-gray-300 text-2xl"></i></div>`;

    try {
        const { data: inboxData, error } = await window.supabaseClient.from('messages')
            .select('*').ilike('room_id', `%${myUserId}%`).order('created_at', { ascending: false }); 

        if (error) throw error;

        let roomsMap = {};
        let targetIds = new Set();
        
        (inboxData || []).forEach(msg => {
            if (!roomsMap[msg.room_id]) {
                const ids = msg.room_id.split('_');
                const targetId = ids[0] === myUserId ? ids[1] : ids[0];
                
                if (targetId && targetId.length > 20) { 
                    roomsMap[msg.room_id] = { msg: msg, targetId: targetId, unreadCount: 0 };
                    targetIds.add(targetId);
                }
            }
            if (msg.receiver === myUserId && msg.is_read === false && roomsMap[msg.room_id]) {
                roomsMap[msg.room_id].unreadCount++;
            }
        });

        if(targetIds.size === 0) return container.innerHTML = `<div class="text-center py-10 mt-10 text-gray-400 text-sm flex flex-col items-center"><i class="fa-solid fa-inbox text-3xl mb-3 opacity-50"></i>尚無對話記錄</div>`;

        const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url, username').in('id', Array.from(targetIds));

        let profileMap = {};
        if (profiles) profiles.forEach(p => profileMap[p.id] = p);

        let inboxArray = Object.values(roomsMap).map(room => {
            const p = profileMap[room.targetId];
            if (!p) return null; 

            let lastMsgText = room.msg.content;
            if (room.msg.content && room.msg.content.startsWith('[VOICE]:')) lastMsgText = '語音訊息 🎤';
            else if (room.msg.image_url) lastMsgText = '傳送了媒體檔案 📁';

            return {
                id: p.id,
                displayName: p.display_name || p.username,
                avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.display_name || 'U'}&background=random`,
                lastMsg: lastMsgText || '新訊息',
                time: new Date(room.msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
                timestamp: new Date(room.msg.created_at).getTime(),
                unreadCount: room.unreadCount
            };
        }).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);

        container.innerHTML = inboxArray.map(chat => `
            <div class="flex items-center gap-4 p-4 bg-white border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${chat.id}', false, '${chat.displayName}', '${chat.avatar}')">
                <img src="${chat.avatar}" class="w-14 h-14 rounded-full border border-gray-100 object-cover flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-1">
                        <h3 class="font-bold text-gray-900 truncate pr-2">${chat.displayName}</h3>
                        <span class="text-[10px] text-gray-400 font-medium whitespace-nowrap">${chat.time}</span>
                    </div>
                    <p class="text-sm truncate ${chat.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}">${chat.lastMsg}</p>
                </div>
                ${chat.unreadCount > 0 ? `<div class="bg-sexify text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${chat.unreadCount}</div>` : ''}
            </div>
        `).join('');

    } catch (err) { container.innerHTML = `<div class="text-center text-red-400 py-10 text-sm mt-10">資料庫讀取異常</div>`; }
};

// 打開聊天室並標記已讀，消除未讀紅點
window.openChat = async function(targetId, isGroup = false, displayName = targetId, avatarUrl = '') {
    refreshMyUser();
    window.activeChatTarget = targetId;
    window.activeRoomId = generateRoomId(myUserId, targetId);

    const modal = document.getElementById('chat-modal');
    document.getElementById('chat-name').innerText = displayName;
    document.getElementById('chat-target-avatar').src = avatarUrl;
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i></div>`;

    try {
        // 1. 將該房間所有給我的未讀訊息標記為已讀
        await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myUserId).eq('is_read', false);

        // 2. 重新計算全域的未讀訊息數量，如果歸零就隱藏導航列的紅點
        const { count: msgCount } = await window.supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('receiver', myUserId).eq('is_read', false);
        const msgBadge = document.getElementById('nav-msg-badge');
        if (msgBadge) {
            if (msgCount > 0) msgBadge.classList.remove('hidden');
            else msgBadge.classList.add('hidden');
        }

        // 3. 載入對話歷史
        const { data, error } = await window.supabaseClient.from('messages').select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false });
        if (error) throw error;
        
        window.currentRoomMessages = data || [];
        drawMessages(window.currentRoomMessages);
        setupRoomRealtime();
    } catch (err) { chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-red-400">無法載入訊息</div>`; }
};

function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs absolute inset-0 flex items-center justify-center">開始你們的第一句話吧！</div>`;
        return;
    }
    container.innerHTML = messages.map(msg => {
        const isMe = msg.receiver !== myUserId; 
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
        const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        
        let contentHtml = '';
        if (msg.content) {
            if (msg.content.startsWith('[VOICE]:')) contentHtml = `<audio controls src="${msg.content.replace('[VOICE]:', '')}" class="max-w-[220px] h-10 mt-1"></audio>`;
            else contentHtml = `<span>${msg.content}</span>`;
        }

        return `
            <div id="msg-${msg.id}" class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2 msg-container">
                <div class="flex items-end gap-2 w-full ${align}">
                    ${isMe ? `<div class="flex flex-col items-end gap-1"><button onclick="deleteMessage('${msg.id}')" class="text-[10px] text-red-500 bg-red-50 px-2 py-1.5 rounded-md shadow-sm border border-red-100 active:scale-95 transition">回收</button><span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span></div>` : ''}
                    <div class="${bg} px-4 py-2.5 ${isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm'} shadow-sm max-w-[75%] break-words text-sm flex flex-col">
                        ${msg.image_url ? `<img src="${msg.image_url}" loading="lazy" class="max-w-full rounded-lg mb-1 object-cover">` : ''}
                        ${contentHtml}
                    </div>
                    ${!isMe ? `<span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

window.deleteMessage = async function(msgId) {
    if (!confirm("確定要回收這條訊息嗎？")) return;
    window.currentRoomMessages = window.currentRoomMessages.filter(m => String(m.id) !== String(msgId));
    drawMessages(window.currentRoomMessages);
    try { await window.supabaseClient.from('messages').delete().eq('id', msgId); } catch (err) {}
};

window.handleSendAction = async function() {
    refreshMyUser();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text && !selectedMediaFile) return;

    input.value = '';
    const tempMsg = { id: 'temp_' + Date.now(), receiver: window.activeChatTarget, content: text || null, created_at: new Date().toISOString() };
    window.currentRoomMessages.unshift(tempMsg);
    drawMessages(window.currentRoomMessages);

    let uploadedUrl = null;
    if (selectedMediaFile) { uploadedUrl = document.getElementById('chat-image-preview').src; cancelImageSelection(); }

    try {
        await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId, 
            receiver: window.activeChatTarget,
            content: tempMsg.content,
            image_url: uploadedUrl,
            is_read: false
        }]);
    } catch (err) {
        window.currentRoomMessages = window.currentRoomMessages.filter(m => String(m.id) !== String(tempMsg.id));
        drawMessages(window.currentRoomMessages);
    }
};

window.toggleVoiceRecord = async function() {
    refreshMyUser();
    const micBtn = document.getElementById('mic-btn');

    if (window.isRecording) {
        mediaRecorder.stop();
        window.isRecording = false;
        micBtn.classList.remove('text-red-500', 'animate-pulse');
        micBtn.classList.add('text-gray-400');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const reader = new FileReader();
            reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
            reader.onloadend = async () => {
                const base64Audio = reader.result;
                const tempMsg = { id: 'temp_' + Date.now(), receiver: window.activeChatTarget, content: '[VOICE]:' + base64Audio, created_at: new Date().toISOString() };
                window.currentRoomMessages.unshift(tempMsg);
                drawMessages(window.currentRoomMessages);
                try {
                    await window.supabaseClient.from('messages').insert([{ room_id: window.activeRoomId, receiver: window.activeChatTarget, content: '[VOICE]:' + base64Audio }]);
                } catch (err) { drawMessages(window.currentRoomMessages); }
            };
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        window.isRecording = true;
        micBtn.classList.remove('text-gray-400');
        micBtn.classList.add('text-red-500', 'animate-pulse');
    } catch (err) { alert('無法存取麥克風設備'); }
};

window.handleImageSelection = function(input) {
    if(!input.files[0]) return;
    selectedMediaFile = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('chat-image-preview').src = e.target.result;
        document.getElementById('chat-image-preview-container').classList.remove('hidden');
        document.getElementById('chat-image-preview-container').classList.add('inline-block');
    };
    reader.readAsDataURL(selectedMediaFile);
};

window.cancelImageSelection = function() {
    selectedMediaFile = null;
    document.getElementById('chat-image-input').value = '';
    document.getElementById('chat-image-preview-container').classList.remove('inline-block');
    document.getElementById('chat-image-preview-container').classList.add('hidden');
};

function setupRoomRealtime() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId, { config: { broadcast: { ack: false } } })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, async payload => {
        if (payload.new.receiver === myUserId) {
            await window.supabaseClient.from('messages').update({ is_read: true }).eq('id', payload.new.id);
        } else {
            window.currentRoomMessages = window.currentRoomMessages.filter(m => !String(m.id).startsWith('temp_'));
        }
        window.currentRoomMessages.unshift(payload.new); 
        drawMessages(window.currentRoomMessages);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        window.currentRoomMessages = window.currentRoomMessages.filter(m => String(m.id) !== String(payload.old.id));
        drawMessages(window.currentRoomMessages);
    }).subscribe();
}

window.closeChat = function() {
    window.activeChatTarget = null;
    window.activeRoomId = null;
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        document.getElementById('chat-messages').innerHTML = ''; 
        cancelImageSelection();
        if(window.isRecording && mediaRecorder) toggleVoiceRecord();
    }, 300);
    renderMessages(); 
};
