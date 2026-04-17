/**
 * creator.js - 創作者中心 (上傳 + 管理 + 安全防護版)
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fileInput = document.getElementById('p-image');
const previewContainer = document.getElementById('preview-container');
const statusBox = document.getElementById('status-box');
const statusText = document.getElementById('status-text');
const uploadBtn = document.getElementById('upload-btn');
const myProductsList = document.getElementById('my-products-list');

// --- 🛡️ 安全核心：防止 XSS 攻擊的文字過濾器 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 🔄 頁面初始化
window.addEventListener('DOMContentLoaded', () => {
    loadMyProducts();
});

// --- 🖼️ 多圖預覽 ---
fileInput.addEventListener('change', (e) => {
    previewContainer.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const div = document.createElement('div');
            div.className = "aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100";
            div.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover">`;
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
});

// --- 🛠️ 圖片轉換 WebP ---
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
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8); 
        };
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}

// --- 🚀 上傳邏輯 ---
uploadBtn.addEventListener('click', async () => {
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const files = fileInput.files;

    if (!name || !price || files.length === 0) return alert("請填寫標題、價格與圖片");

    uploadBtn.disabled = true;
    statusBox.classList.remove('hidden');

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入");

        let uploadedFileNames = [];
        let lastAiReport = null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusText.innerText = `正在審核第 ${i+1}/${files.length} 張...`;

            const base64Str = await fileToBase64(file);
            const { data: audit } = await supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (!audit.safe) {
                alert(`❌ 攔截：圖片 "${file.name}" ${audit.reason}`);
                continue; 
            }
            lastAiReport = audit.details;

            const webpBlob = await generateWebPBlob(file);
            const baseName = file.name.split('.').slice(0, -1).join('.').replace(/[, ]/g, '_');
            const fileName = `${Date.now()}_${i}_${baseName}.webp`;

            await supabaseClient.storage.from('products').upload(fileName, webpBlob);
            await supabaseClient.storage.from('previews').upload(fileName, webpBlob);
            uploadedFileNames.push(fileName);
        }

        const { error: dbError } = await supabaseClient.from('products').insert([{
            name, price: parseInt(price), image_url: uploadedFileNames.join(','),
            creator_id: user.id, status: 'pending', ai_report: lastAiReport
        }]);

        if (dbError) throw dbError;
        alert("🎉 投稿成功！");
        location.reload();

    } catch (err) {
        alert(err.message);
        uploadBtn.disabled = false;
        statusBox.classList.add('hidden');
    }
});

// --- 📂 管理邏輯：載入我的作品 ---
async function loadMyProducts() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: products } = await supabaseClient
            .from('products')
            .select('*')
            .eq('creator_id', user.id)
            .order('created_at', { ascending: false });

        if (!products || products.length === 0) {
            myProductsList.innerHTML = '<p class="text-center text-gray-400 text-[10px] py-10">尚無作品</p>';
            return;
        }

        myProductsList.innerHTML = products.map(p => {
            const firstImg = p.image_url.split(',')[0];
            const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${firstImg}`;
            const statusStyles = {
                pending: 'bg-amber-50 text-amber-500',
                approved: 'bg-green-50 text-green-500',
                rejected: 'bg-red-50 text-red-500'
            };
            const statusTexts = { pending: '審核中', approved: '已發布', rejected: '未通過' };

            return `
                <div class="flex items-center gap-4 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                    <img src="${imgUrl}" class="w-14 h-14 rounded-xl object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-bold text-gray-800 truncate">${escapeHTML(p.name)}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[10px] font-black text-red-500">🪙 ${p.price}</span>
                            <span class="text-[9px] px-2 py-0.5 rounded-full font-bold ${statusStyles[p.status]}">${statusTexts[p.status]}</span>
                        </div>
                    </div>
                    <button onclick="deleteMyProduct('${p.id}', '${escapeHTML(p.name).replace(/'/g, "\\'")}')" class="text-gray-300 hover:text-red-500 transition-colors px-2">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) { console.error(e); }
}

window.deleteMyProduct = async (id, name) => {
    if (!confirm(`確定要刪除「${name}」嗎？`)) return;
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if (error) alert("無法刪除"); else loadMyProducts();
};
