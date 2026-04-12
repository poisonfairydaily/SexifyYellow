// ==========================================
// js/messages.js - 完整進化版 
// 包含用戶搜尋、即時通訊、雲端同步、媒體/語音傳輸
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.isGroupChat = false;    
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

// 改用 UUID 生成唯一房間 ID，避免名字更改導致房間錯亂
function generateRoomId(id1, id2) { 
    return [id1, id2].sort().join('_'); 
}

// --- 用戶搜尋邏輯 (發起對話用) ---
window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input').value.trim();
    const container = document.getElementById('chat-list');
    
    if (!keyword) {
        renderMessages(); 
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
            container.innerHTML = `<div class="p-6 text-center text-gray-400 text-sm mt-10">找不到相關用戶</div>`;
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

// --- 收件匣列表 (Inbox) 重構：以 ID 為主，徹底解決亂碼 ---
window.renderMessages = async function() {
    refreshMyUser();
    const container = document.getElementById('chat-list');
    if (!container || !myUserId) return;

    const currentSearch = document.getElementById('inbox-search-input').value;
    if (currentSearch) return; 

    container.innerHTML = `<div class="text-center py-10 mt-10"><i class="fa-solid fa-circle-notch fa-spin text-gray-300 text-2xl"></i></div>`;

    try {
        // 抓取與自己有關的所有訊息
        const { data: inboxData, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .ilike('room_id', `%${myUserId}%`)
            .order('created_at', { ascending: false }); 

        if (error) throw error;

        let roomsMap = {};
        let targetIds = new Set();
        
        // 分組並取得最後一條訊息，同時提取對方的 ID
        (inboxData || []).forEach(msg => {
            if (!roomsMap[msg.room_id]) {
                roomsMap[msg.room_id] = msg;
                const ids = msg.room_id.split('_');
                const targetId = ids[0] === myUserId ? ids[1] : ids[0];
                msg._targetId = targetId;
                if (targetId) targetIds.add(targetId);
            }
        });

        if(targetIds.size === 0) {
            container.innerHTML = `<div class="text-center py-10 mt-10 text-gray-400 text-sm flex flex-col items-center"><i class="fa-solid fa-inbox text-3xl mb-3 opacity-50"></i>尚無對話記錄<br>在上方搜尋用戶以開始聊天</div>`;
            return;
        }

        // 根據提取出的對方 ID，直接向 Profiles 表請求最新的名字與頭像
        const { data: profiles } = await window.supabaseClient
            .from('profiles')
            .select('id, display_name, avatar_url, username')
            .in('id', Array.from(targetIds));

        let profileMap = {};
        if (profiles) profiles.forEach(p => profileMap[p.id] = p);

        let inboxArray = Object.values(roomsMap).map(msg => {
            const p = profileMap[msg._targetId] || {};
            let lastMsgText = msg.content;
            if (msg.content && msg.content.startsWith('[VOICE]:')) lastMsgText = '語音訊息 🎤';
            else if (msg.image_url) lastMsgText = '傳送了媒體檔案 📁';

            return {
                id: msg._targetId,
                displayName: p.display_name || p.username || '未知用戶',
                avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.display_name || 'U'}&background=random`,
                lastMsg: lastMsgText || '新訊息',
                time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
                timestamp: new Date(msg.created_at).getTime()
            };
        }).sort((a, b) => b.timestamp - a.timestamp);

        container.innerHTML = inboxArray.map(chat => `
            <div class="flex items-center gap-4 p-4 bg-white border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${chat.id}', false, '${chat.displayName}', '${chat.avatar}')">
                <div class="relative flex-shrink-0">
                    <img src="${chat.avatar}" class="w-14 h-14 rounded-full border border-gray-100 object-cover shadow-sm">
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
    refreshMyUser();
    window.activeChatTarget = targetId;
    window.isGroupChat = isGroup;
    window.activeRoomId = generateRoomId(myUserId, targetId);
    window.typingUsers.clear(); 

    const modal = document.getElementById('chat-modal');
    const chatMessages = document.getElementById('chat-messages');

    document.getElementById('chat-name').innerText = displayName;
    document.getElementById('chat-target-avatar').src = avatarUrl || `https://ui-avatars.com/api/?name=${displayName}&background=random`;

    const chatInput = document.getElementById('chat-input');
    chatInput.oninput = () => {
        if (window.roomChannel) {
            window.roomChannel.send({ type: 'broadcast', event: 'typing', payload: { sender: myUserId } });
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
        // 使用 ID 判斷是否為自己發送
        const isMe = msg.sender_name === myUserId || msg.sender_id === myUserId;
        const align = isMe ? 'justify-end' : 'justify-start';
        const bg = isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-900';
        const borderRadius = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
        const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        
        // 語音與文字解析
        let contentHtml = '';
        if (msg.content) {
            if (msg.content.startsWith('[VOICE]:')) {
                const audioSrc = msg.content.replace('[VOICE]:', '');
                contentHtml = `<audio controls src="${audioSrc}" class="max-w-[220px] h-10 mt-1"></audio>`;
            } else {
                contentHtml = `<span>${msg.content}</span>`;
            }
        }

        // 修改：手機版回收按鈕改為常態可見的柔和樣式，避免 hover 失效
        return `
            <div id="msg-${msg.id}" class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2 msg-container">
                <div class="flex items-end gap-2 w-full ${align}">
                    ${isMe ? `<div class="flex flex-col items-end gap-1"><button onclick="deleteMessage('${msg.id}')" class="text-[10px] text-red-500 bg-red-50 px-2 py-1.5 rounded-md shadow-sm border border-red-100 active:scale-95 transition whitespace-nowrap">回收</button><span class="text-[9px] text-gray-400 whitespace-nowrap">${timeStr}</span></div>` : ''}
                    <div class="${bg} px-4 py-2.5 ${borderRadius} shadow-sm max-w-[75%] break-words leading-relaxed text-sm flex flex-col">
                        ${msg.image_url ? `<img src="${msg.image_url}" loading="lazy" class="max-w-full rounded-lg mb-1 object-cover">` : ''}
                        ${contentHtml}
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
    
    // 修復：嚴格將兩邊轉為字串比對，徹底解決陣列無法濾除的問題
    window.currentRoomMessages = window.currentRoomMessages.filter(m => String(m.id) !== String(msgId));
    drawMessages(window.currentRoomMessages);

    try {
        const { error } = await window.supabaseClient.from('messages').delete().eq('id', msgId); 
        if (error) throw error;
    } catch (err) {
        alert("回收同步失敗，請檢查網路");
    }
};

window.handleSendAction = async function() {
    refreshMyUser();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text && !selectedMediaFile) return;

    input.value = '';
    
    const tempMsg = { id: 'temp_' + Date.now(), sender_name: myUserId, content: text || null, created_at: new Date().toISOString() };
    window.currentRoomMessages.unshift(tempMsg);
    drawMessages(window.currentRoomMessages);

    let uploadedUrl = null;
    if (selectedMediaFile) {
        uploadedUrl = document.getElementById('chat-image-preview').src; 
        cancelImageSelection();
    }

    try {
        await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId, 
            sender_name: myUserId, 
            receiver: window.activeChatTarget,
            content: tempMsg.content,
            image_url: uploadedUrl
        }]);
    } catch (err) {
        window.currentRoomMessages = window.currentRoomMessages.filter(m => String(m.id) !== String(tempMsg.id));
        drawMessages(window.currentRoomMessages);
    }
};

// --- 新增：語音錄製與發送邏輯 ---
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

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result;
                const tempMsg = { id: 'temp_' + Date.now(), sender_name: myUserId, content: '[VOICE]:' + base64Audio, created_at: new Date().toISOString() };
                
                window.currentRoomMessages.unshift(tempMsg);
                drawMessages(window.currentRoomMessages);

                try {
                    await window.supabaseClient.from('messages').insert([{
                        room_id: window.activeRoomId,
                        sender_name: myUserId,
                        receiver: window.activeChatTarget,
                        content: '[VOICE]:' + base64Audio
                    }]);
                } catch (err) {
                    window.currentRoomMessages = window.currentRoomMessages.filter(m => String(m.id) !== String(tempMsg.id));
                    drawMessages(window.currentRoomMessages);
                    alert("語音發送失敗");
                }
            };
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        window.isRecording = true;
        micBtn.classList.remove('text-gray-400');
        micBtn.classList.add('text-red-500', 'animate-pulse');
    } catch (err) {
        alert('無法存取麥克風設備，請確認權限已開啟: ' + err.message);
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
        if (payload.payload.sender !== myUserId) {
            window.typingUsers.add(payload.payload.sender);
            drawMessages(window.currentRoomMessages);
            clearTimeout(typingClearTimer);
            typingClearTimer = setTimeout(() => { window.typingUsers.delete(payload.payload.sender); drawMessages(window.currentRoomMessages); }, 3000); 
        }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        if (payload.new.sender_name === myUserId || payload.new.sender_id === myUserId) {
            window.currentRoomMessages = window.currentRoomMessages.filter(m => !String(m.id).startsWith('temp_'));
        }
        window.currentRoomMessages.unshift(payload.new); 
        drawMessages(window.currentRoomMessages);
        if (payload.new.sender_name !== myUserId) window.typingUsers.delete(payload.new.sender_name); 
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
        // 同步刪除濾除
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
