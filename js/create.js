/**
 * creator.js - 創作者高品質多圖投稿邏輯
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fileInput = document.getElementById('p-image');
const previewContainer = document.getElementById('preview-container');
const statusBox = document.getElementById('status-box');
const statusText = document.getElementById('status-text');
const uploadBtn = document.getElementById('upload-btn');

// --- 🖼️ 多圖預覽邏輯 ---
fileInput.addEventListener('change', (e) => {
    previewContainer.innerHTML = '';
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const div = document.createElement('div');
            div.className = "aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100";
            div.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
});

// --- 🛠️ 工具：檔案轉 Base64 ---
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}

// --- 🎨 核心：生成高品質預覽圖 ---
/**
 * 修改後的圖片處理函數：強制轉為 WebP 並壓縮
 */
async function generatePreviewBlob(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 設定最大寬度（例如 1200px），避免有人上傳 8K 圖爆掉你的容量
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
            
            // 高品質縮放
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            // ✨ 關鍵：轉成 image/webp，品質設為 0.8 (這已經非常清晰且體積極小)
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/webp', 0.8); 
        };
    });
}
// --- 🚀 投稿主邏輯 ---
uploadBtn.addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = fileInput.files;

    if (!name || !price || files.length === 0) return alert("請填寫標題、價格並上傳相片");

    uploadBtn.disabled = true;
    statusBox.classList.remove('hidden');

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入帳號");

        let uploadedFileNames = [];
        let finalAiReport = null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusText.innerText = `正在 AI 審核第 ${i+1}/${files.length} 張...`;

            // 1. 呼叫 AI 審核 (Edge Function)
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("安全審核系統連線異常");
            finalAiReport = audit.details; // 存儲最後一張圖的報告

            if (!audit.safe) {
                alert(`❌ 攔截：圖片 "${file.name}" ${audit.reason}`);
                continue; 
            }

            // 2. 處理並上傳
            statusText.innerText = `正在上傳第 ${i+1}/${files.length} 張...`;
            const fileName = `${Date.now()}_${i}_${file.name.replace(/[, ]/g, '_')}`;
            const previewBlob = await generatePreviewBlob(file);

            // 上傳原圖與預覽圖
            await supabaseClient.storage.from('products').upload(fileName, file);
            await supabaseClient.storage.from('previews').upload(fileName, previewBlob);
            
            uploadedFileNames.push(fileName);
        }

        if (uploadedFileNames.length === 0) throw new Error("無效內容，投稿失敗");

        // 3. 寫入資料庫 (狀態為 pending)
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: name,
            price: parseInt(price),
            image_url: uploadedFileNames.join(','),
            creator_id: user.id,
            status: 'pending', // ✨ 創作者必須經過審核
            ai_report: finalAiReport
        }]);

        if (dbError) throw dbError;

        alert("🎉 投稿已送出！請靜候管理員審核。");
        window.location.href = 'index.html'; // 返回首頁

    } catch (err) {
        console.error(err);
        alert(err.message);
        uploadBtn.disabled = false;
        statusBox.classList.add('hidden');
    }
});
