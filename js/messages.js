// ==========================================
// js/messages.js - Storage 上傳版
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

window.searchUsersToChat = async function() {
    const keyword = document.getElementById('inbox-search-input').value.trim();
    const container = document.getElementById('chat-list');
    
    if (!keyword) { renderMessages(); return; }

    container.innerHTML = `<div class="p-6 text-center text-gray-400 mt-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const { data, error } = await window.supabaseClient.from('profiles').select('id, display_name, username, avatar_url').or(`display_name.ilike.%${keyword}%,username.ilike.%${keyword}%`).limit(10);
        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-gray-400">找不到用戶</div>`;
            return;
        }

        container.innerHTML = data.map(u => `
            <div class="flex items-center gap-4 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer" onclick="openChat('${u.id}', '${u.display_name}')">
                <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1">
                    <div class="font-bold text-gray-800">${u.display_name}</div>
                    <div class="text-xs text-gray-400">@${u.username}</div>
                </div>
            </div>
        `).join('');
    } catch(e) { container.innerHTML = `<div class="p-10 text-center text-red-400">搜尋出錯</div>`; }
}

window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    if (!container) return;
    refreshMyUser();
    if(!myUserId) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*, profiles!messages_sender_fkey(display_name, avatar_url), receiver_prof:profiles!messages_receiver_fkey(display_name, avatar_url)')
            .or(`sender.eq.${myUserId},receiver.eq.${myUserId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const lastMsgs = {};
        data.forEach(m => {
            if (!lastMsgs[m.room_id]) lastMsgs[m.room_id] = m;
        });

        const sortedRooms = Object.values(lastMsgs);
        if (sortedRooms.length === 0) {
            container.innerHTML = `<div class="p-20 text-center text-gray-300 flex flex-col items-center"><i class="fa-solid fa-comments text-4xl mb-4 opacity-20"></i>尚無對話記錄</div>`;
            return;
        }

        container.innerHTML = sortedRooms.map(m => {
            const isMeSender = m.sender === myUserId;
            const targetProf = isMeSender ? m.receiver_prof : m.profiles;
            const targetId = isMeSender ? m.receiver : m.sender;
            const unread = !isMeSender && !m.is_read;

            return `
                <div class="flex items-center gap-4 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer ${unread ? 'bg-blue-50/30' : ''}" onclick="openChat('${targetId}', '${targetProf.display_name}')">
                    <div class="relative">
                        <img src="${targetProf.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-14 h-14 rounded-full object-cover border border-gray-100">
                        ${unread ? '<div class="absolute top-0 right-0 w-3 h-3 bg-sexify rounded-full border-2 border-white"></div>' : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-800 truncate text-sm">${targetProf.display_name}</span>
                            <span class="text-[10px] text-gray-400">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="text-xs ${unread ? 'text-gray-900 font-bold' : 'text-gray-400'} truncate">
                            ${m.media_url ? '[媒體檔案]' : m.content}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) { console.error(e); }
}

// 修改點：聊天媒體上傳至 messages 桶
async function uploadChatMedia(fileBlob, extension) {
    const fileName = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${extension}`;
    const { data, error } = await window.supabaseClient.storage
        .from('messages')
        .upload(fileName, fileBlob, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = window.supabaseClient.storage
        .from('messages')
        .getPublicUrl(fileName);

    return publicUrl;
}

window.handleSendAction = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content && !selectedMediaFile) return;

    const senderId = localStorage.getItem('userId');
    const receiverId = window.activeChatTarget;
    if (!senderId || !receiverId) return;

    const tempId = 'temp_' + Date.now();
    const tempMsg = { id: tempId, sender: senderId, content: content || '發送中...', created_at: new Date().toISOString() };
    window.currentRoomMessages.unshift(tempMsg);
    drawMessages(window.currentRoomMessages);

    input.value = '';
    
    try {
        let mediaUrl = null;
        if (selectedMediaFile) {
            const ext = selectedMediaFile.name.split('.').pop();
            mediaUrl = await uploadChatMedia(selectedMediaFile, ext);
            selectedMediaFile = null;
            document.getElementById('chat-image-input').value = '';
        }

        const { error } = await window.supabaseClient.from('messages').insert([{
            room_id: window.activeRoomId,
            sender: senderId,
            receiver: receiverId,
            content: content,
            media_url: mediaUrl
        }]);
        if (error) throw error;
    } catch(e) {
        alert("發送失敗");
        window.currentRoomMessages = window.currentRoomMessages.filter(m => m.id !== tempId);
        drawMessages(window.currentRoomMessages);
    }
}

window.handleImageSelection = function(input) {
    if (input.files && input.files[0]) {
        selectedMediaFile = input.files[0];
        // 直接觸發發送流程
        window.handleSendAction();
    }
}

window.toggleVoiceRecord = async function() {
    if (!window.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = await uploadChatMedia(audioBlob, 'webm');
                
                await window.supabaseClient.from('messages').insert([{
                    room_id: window.activeRoomId,
                    sender: myUserId,
                    receiver: window.activeChatTarget,
                    content: '[語音訊息]',
                    media_url: audioUrl
                }]);
            };
            mediaRecorder.start();
            window.isRecording = true;
            document.querySelector('.fa-microphone').classList.add('text-sexify', 'animate-pulse');
        } catch(e) { alert("無法使用麥克風"); }
    } else {
        mediaRecorder.stop();
        window.isRecording = false;
        document.querySelector('.fa-microphone').classList.remove('text-sexify', 'animate-pulse');
    }
}

window.openChat = async function(targetId, targetName) {
    window.activeChatTarget = targetId;
    window.activeRoomId = generateRoomId(myUserId, targetId);
    
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    document.getElementById('chat-target-name').innerText = targetName;
    document.getElementById('chat-messages').innerHTML = '';

    await fetchMessages();
    setupRoomSubscription();
}

async function fetchMessages() {
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .eq('room_id', window.activeRoomId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (!error) {
        window.currentRoomMessages = data;
        drawMessages(data);
        // 標記為已讀
        await window.supabaseClient.from('messages').update({ is_read: true }).eq('room_id', window.activeRoomId).eq('receiver', myUserId);
    }
}

function drawMessages(msgs) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = msgs.slice().reverse().map(m => {
        const isMe = m.sender === myUserId;
        let mediaHtml = '';
        if (m.media_url) {
            if (m.media_url.includes('.webm')) {
                mediaHtml = `<audio src="${m.media_url}" controls class="max-w-full mt-2"></audio>`;
            } else {
                mediaHtml = `<img src="${m.media_url}" class="max-w-[200px] rounded-lg mt-2 cursor-pointer" onclick="window.open('${m.media_url}')">`;
            }
        }

        return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-4">
                <div class="max-w-[80%] ${isMe ? 'bg-sexify text-white rounded-l-2xl rounded-tr-2xl' : 'bg-gray-100 text-gray-800 rounded-r-2xl rounded-tl-2xl'} px-4 py-2 shadow-sm">
                    ${m.content ? `<div class="text-sm leading-relaxed">${m.content}</div>` : ''}
                    ${mediaHtml}
                    <div class="text-[9px] mt-1 opacity-60 text-right">
                        ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

function setupRoomSubscription() {
    if (window.roomChannel) window.supabaseClient.removeChannel(window.roomChannel);

    window.roomChannel = window.supabaseClient.channel('room_' + window.activeRoomId)
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
        renderMessages();
    }, 300);
}
