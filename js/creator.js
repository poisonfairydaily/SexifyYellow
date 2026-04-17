/**
 * creator.js - 創作者投稿邏輯
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 工具函數 (fileToBase64, generatePreviewBlob) 請從 admin.js 複製過來...
// [此處省略工具函數以節省空間，請確保包含在你的實際檔案中]

document.getElementById('upload-btn').addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = document.getElementById('p-image').files;
    const status = document.getElementById('status');
    const btn = document.getElementById('upload-btn');

    if (!name || !price || files.length === 0) return alert("資訊不完整");

    btn.disabled = true;
    status.innerText = "⏳ 正在啟動 AI 審核系統...";

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入");

        let uploadedFileNames = [];
        let lastAiReport = null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            status.innerText = `🔍 AI 正在審核第 ${i+1}/${files.length} 張...`;

            // 1. AI 審核 (Vision API)
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("審核系統忙碌中");
            lastAiReport = audit.details;

            if (!audit.safe) {
                alert(`❌ 警告：圖片 "${file.name}" ${audit.reason}。`);
                continue; 
            }

            // 2. 圖片處理與上傳
            const fileName = `${Date.now()}_${i}_${file.name.replace(/[, ]/g, '_')}`;
            const previewBlob = await generatePreviewBlob(file);

            await supabaseClient.storage.from('products').upload(fileName, file);
            await supabaseClient.storage.from('previews').upload(fileName, previewBlob);
            
            uploadedFileNames.push(fileName);
        }

        if (uploadedFileNames.length === 0) throw new Error("投稿內容不符規範");

        // 3. 寫入資料庫 (✨ 關鍵：status 設為 pending)
        const { error: dbError } = await supabaseClient.from('products').insert([{
            name: name,
            price: parseInt(price),
            image_url: uploadedFileNames.join(','),
            creator_id: user.id,
            status: 'pending', // ✨ 創作者投稿必須經過人工審核
            ai_report: lastAiReport
        }]);

        if (dbError) throw dbError;
        alert("🎉 投稿成功！請靜候管理員審核。");
        location.reload();

    } catch (err) {
        status.innerText = "❌ 失敗：" + err.message;
        btn.disabled = false;
    }
});
