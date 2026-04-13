// ==========================================
// js/messages.js - 聊天列表與語音完整版
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     

let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;
let myUserId = localStorage.getItem('userId');

document.addEventListener('DOMContentLoaded', () => {
    myUserId = localStorage.getItem('userId');
});

function generateRoomId(id1, id2) { 
    return [id1, id2].sort().join('_'); 
}

// 核心修復：載入歷史聊天列表
window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    if (!container) return;
    myUserId = localStorage.getItem('userId');
    if (!myUserId) return;

    container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        // 安全抓取所有與自己相關的訊息，由新到舊排序
        const { data: msgs, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender.eq.${myUserId},receiver.eq.${myUserId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!msgs || msgs.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10 text-sm">目前還沒有任何對話，試著搜尋用戶吧！</div>`;
            return;
        }

        // 分類出每個用戶的最後一則訊息
        const chatsMap = new Map();
        const targetIds = new Set();
        
        msgs.forEach(m => {
            const targetId = m.sender === myUserId ? m.receiver : m.sender;
            targetIds.add(targetId);
            if (!chatsMap.has(targetId)) {
                chatsMap.set(targetId, {
                    lastMsg: m.media_type === 'audio' ? '[語音訊息]' : (m.media_type === 'image' ? '[圖片]' : m.content),
                    is_read: m.sender === myUserId ? true : m.is_read
                });
            }
        });

        // 抓取對象的個人資料
        const { data: profiles } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', Array.from(targetIds));
        
        if (!profiles) return;

        container.innerHTML = profiles.map(profile => {
            const chatInfo = chatsMap.get(profile.id);
            return `
            <div class="flex items-center gap-4 p-3 bg-white rounded-2xl shadow-sm mb-3 cursor-pointer active:scale-95 transition" onclick="openChat('${profile.id}', '${profile.display_name}')">
                <img src="${profile.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1 overflow-hidden">
                    <div class="font-bold text-gray-800 text-sm truncate">${profile.display_name}</div>
                    <div class="text-xs truncate ${chatInfo.is_read ? 'text-gray-400' : 'text-sexify font-bold'}">${chatInfo.lastMsg}</div>
                </div>
                ${!chatInfo.is_read ? `<div class="w-2.5 h-2.5 bg-sexify rounded-full"></div>` : ''}
            </div>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="p-6 text-center text-red-400 mt-10 text-sm">載入失敗</div>`;
    }
}

window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input').value.trim();
    const container = document.getElementById('chat-list');
    
    if (!keyword) { renderMessages(); return; }

    container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const safeKeyword = keyword.replace(/,/g, ''); 
        const { data, error } = await window.supabaseClient.from('profiles').select('id, display_name, username, avatar_url').or(`username.ilike.%${safeKeyword}%,display_name.ilike.%${safeKeyword}%`);
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10 text-sm">找不到用戶</div>`;
            return;
        }

        container.innerHTML = data.map(user => `
            <div class="flex items-center gap-4 p-3 bg-white rounded-2xl shadow-sm mb-3 cursor-pointer active:scale-95 transition" onclick="openChat('${user.id}', '${user.display_name}')">
                <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1 overflow-hidden">
                    <div class="font-bold text-gray-800 text-sm truncate">${user.display_name}</div>
                    <div class="text-xs text-gray-400 truncate">點擊開始聊天</div>
                </div>
            </div>
        `).join('');
    } catch(e) {}
}

window.openChat = async function(targetUid, displayName) {
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myUserId, targetUid);
    
    document.getElementById('chat-user-name').innerText = displayName;
    document.getElementById('chat-modal').classList.remove('hidden', 'translate-x-full');
    
    const { data: msgs } = await window.supabaseClient
        .from('messages')
        .select('*')
        .eq('room_id', window.activeRoomId)
        .order('created_at', { ascending: true });
        
    window.currentRoomMessages = msgs || [];
    drawMessages(window.currentRoomMessages);

    if (window.roomChannel) window.roomChannel.unsubscribe();
    window.roomChannel = window.supabaseClient.channel(`room_${window.activeRoomId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            window.currentRoomMessages.push(payload.new);
            drawMessages(window.currentRoomMessages);
        }).subscribe();
}

window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    if (window.roomChannel) window.roomChannel.unsubscribe();
    setTimeout(() => {
        document.getElementById('chat-modal').classList.add('hidden');
        renderMessages(); // 關閉聊天室時重新整理列表，消除未讀標記
    }, 300);
}

window.drawMessages = function(msgs) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = msgs.map(m => {
        const isMe = m.sender === myUserId;
        let contentHtml = `<div class="px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}">${m.content}</div>`;
        
        if (m.media_type === 'audio') {
            contentHtml = `
                <div class="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-sm ${isMe ? 'bg-sexify text-white' : 'bg-gray-100 text-gray-800'}">
                    <button onclick="playVoice('${m.media_url}', this)" class="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 active:scale-90 transition">
                        <i class="fa-solid fa-play text-xs"></i>
                    </button>
                    <span class="text-[10px] font-bold">語音訊息</span>
                </div>
            `;
        }
        return `<div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 items-end gap-2 animate-in slide-in-from-bottom-2">${contentHtml}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !window.activeRoomId) return;

    try {
        await window.supabaseClient.from('messages').insert({
            room_id: window.activeRoomId,
            sender: myUserId,
            receiver: window.activeChatTarget,
            content: content,
            media_type: 'text'
        });
        input.value = '';
    } catch (e) { console.error("訊息發送失敗"); }
}

window.toggleVoiceRecord = async function() {
    const btn = document.querySelector('button[onclick*="toggleVoiceRecord"]');
    
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await uploadAndSendAudio(audioBlob);
            };
            
            mediaRecorder.start();
            window.isRecording = true;
            btn.classList.add('text-sexify', 'scale-125');
        } catch (err) {
            alert("無法啟動錄音，請檢查麥克風權限");
        }
    } else {
        mediaRecorder.stop();
        window.isRecording = false;
        btn.classList.remove('text-sexify', 'scale-125');
    }
}

async function uploadAndSendAudio(blob) {
    const fileName = `voice_${myUserId}_${Date.now()}.webm`;
    try {
        const { error: uploadError } = await window.supabaseClient.storage.from('messages').upload(fileName, blob);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = window.supabaseClient.storage.from('messages').getPublicUrl(fileName);
        await window.supabaseClient.from('messages').insert({
            room_id: window.activeRoomId,
            sender: myUserId,
            receiver: window.activeChatTarget,
            content: '[語音訊息]',
            media_url: publicUrl,
            media_type: 'audio'
        });
    } catch (e) {}
}

window.playVoice = function(url, btn) {
    const audio = new Audio(url);
    const icon = btn.querySelector('i');
    icon.className = 'fa-solid fa-spinner fa-spin';
    audio.oncanplaythrough = () => { audio.play(); icon.className = 'fa-solid fa-pause'; };
    audio.onended = () => { icon.className = 'fa-solid fa-play'; };
    audio.onerror = () => { icon.className = 'fa-solid fa-triangle-exclamation'; alert("語音讀取失敗"); };
}
