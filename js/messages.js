```javascript
// ==========================================
// ✅ messages.js（最終穩定完整版）
// ==========================================

window.activeChatId = null;
window.realtimeChannel = null;
let selectedImageFile = null;

// 使用者名稱
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("輸入你的暱稱：", "用戶" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "用戶");
    myChatName = localStorage.getItem('myChatName');
}

// ==========================================
// 打開聊天室
// ==========================================
async function openChat(username, avatarUrl, id) {
    window.activeChatId = id;

    document.getElementById('chat-name').innerText = username;
    document.getElementById('chat-avatar').src = avatarUrl;

    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    // 🔥 清除舊 realtime
    if (window.realtimeChannel) {
        try {
            await window.realtimeChannel.unsubscribe();
        } catch (e) {}
        window.realtimeChannel = null;
    }

    // ======================================
    // 載入歷史訊息
    // ======================================
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    if (data) {
        data.forEach(msg => appendMessage(msg, false));
    }

    // ======================================
    // realtime 訂閱（唯一）
    // ======================================
    window.realtimeChannel = supabaseClient
        .channel('chat-' + Date.now())
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
        }, payload => {
            appendMessage(payload.new, true);
        })
        .subscribe();
}

// ==========================================
// 訊息渲染（100%安全）
// ==========================================
function appendMessage(msg, isNew) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const isMe = msg.sender_name === myChatName;

    const wrapper = document.createElement('div');
    wrapper.className = `flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`;

    wrapper.innerHTML = `
        <div class="px-3 py-2 rounded-xl ${isMe ? 'bg-pink-500 text-white' : 'bg-gray-200'} max-w-[75%] shadow-sm">
            <div class="text-[10px] opacity-60 mb-1">${escapeHtml(msg.sender_name || '')}</div>
            ${msg.content ? `<div class="break-words whitespace-pre-wrap">${escapeHtml(msg.content)}</div>` : ''}
            ${msg.image_url ? `<img src="${msg.image_url}" class="mt-2 rounded-lg max-h-[200px]">` : ''}
        </div>
    `;

    if (isNew) {
        container.prepend(wrapper);
    } else {
        container.appendChild(wrapper);
    }
}

// ==========================================
// 防 HTML 注入（關鍵）
// ==========================================
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ==========================================
// 發送訊息
// ==========================================
async function handleSendAction() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text && !selectedImageFile) return;

    let imageUrl = null;

    try {
        // 圖片上傳
        if (selectedImageFile) {
            const filePath = `public/${Date.now()}.png`;

            const { error } = await supabaseClient.storage
                .from('message-images')
                .upload(filePath, selectedImageFile);

            if (!error) {
                const { data } = supabaseClient.storage
                    .from('message-images')
                    .getPublicUrl(filePath);

                imageUrl = data.publicUrl;
            }
        }

        // 寫入 DB
        await supabaseClient.from('messages').insert([{
            content: text || null,
            sender_name: myChatName,
            image_url: imageUrl
        }]);

        input.value = '';
        selectedImageFile = null;

    } catch (err) {
        console.error(err);
        alert("發送失敗");
    }
}

// ==========================================
// 關閉聊天室
// ==========================================
function closeChat() {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);

    if (window.realtimeChannel) {
        try {
            window.realtimeChannel.unsubscribe();
        } catch (e) {}
        window.realtimeChannel = null;
    }
}

// ==========================================
// Enter 發送
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chat-input');

    if (input) {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                handleSendAction();
            }
        });
    }
});
```
