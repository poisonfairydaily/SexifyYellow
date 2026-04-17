/**
 * admin.js - 商戶後台 (WebP 優化 + AI 審核報告存儲)
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

// --- 🎨 核心：生成高品質 WebP ---
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
            ctx.drawImage(img, 0, 0, width, height);
            
            // ✨ 強制轉為 WebP 格式，品質 0.8
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/webp', 0.8); 
        };
    });
}

// --- 🚀 核心：批量上傳邏輯 ---
document.getElementById('upload-btn').addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = document.getElementById('p-image').files;
    const statusText = document.getElementById('status');
    const btn = document.getElementById('upload-btn');

    if (!name || !price || files.length === 0) return alert("請填寫完整資訊");

    btn.disabled = true;
    statusText.innerText = "⏳ 正在啟動 AI 審核與 WebP 轉換...";

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        let uploadedFileNames = [];
        let lastAiReport = null; 

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusText.innerText = `🔍 AI 正在掃描第 ${i+1}/${files.length} 張...`;

            // 1. AI 審核
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("AI 連線失敗，請檢查 Edge Function 狀態");
            lastAiReport = audit.details;

            if (!audit.safe) {
                alert(`❌ 攔截！圖片 "${file.name}" ${audit.reason}`);
                continue; 
            }

            // 2. ✨ WebP 轉換與檔名優化
            statusText.innerText = `⏳ 正在壓縮第 ${i+1}/${files.length} 張為 WebP...`;
            const webpBlob = await generatePreviewBlob(file);
            
            // 移除舊副檔名，確保檔名乾淨
            const baseName = file.name.split('.').slice(0, -1).join('.').replace(/[, ]/g, '_');
            const fileName = `${Date.now()}_${i}_${baseName}.webp`;

            // 3. 上傳到 Storage (統一存 WebP)
            statusText.innerText = `🚀 上傳中 (${i+1}/${files.length})...`;
            
            await supabaseClient.storage.from('products').upload(fileName, webpBlob);
            await supabaseClient.storage.from('previews').upload(fileName, webpBlob);
            
            uploadedFileNames.push(fileName);
        }

        if (uploadedFileNames.length === 0) throw new Error("沒有圖片通過審核");

        // 4. 寫入資料庫 (管理員上傳預設 status: 'approved')
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: name,
            price: parseInt(price),
            image_url: uploadedFileNames.join(','),
            creator_id: user.id,
            status: 'approved', 
            ai_report: lastAiReport 
        }]);

        if (dbError) throw dbError;
        alert("🎉 管理員上架成功！");
        location.reload();

    } catch (err) {
        console.error(err);
        statusText.innerText = "❌ 錯誤：" + err.message;
        btn.disabled = false;
    }
});
