const pass = prompt("請輸入管理員密碼：");
if (pass !== "SEXIFYILOVE2026") {
    document.body.innerHTML = "<h1>拒絕存取</h1>";
}
// 1. 初始化 Supabase (請換成你自己的金鑰)
const SUPABASE_URL = '你的_SUPABASE_URL';
const SUPABASE_KEY = '你的_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const fileInput = document.getElementById('p-image');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const uploadBtn = document.getElementById('upload-btn');

// 當客戶選照片時，顯示模糊預覽
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    }
};

// 點擊上架按鈕
uploadBtn.onclick = async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const file = fileInput.files[0];

    if (!name || !price || !file) return alert("請填寫完整資訊並選擇圖片");

    status.innerText = "正在優化圖片並轉換為 WebP...";
    uploadBtn.disabled = true;

    try {
        // A. 前端自動轉 WebP
        const webpBlob = await convertToWebP(file);
        
        // B. 上傳至 Supabase Storage (檔名隨機化以保護隱私)
        const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
        const { data, error } = await supabase.storage
            .from('products') // 記得去 Supabase 開一個名為 products 的 Bucket
            .upload(fileName, webpBlob);

        if (error) throw error;

        // C. 獲取圖片連結並寫入資料庫
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
        
        const { dbError } = await supabase
            .from('products')
            .insert([{ name, price, image_url: publicUrl }]);

        if (dbError) throw dbError;

        status.innerText = "✅ 上架成功！圖片已優化。";
        alert("商品已同步至商城！");
        location.reload(); // 成功後刷新頁面
    } catch (err) {
        status.innerText = "❌ 錯誤: " + err.message;
        uploadBtn.disabled = false;
    }
};

// 神奇的轉換函數 (Canvas 處理)
function convertToWebP(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // --- 設定尺寸限制 (Size Restrict) ---
                const MAX_WIDTH = 1200; // 即使原圖是 4K，我們也縮到 1200px 寬
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = (MAX_WIDTH / width) * height;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                // ----------------------------------

                ctx.drawImage(img, 0, 0, width, height);
                
                // 0.8 代表品質 (Quality)，這會大大影響檔案 Byte 大小
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
            };
        };
    });
}
