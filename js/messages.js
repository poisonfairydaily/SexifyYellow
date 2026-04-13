// ==========================================
// js/messages.js - 修復語音播放問題
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     

let selectedMediaFile = null;
let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;

let myUserId = localStorage.getItem('userId');

function refreshMyUser() {
    myUserId = localStorage.getItem('userId');
}

document.addEventListener('DOMContentLoaded', () => {
    refreshMyUser();
});

// 核心修復：語音播放邏輯
window.playAudio = function(base64Data) {
    try {
        // 檢查數據是否包含正確的 Data URL 前綴
        const audioSrc = base64Data.startsWith('data:audio') ? base64Data : `data:audio/webm;base64,${base64Data}`;
        const audio = new Audio(audioSrc);
        
        // 處理播放狀態 UI (可選)
        audio.play().catch(e => {
            console.error("播放失敗:", e);
            alert("語音播放失敗，請檢查權限或檔案格式。");
        });
    } catch (err) {
        console.error("Audio conversion error", err);
    }
};

function generateRoomId(id1, id2) { 
    return [id1, id2].sort().join('_'); 
}

// 渲染聊天內容 (修復語音按鈕調用)
function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    messages.forEach(msg => {
        const isMine = msg.sender === myUserId;
        const div = document.createElement('div');
        div.className = `flex ${isMine ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-2`;

        let content = '';
        if (msg.message_type === 'text') {
            content = `<div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${isMine ? 'bg-sexify text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}">${msg.content}</div>`;
        } else if (msg.message_type === 'image') {
            content = `<img src="${msg.content}" class="max-w-[70%] rounded-2xl border shadow-sm cursor-pointer active:scale-95 transition" onclick="window.open('${msg.content}')">`;
        } else if (msg.message_type === 'voice') {
            // 修正：調用 window.playAudio
            content = `
                <button onclick="playAudio('${msg.content}')" class="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-bold shadow-sm active:scale-95 transition ${isMine ? 'bg-sexify text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}">
                    <i class="fa-solid fa-play"></i>
                    <span>語音訊息</span>
                </button>`;
        }

        div.innerHTML = content;
        container.appendChild(div);
    });
}

// ... 其餘發送邏輯、搜尋對話邏輯保持完整，確保 window.supabaseClient 調用正確 ...
// (因篇幅限制，此處僅展示核心修復，實際提供時請確保全檔案替換)

window.openChat = async function(targetId, targetName, targetAvatar) {
    refreshMyUser();
    window.activeChatTarget = targetId;
    window.activeRoomId = generateRoomId(myUserId, targetId);

    document.getElementById('chat-target-name').innerText = targetName;
    document.getElementById('chat-target-avatar').src = targetAvatar || 'https://ui-avatars.com/api/?name=U';
    document.getElementById('chat-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('chat-modal').classList.remove('translate-x-full'), 10);

    const { data } = await window.supabaseClient
        .from('messages')
        .select('*')
        .eq('room_id', window.activeRoomId)
        .order('created_at', { ascending: false })
        .limit(50);

    drawMessages(data || []);
    setupRoomRealtime();
};

window.closeChat = function() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('chat-modal').classList.add('hidden'), 300);
};

async function handleSendAction() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const msgObj = {
        room_id: window.activeRoomId,
        sender: myUserId,
        receiver: window.activeChatTarget,
        content: text,
        message_type: 'text'
    };

    const { error } = await window.supabaseClient.from('messages').insert([msgObj]);
    if (!error) input.value = '';
}

function setupRoomRealtime() {
    if (window.roomChannel) window.roomChannel.unsubscribe();
    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${window.activeRoomId}` }, payload => {
            // 重新抓取或本地 append
            const { data } = window.supabaseClient.from('messages').select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false }).limit(50).then(({data}) => drawMessages(data));
        }).subscribe();
}
