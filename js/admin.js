/**
 * admin.js - 商戶後台 (高品質上傳 + AI 審核報告存儲)
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 🛠️ 工具函數：檔案轉 Base64 ---
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// --- 🎨 核心：生成高品質預覽圖 ---
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

// --- 🚀 核心：批量上傳邏輯 ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = document.getElementById('p-image').files;
    const status = document.getElementById('status');
    const btn = document.getElementById('upload-btn');

    if (!name || !price || files.length === 0) return alert("請填寫完整資訊");

    btn.disabled = true;
    status.innerText = "⏳ 正在啟動 AI 審核與上傳...";

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        let uploadedFileNames = [];
        let lastAiReport = null; // 儲存最後一張圖的 AI 報告

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            status.innerText = `🔍 AI 正在掃描第 ${i+1}/${files.length} 張...`;

            // 1. AI 審核
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("AI 連線失敗，請檢查 Edge Function 狀態");
            
            // 存儲本次報告供資料庫使用
            lastAiReport = audit.details;

            if (!audit.safe) {
                alert(`❌ 攔截！圖片 "${file.name}" ${audit.reason}`);
                continue; 
            }

            // 2. 處理並上傳
            status.innerText = `⏳ 上傳中 (${i+1}/${files.length})...`;
            const fileName = `${Date.now()}_${i}_${file.name.replace(/[, ]/g, '_')}`;
            const previewBlob = await generatePreviewBlob(file);

            await supabaseClient.storage.from('products').upload(fileName, file);
            await supabaseClient.storage.from('previews').upload(fileName, previewBlob);
            
            uploadedFileNames.push(fileName);
        }

        if (uploadedFileNames.length === 0) throw new Error("沒有圖片通過審核");

        // 3. 寫入資料庫 (含 AI 報告)
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: name,
            price: parseInt(price),
            image_url: uploadedFileNames.join(','),
            creator_id: user.id,
            status: 'approved', 
            ai_report: lastAiReport // ✨ 存入最後一張掃描的詳細數據
        }]);

        if (dbError) throw dbError;
        alert("🎉 上架成功！");
        location.reload();

    } catch (err) {
        console.error(err);
        status.innerText = "❌ 錯誤：" + err.message;
        btn.disabled = false;
    }
});
