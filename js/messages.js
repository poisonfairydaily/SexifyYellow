// ==========================================
// js/messages.js - 核心通訊全功能版 (發送、錄音、回收)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;

let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;

// 1. 取得身份驗證
async function getValidUserId() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user ? user.id : null;
}

function generateRoomId(id1, id2) {
    if (!id1 || !id2) return null;
    return [id1, id2].sort().join('_');
}

// 2. 搜尋與開啟聊天
window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input')?.value.trim();
    const container = document.getElementById('chat-list');
    if (!container || !keyword) { renderMessages(); return; }

    container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .or(`username.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
            .limit(10);
        if (error) throw error;
        container.innerHTML = data.map(u => {
            const safeName = window.escapeHTML(u.display_name || '未命名');
            const safeAvatar = window.escapeHTML(u.avatar_url || `https://ui-avatars.com/api/?name=${safeName}`);
            return `
                <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${u.id}', '${safeName}', '${safeAvatar}')">
                    <img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover">
                    <div>
                        <div class="font-bold text-gray-800">${safeName}</div>
                        <div class="text-xs text-gray-400">@${window.escapeHTML(u.username || '')}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { container.innerHTML = `<div class="p-10 text-center text-red-400">搜尋失敗</div>`; }
};

// 3. 發送邏輯
window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content && !window.selectedMediaUrl) return;

    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    
    await sendMessage(content, window.selectedMediaUrl);
    
    input.value = '';
    window.selectedMediaUrl = null; // 重置媒體預覽
    btn.disabled = false;
};

async function sendMessage(content, mediaUrl) {
    const myId = await getValidUserId();
    if (!myId || !window.activeRoomId) return alert('發送失敗: 未登入或目標不明');

    try {
        const { error } = await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId,
            sender_name: myId,
            receiver: window.activeChatTarget,
            content: content || '',
            image_url: mediaUrl,
            is_read: false
        }]);
        if (error) throw error;
    } catch (e) { console.error(e); alert('發送失敗'); }
}

// 4. 錄音功能
window.toggleVoiceRecord = async function() {
    const btn = document.querySelector('[onclick*="toggleVoiceRecord"]');
    
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await uploadVoiceMessage(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            window.isRecording = true;
            btn.classList.add('text-red-500', 'animate-pulse');
        } catch (e) { alert('無法取得麥克風權限'); }
    } else {
        mediaRecorder.stop();
        window.isRecording = false;
        btn.classList.remove('text-red-500', 'animate-pulse');
    }
};

async function uploadVoiceMessage(blob) {
    const myId = await getValidUserId();
    const fileName = `voice_${Date.now()}.webm`;
    try {
        const { data, error } = await window.supabaseClient.storage.from('chat-media').upload(`${myId}/${fileName}`, blob);
        if (error) throw error;
        const { data: { publicUrl } } = window.supabaseClient.storage.from('chat-media').getPublicUrl(`${myId}/${fileName}`);
        await sendMessage('[語音訊息]', publicUrl);
    } catch (e) { alert('錄音上傳失敗'); }
}

// 5. 訊息回收 (刪除)
window.deleteMessage = async function(msgId, senderId) {
    const myId = await getValidUserId();
    if (myId !== senderId) return; // 只能刪除自己的

    if (!confirm('確定要回收這條訊息嗎？')) return;

    try {
        const { error } = await window.supabaseClient.from('messages').delete().eq('id', msgId);
        if (error) throw error;
        loadMessages();
    } catch (e) { alert('回收失敗'); }
};

// 6. 渲染與繪製
window.openChat = async function(targetUid, displayName, avatarUrl) {
    const myId = await getValidUserId();
    if (!myId) return alert('請先登入');
    
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myId, targetUid);

    const modal = document.getElementById('chat-modal');
    document.getElementById('chat-name').innerText = displayName || '用戶';
    const avatarEl = document.getElementById('chat-target-avatar');
    if (avatarEl && avatarUrl) avatarEl.src = avatarUrl;

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    // 標記已讀
    await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myId);

    loadMessages();
    setupChatRealtime();
};

async function loadMessages() {
    if (!window.activeRoomId) return;
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .eq('room_id', window.activeRoomId)
        .order('created_at', { ascending: false });
    if (!error) drawMessages(data);
}

async function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    const myId = await getValidUserId();
    if (!container) return;

    container.innerHTML = messages.map(m => {
        const isMine = m.sender_name === myId;
        const msgClass = isMine ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none';
        const wrapperClass = isMine ? 'justify-end' : 'justify-start';
        const safeContent = window.escapeHTML(m.content || '');
        const safeUrl = window.escapeHTML(m.image_url || '');

        // 判斷是否為語音 (簡單判斷)
        const isAudio = safeUrl.endsWith('.webm');

        return `
            <div class="flex ${wrapperClass} mb-4 group" oncontextmenu="event.preventDefault(); window.deleteMessage('${m.id}', '${m.sender_name}')">
                <div class="max-w-[80%] ${msgClass} px-4 py-2 rounded-2xl shadow-sm relative">
                    ${safeContent ? `<div class="text-sm">${safeContent}</div>` : ''}
                    ${safeUrl ? (isAudio ? `<audio src="${safeUrl}" controls class="h-8 mt-1"></audio>` : `<img src="${safeUrl}" class="rounded-lg mt-1 max-w-full" onclick="window.open('${safeUrl}')">`) : ''}
                    <div class="text-[9px] opacity-50 mt-1 text-right">
                        ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        ${isMine ? `<i class="fa-solid fa-check-double ml-1 ${m.is_read ? 'text-blue-200' : 'text-white'}"></i>` : ''}
                    </div>
                    ${isMine ? `<button onclick="window.deleteMessage('${m.id}', '${m.sender_name}')" class="absolute -left-8 top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
                </div>
            </div>`;
    }).join('');
}

window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    const myId = await getValidUserId();
    if (!container || !myId) return;

    const { data: msgData } = await window.supabaseClient.from('messages').select('*').or(`sender_name.eq.${myId},receiver.eq.${myId}`).order('created_at', { ascending: false });
    if (!msgData) return;

    const rooms = {};
    msgData.forEach(m => { if (!rooms[m.room_id]) rooms[m.room_id] = m; });
    const sortedRooms = Object.values(rooms);
    const targetIds = [...new Set(sortedRooms.map(m => m.sender_name === myId ? m.receiver : m.sender_name))];
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', targetIds);
    const profMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);

    container.innerHTML = sortedRooms.map(m => {
        const tid = m.sender_name === myId ? m.receiver : m.sender_name;
        const p = profMap[tid];
        const name = window.escapeHTML(p?.display_name || '用戶');
        return `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer ${!m.is_read && m.receiver === myId ? 'bg-red-50/50' : ''}" onclick="openChat('${tid}', '${name}', '${p?.avatar_url}')">
                <img src="${p?.avatar_url || 'https://ui-avatars.com/api/?name='+name}" class="w-14 h-14 rounded-full object-cover">
                <div class="flex-1 truncate">
                    <div class="flex justify-between font-bold text-gray-800 text-sm"><span>${name}</span><span class="text-[10px] font-normal text-gray-400">${new Date(m.created_at).toLocaleDateString()}</span></div>
                    <div class="text-xs text-gray-400 truncate">${m.content || '[媒體]'}</div>
                </div>
            </div>`;
    }).join('');
};

function setupChatRealtime() {
    if (!window.activeRoomId) return;
    if (window.roomChannel) window.roomChannel.unsubscribe();
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, () => loadMessages())
        .subscribe();
}

window.closeChat = function() {
    window.activeRoomId = null;
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
};
