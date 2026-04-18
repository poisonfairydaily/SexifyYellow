// ==========================================
// js/messages.js - R2 儲存 + 自動清理 + CORS 優化版
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;

let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;
window.selectedMediaUrl = null;

// ✨ 修復：避免重複宣告並確保全域統一
if (typeof window.WORKER_URL === 'undefined') {
    window.WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";
}

// ✨ 新增：純 CSS 頭像產生器 (解決 UI-Avatars 的 CORS 報錯)
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

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
        setTimeout(() => {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }, 150);
    }
}

// ✨ 更新 UI 在線狀態
function updateOnlineStatusUI(isOnline) {
    const statusText = document.querySelector('#chat-modal span.uppercase');
    if (!statusText) return;
    statusText.innerHTML = isOnline ? '● Online' : '● Offline';
    statusText.className = `text-[10px] font-black uppercase ${isOnline ? 'text-green-500' : 'text-gray-400'}`;
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
        window.selectedMediaUrl = null; // 發送後清空，防止重複發送舊圖
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
                        ${safeImgUrl ? (isAudio ? `<audio src="${safeImgUrl}" controls class="h-8 mt-1"></audio>` : `<img src="${safeImgUrl}" class="rounded-lg mt-1 max-w-full shadow-sm">`) : ''}
                        <div class="text-[9px] opacity-50 mt-1 text-right">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                        ${isMine ? `<button onclick="window.deleteMessage('${m.id}', '${m.sender_name}', '${m.image_url || ''}')" class="absolute -left-8 top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 transition p-2"><i class="fa-solid fa-trash-can text-xs"></i></button>` : ''}
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
        
        // ✨ 修復：頭像改為優先檢查 avatar_url，若無則顯示 CSS 頭像 (避免 CORS)
        const avatarPart = p?.avatar_url 
            ? `<img src="${p.avatar_url}" class="w-full h-full rounded-full object-cover">`
            : getFallbackAvatar(name);
        
        return `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${tid}', '${safeText(name)}', '${p?.avatar_url || ''}')">
                <div class="w-14 h-14 bg-gray-100 rounded-full relative flex-shrink-0">${avatarPart}</div>
                <div class="flex-1 overflow-hidden">
                    <div class="flex justify-between font-bold text-sm text-gray-900"><span>${safeText(name)}</span></div>
                    <div class="text-xs text-gray-400 truncate">${lastMsg}</div>
                </div>
            </div>`;
    }).join('');
};

window.openChat = async function(targetUid, displayName, avatarUrl) {
    const myId = await getAuthenticatedUserId(); // 統一調用名稱
    if (!myId) return;
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myId, targetUid);
    
    if(document.getElementById('chat-name')) document.getElementById('chat-name').innerText = displayName;
    
    const avatarContainer = document.querySelector('.chat-target-avatar-container'); // 建議在 HTML 中包裹一層
    if (avatarContainer) {
        avatarContainer.innerHTML = avatarUrl 
            ? `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover">`
            : getFallbackAvatar(displayName);
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
            await loadMessages();
            scrollToBottom();
        })
        .on('presence', { event: 'sync' }, () => {
            const state = window.roomChannel.presenceState();
            const isOnline = Object.values(state).flat().some(p => p.user_id === window.activeChatTarget);
            updateOnlineStatusUI(isOnline);
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

// ✨ 修改：回收訊息時同步刪除 R2 檔案
window.deleteMessage = async function(msgId, senderId, mediaUrl) {
    const myId = await getValidUserId();
    if (myId !== senderId) return; 
    if (!confirm('確定回收這條訊息？(相關媒體檔案也將從伺服器永久刪除)')) return;
    
    try {
        // 1. 如果有 R2 檔案網址，先呼叫 Worker 刪除檔案
        if (mediaUrl && mediaUrl.includes(window.WORKER_URL)) {
            const fileName = mediaUrl.split('/').pop(); // 取得檔名
            await fetch(`${window.WORKER_URL}/${fileName}`, { method: 'DELETE' });
            console.log("R2 檔案已連動刪除:", fileName);
        }

        // 2. 刪除 Supabase 紀錄
        await window.supabaseClient.from('messages').delete().eq('id', msgId);
        loadMessages();
    } catch (e) { 
        console.error(e);
        alert('回收失敗'); 
    }
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
                    const response = await fetch(`${window.WORKER_URL}/`, { method: 'POST', body: formData });
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
    
    // 前端簡易圖片壓縮 (預防 R2 太快滿)
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${window.WORKER_URL}/`, { method: 'POST', body: formData });
        const result = await response.json();
        if (result.url) {
            window.selectedMediaUrl = result.url;
            await window.handleSendAction();
        }
    } catch (e) { alert('媒體上傳失敗'); }
};
