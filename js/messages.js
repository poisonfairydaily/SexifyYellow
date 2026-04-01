```javascript
// ==========================================
// ✅ messages.js - 完整修復版（解決亂碼 + 即時更新）
// ==========================================

window.activeChatId = null;
window.realtimeChannel = null;
let selectedImageFile = null;

let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("輸入暱稱：", "用戶" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "用戶");
    myChatName = localStorage.getItem('myChatName');
}

// 開啟聊天室
async function openChat(username, avatarUrl, id) {
    window.activeChatId = id;

    document.getElementById('chat-name').innerText = username;
    document.getElementById('chat-avatar').src = avatarUrl;

    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '';

    // 讀舊訊息
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    data.forEach(msg => appendMessage(msg, false));

    // realtime
    if (window.realtimeChannel) {
        supabaseClient.removeChannel(window.realtimeChannel);
    }

    window.realtimeChannel = supabaseClient
        .channel('messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
        }, payload => {
            appendMessage(payload.new, true);
        })
        .subscribe();
}

// 🔥 重點修復：HTML 正確渲染
function appendMessage(msg, isNew) {
    const container = document.getElementById('chat-messages');
    const isMe = msg.sender_name === myChatName;

    let html = `
    <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-2">
        <div class="px-3 py-2 rounded-xl ${isMe ? 'bg-pink-500 text-white' : 'bg-gray-200'} max-w-[70%]">
            <div class="text-xs opacity-60 mb-1">${msg.sender_name}</div>
            ${msg.content ? `<div>${escapeHtml(msg.content)}</div>` : ''}
            ${msg.image_url ? `<img src="${msg.image_url}" class="mt-2 rounded-lg">` : ''}
        </div>
    </div>
    `;

    if (isNew) {
        container.insertAdjacentHTML('afterbegin', html); // ✅ 修復
    } else {
        container.insertAdjacentHTML('beforeend', html);
    }
}

// 🔒 防止 HTML 被當 code 顯示
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// 發送
async function handleSendAction() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text && !selectedImageFile) return;

    let imageUrl = null;

    if (selectedImageFile) {
        const path = `public/${Date.now()}.png`;

        await supabaseClient.storage
            .from('message-images')
            .upload(path, selectedImageFile);

        const { data } = supabaseClient.storage
            .from('message-images')
            .getPublicUrl(path);

        imageUrl = data.publicUrl;
    }

    await supabaseClient.from('messages').insert([{
        content: text || null,
        sender_name: myChatName,
        image_url: imageUrl
    }]);

    input.value = '';
    selectedImageFile = null;
}

// Enter 發送
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chat-input');
    input.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSendAction();
    });
});
```
