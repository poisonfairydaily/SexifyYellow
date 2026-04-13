// ==========================================
// js/messages.js - 語音修復與 Storage 版
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
        // 1. 上傳語音檔案到 Storage
        const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
            .from('messages')
            .upload(fileName, blob);
            
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = window.supabaseClient.storage
            .from('messages')
            .getPublicUrl(fileName);

        // 2. 寫入訊息表，media_type 設為 'audio'
        await window.supabaseClient.from('messages').insert({
            room_id: window.activeRoomId,
            sender: myUserId,
            receiver: window.activeChatTarget,
            content: '[語音訊息]',
            media_url: publicUrl,
            media_type: 'audio'
        });
    } catch (e) {
        console.error("語音發送失敗:", e);
    }
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

        return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 items-end gap-2 animate-in slide-in-from-bottom-2">
                ${contentHtml}
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

window.playVoice = function(url, btn) {
    const audio = new Audio(url);
    const icon = btn.querySelector('i');
    icon.className = 'fa-solid fa-spinner fa-spin';
    
    audio.oncanplaythrough = () => {
        audio.play();
        icon.className = 'fa-solid fa-pause';
    };
    
    audio.onended = () => {
        icon.className = 'fa-solid fa-play';
    };
    
    audio.onerror = () => {
        icon.className = 'fa-solid fa-triangle-exclamation';
        alert("語音檔案讀取失敗，請檢查網路或 Storage 權限。");
    };
}

window.openChat = async function(targetUid, displayName) {
    window.activeChatTarget = targetUid;
    window.activeRoomId = generateRoomId(myUserId, targetUid);
    
    document.getElementById('chat-user-name').innerText = displayName;
    document.getElementById('chat-modal').classList.remove('hidden', 'translate-x-full');
    
    // 獲取歷史訊息
    const { data: msgs } = await window.supabaseClient
        .from('messages')
        .select('*')
        .eq('room_id', window.activeRoomId)
        .order('created_at', { ascending: true });
        
    window.currentRoomMessages = msgs || [];
    drawMessages(window.currentRoomMessages);

    // 訂閱即時訊息
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
}
