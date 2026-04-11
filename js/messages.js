// ==========================================
// js/messages.js - 完整進化版 
// 包含用戶搜尋、即時通訊、雲端同步、媒體傳輸
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.isGroupChat = false;    
window.roomChannel = null;     
window.globalChannel = null;   

let selectedMediaFile = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

window.typingUsers = new Set();
let typingClearTimer = null;

let myChatName = localStorage.getItem('myChatName') || "神秘使用者";

function refreshMyName() {
    myChatName = localStorage.getItem('myChatName') || "神秘使用者";
}

document.addEventListener('DOMContentLoaded', () => {
    refreshMyName();
});

function generateRoomId(user1, user2) { 
    return [user1, user2].sort().join('_'); 
}

// --- 用戶搜尋邏輯 (發起對話用) ---
window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input').value.trim();
    const container = document.getElementById('chat-list');
    
    if (!keyword) {
        renderMessages(); // 回復收件匣歷史
        return;
    }

    container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i><p class="text-xs mt-2">搜尋用戶中...</p></div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .or(`display_name.ilike.%${keyword}%,username.ilike.%${keyword}%`)
            .neq('id', localStorage.getItem('userId'))
            .limit(10);

        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-gray-400 text-sm mt-10">找不到相關用戶，請嘗試輸入完整的 ID</div>`;
            return;
        }

        container.innerHTML = `<div class="px-4 py-2 text-xs font-bold text-gray-400 bg-gray-50 uppercase tracking-widest">搜尋結果</div>`;
        container.innerHTML += data.map(user => `
            <div onclick="openChat('${user.id}', false, '${user.display_name}', '${user.avatar_url}')" class="flex items-center gap-3 p-4 bg-white border-b border-gray-50 active:bg-gray-50 cursor-pointer transition">
                <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-900 text-sm">${user.display_name}</h4>
                    <p class="text-xs text-sexify font-mono mt-0.5">@${user.username || user.id.substring(0,8)}</p>
                </div>
                <button class="bg-sexify text-white text-xs px-4 py-2 rounded-full font-bold shadow-md active:scale-95">發訊息</button>
            </div>
        `).join('');

    } catch (err) {
        console.error("用戶搜尋失敗:", err);
        container.innerHTML = `<div class="p-6 text-center text-red-400 text-sm mt-10">搜尋發生錯誤，請確認網路連線。</div>`;
    }
}

// --- 收件匣列表 (Inbox) ---
window.renderMessages = async function() {
    refreshMyName();
    const container = document.getElementById('chat-list');
    if (!container) return;

    const currentSearch = document.getElementById('inbox-search-input').value;
    if (currentSearch) return; // 如果正在搜尋就不渲染歷史

    container.innerHTML = `<div class="text-center py-10 mt-10"><i class="fa-solid fa-circle-notch fa-spin text-gray-300 text-2xl"></i></div>`;

    try {
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName}`)
            .order('created_at', { ascending: false }); 

        if (error) throw error;

        let roomsMap = {};
        
        (inboxData || []).forEach(msg => {
            const targetId = msg.sender_name === myChatName ? msg.receiver : msg.sender_name;
            if (!targetId) return;

            const msgTime = new Date(msg.created_at).getTime();

            if (!roomsMap[targetId]) {
                roomsMap[targetId] = {
                    id: targetId,
                    displayName: targetId,
                    lastMsg: msg.content || (msg.image_url ? '傳送了媒體檔案 📁' : '新訊息'),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
                    timestamp: msgTime
                };
            }
        });

        let inboxArray = Object.values(roomsMap).sort((a, b) => b.timestamp - a.timestamp);

        if(inboxArray.length === 0) {
            container.innerHTML = `<div class="text-center py-10 mt-10 text-gray-400 text-sm flex flex-col items-center"><i class="fa-solid fa-inbox text-3xl mb-3 opacity-50"></i>尚無對話記錄<br>在上方搜尋用戶以開始聊天</div>`;
            return;
        }

        container.innerHTML = inboxArray.map(chat => `
            <div class="flex items-center gap-4 p-4 bg-white border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${chat.id}', false, '${chat.displayName}')">
                <div class="relative flex-shrink-0">
                    <img src="https://ui-avatars.com/api/?name=${chat.displayName}&background=random" class="w-14 h-14 rounded-full border border-gray-100 object-cover shadow-sm">
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-1">
                        <h3 class="font-bold text-gray-900 truncate pr-2">${chat.displayName}</h3>
                        <span class="text-[10px] text-gray-400 font-medium whitespace-nowrap">${chat.time}</span>
                    </div>
                    <p class="text-sm truncate text-gray-500">${chat.lastMsg}</p>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error("收件匣載入錯誤:", err);
        container.innerHTML = `<div class="text-center text-red-400 py-10 text-sm mt-10">資料庫讀取異常</div>`;
    }
};

