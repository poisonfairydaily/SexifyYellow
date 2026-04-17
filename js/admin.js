/**
 * admin.js - 管理員專用：WebP 轉換 + AI 安全審核 + 權限鎖定
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSec = document.getElementById('login-section');
const adminSec = document.getElementById('admin-section');
const statusText = document.getElementById('status');
const previewContainer = document.getElementById('preview-container');

// --- 🔐 1. 初始化門禁檢查 ---
window.onload = async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            loginSec.style.display = 'block';
            return;
        }

        // 從 profiles 檢查是否為 admin
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

        // 驗證成功
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
        document.getElementById('login-status').innerText = "❌ " + error.message;
    } else {
        location.reload();
    }
});

document.getElementById('logout-btn-trigger').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// --- 🖼️ 3. 多圖預覽與轉換工具 ---
document.getElementById('p-image').addEventListener('change', (e) => {
    previewContainer.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.className = 'preview-img';
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

// 強制轉 WebP 的核心函數
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
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85); // 0.85 品質最佳平衡
        };
    });
}

// --- 🚀 4. 上架主邏輯 ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = document.getElementById('p-image').files;
    const btn = document.getElementById('upload-btn');

    if (!name || !price || files.length === 0) return alert("請填寫標題、價格與圖片");

    btn.disabled = true;
    statusText.innerText = "⏳ 啟動 AI 審核與 WebP 轉換...";

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        let uploadedFileNames = [];
        let lastAiReport = null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusText.innerText = `🔍 正在掃描第 ${i+1}/${files.length} 張...`;

            // A. AI 審核
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("AI 審核系統連線失敗");
            lastAiReport = audit.details;

            if (!audit.safe) {
                alert(`❌ 攔截：圖片 "${file.name}" ${audit.reason}`);
                continue; 
            }

            // B. 轉 WebP
            statusText.innerText = `📦 正在壓縮第 ${i+1}/${files.length} 張...`;
            const webpBlob = await generateWebPBlob(file);
            
            // 檔名優化 (移除舊副檔名)
            const baseName = file.name.split('.').slice(0, -1).join('.').replace(/[, ]/g, '_');
            const fileName = `${Date.now()}_${i}_${baseName}.webp`;

            // C. 上傳 Storage
            statusText.innerText = `🚀 正在上傳第 ${i+1}/${files.length} 張...`;
            await supabaseClient.storage.from('products').upload(fileName, webpBlob);
            await supabaseClient.storage.from('previews').upload(fileName, webpBlob);
            
            uploadedFileNames.push(fileName);
        }

        if (uploadedFileNames.length === 0) throw new Error("沒有有效的圖片可供上傳");

        // D. 寫入資料庫
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: name,
            price: parseInt(price),
            image_url: uploadedFileNames.join(','),
            creator_id: user.id,
            status: 'approved', // 管理員上傳預設通過
            ai_report: lastAiReport
        }]);

        if (dbError) throw dbError;

        alert("🎉 批量上架完成！");
        location.reload();

    } catch (err) {
        console.error(err);
        statusText.innerText = "❌ 出錯了：" + err.message;
        btn.disabled = false;
    }
});
