// ==========================================
// js/messages.js - R2 儲存 + 實時在線狀態優化版
// 優化內容：Presence 偵測修正、R2 上傳、自動滾動
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;

let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;
window.selectedMediaUrl = null;

// ✨ 配置：Worker 網址
const WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";

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

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
        setTimeout(() => {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }, 150);
    }
}

// ✨ 更新 UI 在線狀態 (修正選擇器以匹配 HTML)
function updateOnlineStatusUI(isOnline) {
    const statusText = document.querySelector('#chat-modal span.uppercase');
    if (!statusText) return;

    if (isOnline) {
        statusText.innerHTML = '● Online';
        statusText.classList.remove('text-gray-400');
        statusText.classList.add('text-green-500');
    } else {
        statusText.innerHTML = '● Offline';
        statusText.classList.remove('text-green-500');
        statusText.classList.add('text-gray-400');
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

        const { error } = await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId,
            sender_name: myId,
            receiver: window.activeChatTarget,
            content: content,
            image_url: window.selectedMediaUrl,
            is_read: false
        }]);

        if (error) throw error;
        input.value = '';
        window.selectedMediaUrl = null;
        await loadMessages();
        scrollToBottom();
    } catch (e) {
        alert('傳送失敗');
    } finally {
        btn.disabled = false;
    }
};

function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    window.supabaseClient.auth.getUser().then(({data: {user}}) => {
        const myId = user?.id;
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
            const isAudio = safeImgUrl && (safeImgUrl.endsWith('.webm') || safeImgUrl.includes('voice_'));

            return `
                ${dateSeparator}
                <div class="flex ${wrapperClass} mb-4 px-4 animate-fade-in">
                    <div class="max-w-[80%] ${msgClass} px-4 py-2 rounded-2xl shadow-sm relative group">
                        ${cleanContent ? `<div class="text-sm whitespace-pre-wrap">${cleanContent}</div>` : ''}
                        ${safeImgUrl ? (isAudio ? `<audio src="${safeImgUrl}" controls class="h-8 mt-1"></audio>` : `<img src="${safeImgUrl}" class="rounded-lg mt-1 max-w-full">`) : ''}
                        <div class="text-[9px] opacity-50 mt-1 text-right">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                        ${isMine ? `<button onclick="window.deleteMessage('${m.id}', '${m.sender_name}')" class="absolute -left-8 top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-rotate-left text-xs"></i></button>` : ''}
                    </div>
                </div>`;
        }).join('');
    });
}

window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    const myId = await getValidUserId();
    if (!container || !myId) return;

    const { data: msgData } = await window.supabaseClient.from('messages')
        .select('*').or(`sender_name.eq.${myId},receiver.eq.${myId}`)
        .order('created_at', { ascending: false });

    if (!msgData) return;

    const rooms = {};
    msgData.forEach(m => { if (!rooms[m.room_id]) rooms[m.room_id] = m; });
    
    const sortedRooms = Object.values(rooms);
    const targetIds = sortedRooms.map(m => m.sender_name === myId ? m.receiver : m.sender_name);
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', targetIds);
    const profMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);

    container.innerHTML = sortedRooms.map(m => {
        const tid = m.sender_name === myId ? m.receiver : m.sender_name;
        const p = profMap[tid];
        const name = p?.display_name || '用戶';
        const lastMsg = safeText(m.content || (m.image_url ? '[媒體訊息]' : ''));
        const finalAvatar = p?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        
        return `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${tid}', '${safeText(name)}', '${finalAvatar}')">
                <img src="${finalAvatar}" class="w-14 h-14 rounded-full object-cover bg-gray-100" onerror="this.src='https://ui-avatars.com/api/?name=User'">
                <div class="flex-1 overflow-hidden">
                    <div class="flex justify-between font-bold text-sm text-gray-900"><span>${safeText(name)}</span></div>
                    <div class="text-xs text-gray-400 truncate">${lastMsg}</div>
                </div>
            </div>`;
    }).join('');
};

window.openChat = async function(targetUid, displayName, avatarUrl) {
    const myId = await getValidUserId();
    if (!myId) return;
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myId, targetUid);
    
    const nameEl = document.getElementById('chat-name');
    if(nameEl) nameEl.innerText = displayName;
    
    const avatarEl = document.getElementById('chat-target-avatar');
    if (avatarEl) {
        avatarEl.src = avatarUrl && avatarUrl !== 'undefined' ? avatarUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;
    }
    
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myId);
    await loadMessages();
    scrollToBottom();
    setupChatRealtime();
};

async function loadMessages() {
    if (!window.activeRoomId) return;
    const { data, error } = await window.supabaseClient.from('messages')
        .select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: true });
    if (!error) drawMessages(data);
}

// ✨ 核心修復：Realtime Presence 偵測
function setupChatRealtime() {
    if (!window.activeRoomId) return;
    if (window.roomChannel) window.roomChannel.unsubscribe();

    // 建立頻道名稱必須雙方一致
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId);

    window.roomChannel
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages', 
            filter: `room_id=eq.${window.activeRoomId}` 
        }, async () => {
            await loadMessages();
            scrollToBottom();
        })
        .on('presence', { event: 'sync' }, () => {
            const state = window.roomChannel.presenceState();
            // 檢查池子裡是否有對方的 ID
            const isOnline = Object.values(state).flat().some(p => p.user_id === window.activeChatTarget);
            updateOnlineStatusUI(isOnline);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            if (newPresences.some(p => p.user_id === window.activeChatTarget)) updateOnlineStatusUI(true);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            if (leftPresences.some(p => p.user_id === window.activeChatTarget)) updateOnlineStatusUI(false);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const myId = await getValidUserId();
                await window.roomChannel.track({
                    user_id: myId,
                    online_at: new Date().toISOString(),
                });
            }
        });
}

window.deleteMessage = async function(msgId, senderId) {
    const myId = await getValidUserId();
    if (myId !== senderId) return; 
    if (!confirm('回收這條訊息？')) return;
    try {
        await window.supabaseClient.from('messages').delete().eq('id', msgId);
        loadMessages();
    } catch (e) { alert('回收失敗'); }
};

window.closeChat = function() {
    if (window.roomChannel) window.roomChannel.unsubscribe();
    window.activeRoomId = null;
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.toggleVoiceRecord = async function() {
    const btnIcon = document.querySelector('[onclick*="toggleVoiceRecord"] i');
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const myId = await getValidUserId();
                const formData = new FormData();
                formData.append('file', audioBlob, `voice_${myId}_${Date.now()}.webm`);

                try {
                    const response = await fetch(`${WORKER_URL}/`, { method: 'POST', body: formData });
                    const result = await response.json();
                    if (result.url) {
                        window.selectedMediaUrl = result.url;
                        await window.handleSendAction();
                    }
                } catch (e) { alert('語音上傳失敗'); }
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            window.isRecording = true;
            if(btnIcon) btnIcon.classList.add('text-red-500', 'animate-pulse');
        } catch (e) { alert('無法開啟麥克風'); }
    } else {
        if(mediaRecorder) mediaRecorder.stop();
        window.isRecording = false;
        if(btnIcon) btnIcon.classList.remove('text-red-500', 'animate-pulse');
    }
};

window.handleImageSelection = async function(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch(`${WORKER_URL}/`, { method: 'POST', body: formData });
        const result = await response.json();
        if (result.url) {
            window.selectedMediaUrl = result.url;
            await window.handleSendAction();
        }
    } catch (e) { alert('媒體上傳失敗'); }
};