// --- 聊天室內部控制 ---
window.openChat = async function(targetId, isGroup = false, displayName = targetId, avatarUrl = '') {
    refreshMyName();
    window.activeChatTarget = targetId;
    window.isGroupChat = isGroup;
    window.activeRoomId = generateRoomId(myChatName, targetId);
    window.typingUsers.clear(); 

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    document.getElementById('chat-name').innerText = displayName;
    document.getElementById('chat-target-avatar').src = avatarUrl || `https://ui-avatars.com/api/?name=${displayName}&background=random`;

    const chatInput = document.getElementById('chat-input');
    chatInput.oninput = () => {
        if (window.roomChannel) {
            window.roomChannel.send({ type: 'broadcast', event: 'typing', payload: { sender: myChatName } });
        }
    };
    
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>載入中...</div>`;

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false });
        if (error) throw error;
        
        window.currentRoomMessages = data || [];
        drawMessages(window.currentRoomMessages);
        setupRoomRealtime();
    } catch (err) { 
        chatMessages.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-red-400">無法載入訊息</div>`; 
    }
};

function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    
    let typingHtml = '';
    if (window.typingUsers.size > 0) {
        typingHtml = `
            <div class="flex items-end gap-1.5 mb-2 w-full justify-start">
                <div class="bg-white border border-gray-100 text-gray-500 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm shadow-sm flex items-center gap-1 animate-pulse">
                    對方正在輸入<span class="flex gap-0.5 ml-1"><div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div><div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div><div class="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div></span>
                </div>
            </div>
        `;
    }

    if (messages.length === 0 && !typingHtml) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs absolute inset-0 flex items-center justify-center">開始你們的第一句話吧！</div>`;
        return;
    }

    const messagesHtml = messages.map(msg => {
        const isMe = msg.sender_name === myChatName;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
        const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
        const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        
        return `
            <div id="msg-${msg.id}" class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1 msg-container">
                <div class="flex items-end gap-1.5 w-full ${align}">
                    ${isMe ? `<div class="flex flex-col items-end gap-1"><button onclick="deleteMessage('${msg.id}')" class="unsend-btn text-[10px] text-red-400 hover:text-red-600 bg-white shadow-sm px-1.5 rounded-md border border-red-100 opacity-0 hover:opacity-100 transition whitespace-nowrap">回收</button><span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span></div>` : ''}
                    <div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm">
                        ${msg.image_url ? `<img src="${msg.image_url}" loading="lazy" class="max-w-full rounded-lg mb-1 object-cover">` : ''}
                        ${msg.content ? `<span>${msg.content}</span>` : ''}
                    </div>
                    ${!isMe ? `<span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = typingHtml + messagesHtml;
}

window.deleteMessage = async function(msgId) {
    if (!confirm("確定要回收這條訊息嗎？")) return;
    const msgEl = document.getElementById('msg-' + msgId);
    if (msgEl) msgEl.style.display = 'none';

    try {
        const { error } = await window.supabaseClient.from('messages').delete().eq('id', msgId).eq('sender_name', myChatName); 
        if (error) throw error;
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== msgId);
        if(window.currentRoomMessages.length === 0) drawMessages([]);
    } catch (err) {
        if (msgEl) msgEl.style.display = ''; 
        alert("回收失敗，請檢查權限");
    }
};

window.handleSendAction = async function() {
    refreshMyName();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text && !selectedMediaFile) return;

    input.value = '';
    
    // 預先產生樂觀 UI
    const tempMsg = { id: 'temp_' + Date.now(), sender_name: myChatName, content: text || null, created_at: new Date().toISOString() };
    window.currentRoomMessages.unshift(tempMsg);
    drawMessages(window.currentRoomMessages);

    let uploadedUrl = null;
    if (selectedMediaFile) {
        try {
            // 此處為模擬上傳，實際需串接 Supabase Storage
            // const { data } = await window.supabaseClient.storage.from('chat-media').upload(fileName, selectedMediaFile);
            uploadedUrl = document.getElementById('chat-image-preview').src; // 暫時用 Base64
        } catch (e) {
            console.error("上傳失敗");
        }
        cancelImageSelection();
    }

    try {
        await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId, 
            sender_name: myChatName, 
            receiver: window.activeChatTarget,
            content: tempMsg.content,
            image_url: uploadedUrl
        }]);
    } catch (err) {
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== tempMsg.id);
        drawMessages(window.currentRoomMessages);
    }
};

window.handleImageSelection = function(input) {
    const file = input.files[0];
    if (!file) return;
    selectedMediaFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('chat-image-preview').src = e.target.result;
        document.getElementById('chat-image-preview-container').classList.remove('hidden');
        document.getElementById('chat-image-preview-container').classList.add('inline-block');
    };
    reader.readAsDataURL(file);
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
    .on('broadcast', { event: 'typing' }, payload => {
        if (payload.payload.sender !== myChatName) {
            window.typingUsers.add(payload.payload.sender);
            drawMessages(window.currentRoomMessages);
            clearTimeout(typingClearTimer);
            typingClearTimer = setTimeout(() => { window.typingUsers.delete(payload.payload.sender); drawMessages(window.currentRoomMessages); }, 3000); 
        }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        if (payload.new.sender_name === myChatName) window.currentRoomMessages = window.currentRoomMessages.filter(m => !m.id.toString().startsWith('temp_'));
        window.currentRoomMessages.unshift(payload.new); 
        drawMessages(window.currentRoomMessages);
        if (payload.new.sender_name !== myChatName) window.typingUsers.delete(payload.new.sender_name); 
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== payload.old.id);
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
    }, 300);
    renderMessages(); 
};
