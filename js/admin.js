/**
 * admin.js - 商戶後台邏輯核心 (高品質多圖批量上傳 + 創作者標記版)
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
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();
        
        if (profile && profile.is_admin === true) {
            showAdmin();
        } else {
            alert("權限不足：您不是管理員。");
            await supabaseClient.auth.signOut();
            location.reload();
        }
    } else {
        showLogin();
    }
};

function showLogin() { loginSection.style.display = 'block'; }
function showAdmin() { adminSection.style.display = 'block'; }

// --- 🔑 登入與登出事件 ---
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    btn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        document.getElementById('login-status').innerText = "❌ 失敗：" + error.message;
        btn.disabled = false;
    } else {
        location.reload();
    }
});

document.getElementById('logout-btn-trigger').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// --- 🖼️ 多圖預覽處理 ---
document.getElementById('p-image').addEventListener('change', function(e) {
    const files = e.target.files;
    const container = document.getElementById('preview-container');
    container.innerHTML = ''; 
    if (files.length > 0) {
        container.style.display = 'grid';
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
    }
});

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
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > max_size) { height *= max_size / width; width = max_size; }
            } else {
                if (height > max_size) { width *= max_size / height; height = max_size; }
            }
            canvas.width = width;
            canvas.height = height;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.filter = 'none'; 
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', 0.92); 
        };
    });
}

// --- 🚀 核心：批量上傳邏輯 ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = document.getElementById('p-image').files;
    const status = document.getElementById('status');
    const btn = document.getElementById('upload-btn');

    if (!name || !price || files.length === 0) return alert("資訊不完整");

    btn.disabled = true;
    status.innerText = `⏳ 正在啟動批量上傳，共 ${files.length} 張圖片...`;

    try {
        // ✨ 獲取當前登入使用者的 ID (即創作者 ID)
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("尚未登入或登入已過期");

        let uploadedFileNames = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            status.innerText = `⏳ 正在處理第 ${i+1}/${files.length} 張：${file.name}`;
            
            const safeName = file.name.replace(/[, ]/g, '_');
            const fileName = `${Date.now()}_${i}_${safeName}`;

            const previewBlob = await generatePreviewBlob(file);

            // 上傳原圖
            const { error: err1 } = await supabaseClient.storage.from('products').upload(fileName, file);
            if (err1) throw err1;

            // 上傳高品質預覽圖
            const { error: err2 } = await supabaseClient.storage.from('previews').upload(fileName, previewBlob);
            if (err2) throw err2;
            
            uploadedFileNames.push(fileName);
        }

        const finalImagesString = uploadedFileNames.join(',');
        status.innerText = "⏳ 正在同步到資料庫...";
        
        // ✨ 寫入資料庫時加入 creator_id
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: name,
            price: parseInt(price),
            image_url: finalImagesString,
            preview_url: finalImagesString,
            creator_id: user.id,   // 標記創作者
            status: 'approved'     // 目前管理員上傳預設直接通過
        }]);

        if (dbError) throw dbError;
        
        status.innerText = "✅ 上傳成功！";
        alert(`🎉 成功上架 ${files.length} 張相片。`);
        location.reload();
    } catch (err) {
        console.error(err);
        status.innerText = "❌ 出錯：" + err.message;
        btn.disabled = false;
    }
});
