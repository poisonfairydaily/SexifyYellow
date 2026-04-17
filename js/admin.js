/**
 * admin.js - 商戶後台邏輯核心 (高品質多圖上傳 + AI 審核版)
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');

// --- 🔐 權限檢查與初始化 ---
window.onload = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const { data: profile } = await supabaseClient.from('profiles').select('is_admin').eq('id', session.user.id).single();
        if (profile?.is_admin) { showAdmin(); } 
        else { alert("權限不足"); await supabaseClient.auth.signOut(); location.reload(); }
    } else { showLogin(); }
};

function showLogin() { loginSection.style.display = 'block'; }
function showAdmin() { adminSection.style.display = 'block'; }

// --- 🔑 登入與登出 ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { document.getElementById('login-status').innerText = "❌ " + error.message; } 
    else { location.reload(); }
});

document.getElementById('logout-btn-trigger').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// --- 🖼️ 多圖預覽 ---
document.getElementById('p-image').addEventListener('change', function(e) {
    const files = e.target.files;
    const container = document.getElementById('preview-container');
    container.innerHTML = ''; 
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.className = 'preview-img';
            container.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
});

// --- 🛠️ 工具：檔案轉 Base64 (AI 審核需要) ---
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // 只要純 Base64 字串
        reader.onerror = error => reject(error);
    });
}

/**
 * 🎨 核心：生成高品質預覽圖
 */
async function generatePreviewBlob(file) {
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
            canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', 0.92); 
        };
    });
}

// --- 🚀 核心：批量上傳邏輯 (含 AI 審核) ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = document.getElementById('p-image').files;
    const status = document.getElementById('status');
    const btn = document.getElementById('upload-btn');

    if (!name || !price || files.length === 0) return alert("資訊不完整");

    btn.disabled = true;
    status.innerText = `⏳ 準備中，共 ${files.length} 張圖片...`;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        let uploadedFileNames = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            status.innerText = `🔍 正在由 AI 審核第 ${i+1}/${files.length} 張...`;

            // 1️⃣ 第一關：呼叫 Edge Function 進行 AI 審核
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("AI 審核連線失敗");
            if (!audit.safe) {
                alert(`❌ 攔截！圖片 "${file.name}" ${audit.reason}。這張圖將被跳過。`);
                continue; // 違規，跳過這張
            }

            // 2️⃣ 第二關：審核通過後才處理圖片與上傳
            status.innerText = `⏳ 審核通過！正在處理與上傳第 ${i+1}/${files.length} 張...`;
            const safeName = file.name.replace(/[, ]/g, '_');
            const fileName = `${Date.now()}_${i}_${safeName}`;
            const previewBlob = await generatePreviewBlob(file);

            // 上傳原圖 (Private)
            const { error: err1 } = await supabaseClient.storage.from('products').upload(fileName, file);
            if (err1) throw err1;

            // 上傳預覽圖 (Public)
            const { error: err2 } = await supabaseClient.storage.from('previews').upload(fileName, previewBlob);
            if (err2) throw err2;
            
            uploadedFileNames.push(fileName);
        }

        if (uploadedFileNames.length === 0) throw new Error("沒有任何圖片通過審核上傳。");

        // 3️⃣ 同步到資料庫
        const finalImagesString = uploadedFileNames.join(',');
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: name,
            price: parseInt(price),
            image_url: finalImagesString,
            creator_id: user.id,
            status: 'approved' 
        }]);

        if (dbError) throw dbError;
        alert(`🎉 上架完成！已成功上傳 ${uploadedFileNames.length} 張相片。`);
        location.reload();
    } catch (err) {
        console.error(err);
        status.innerText = "❌ 失敗：" + err.message;
        btn.disabled = false;
    }
});
