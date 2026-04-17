/**
 * admin.js - 管理員專用：WebP 轉換 + AI 安全審核 + 官方身份自動標記
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSec = document.getElementById('login-section');
const adminSec = document.getElementById('admin-section');
const statusText = document.getElementById('status');
const previewContainer = document.getElementById('preview-container');

// --- 🛡️ 0. 安全核心：防止 XSS 攻擊 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- 🔐 1. 初始化門禁檢查 ---
window.onload = async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            loginSec.style.display = 'block';
            return;
        }

        const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();

        if (pError || !profile?.is_admin) {
            alert("權限不足：您不是管理員");
            await supabaseClient.auth.signOut();
            location.reload();
            return;
        }

        adminSec.style.display = 'block';
        console.log("✅ 管理員驗證成功");

    } catch (err) {
        console.error("初始化崩潰:", err);
        loginSec.style.display = 'block';
    }
};

// --- 🔑 2. 登入/登出功能 ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        document.getElementById('login-status').textContent = "❌ " + error.message;
    } else {
        location.reload();
    }
});

document.getElementById('logout-btn-trigger').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// --- 🖼️ 3. 預覽與轉換工具 ---
document.getElementById('p-image').addEventListener('change', (e) => {
    previewContainer.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.className = 'preview-img';
            img.style = "width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin: 4px; border: 1px solid #eee;";
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
});

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}

async function generateWebPBlob(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const max_size = 1200; 
            let width = img.width, height = img.height;
            if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
            else { if (height > max_size) { width *= max_size / height; height = max_size; } }
            canvas.width = width; canvas.height = height;
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85); 
        };
    });
}

// --- 🚀 4. 上架主邏輯 (含自動官方標記) ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const rawName = document.getElementById('p-name').value.trim();
    const price = document.getElementById('p-price').value;
    const files = document.getElementById('p-image').files;
    const btn = document.getElementById('upload-btn');

    if (!rawName || !price || files.length === 0) return alert("請填寫標題、價格與圖片");

    btn.disabled = true;
    statusText.innerText = "⏳ 管理員身分確認，準備上傳...";

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        // 再次確認管理員權限 (安全性增強)
        const { data: profile } = await supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single();
        if (!profile?.is_admin) throw new Error("您無權從此介面上傳商品");

        let uploadedFileNames = [];
        let lastAiReport = null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusText.innerText = `🔍 AI 掃描中 (${i+1}/${files.length})...`;

            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("AI 審核系統連線失敗");
            lastAiReport = audit.details;

            if (!audit.safe) {
                alert(`❌ 管理員警告：圖片 "${escapeHTML(file.name)}" 偵測到違規 (${audit.reason})，但管理員可手動判斷。`);
                // 管理員介面通常允許強制上傳，但這裡我們維持安全標準，若要強制可改為 continue
                continue; 
            }

            statusText.innerText = `📦 轉換 WebP (${i+1}/${files.length})...`;
            const webpBlob = await generateWebPBlob(file);
            
            const baseName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_');
            const fileName = `${Date.now()}_${i}_${baseName}.webp`;

            statusText.innerText = `🚀 上傳儲存空間 (${i+1}/${files.length})...`;
            await supabaseClient.storage.from('products').upload(fileName, webpBlob);
            await supabaseClient.storage.from('previews').upload(fileName, webpBlob);
            
            uploadedFileNames.push(fileName);
        }

        if (uploadedFileNames.length === 0) throw new Error("沒有有效的圖片可供上傳");

        // ✨ 寫入資料庫：自動標記 status 為 approved 且 is_official 為 true
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: rawName,
            price: parseInt(price),
            image_url: uploadedFileNames.join(','),
            creator_id: user.id,
            status: 'approved', // 管理員上傳自動通過
            is_official: true,  // ✨ 自動標記為官方商品
            ai_report: lastAiReport,
            is_archived: false
        }]);

        if (dbError) throw dbError;

        alert("🎉 官方商品已成功發布！");
        location.reload();

    } catch (err) {
        console.error(err);
        statusText.textContent = "❌ 出錯了：" + err.message;
        btn.disabled = false;
    }
});
