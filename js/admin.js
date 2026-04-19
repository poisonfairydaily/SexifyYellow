/**
 * admin.js - 究極管理員核心版 (2026 雙桶分流穩定版)
 * 功能：雙桶 R2 對接、WebP 壓縮、AI 報告解析、全域內容控制
 * 修正：官方商品上傳自動進入 MY_BUCKET，用戶貼文讀取自動定向至 POST_BUCKET
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✨ Worker 代理網址 (結尾不要帶斜槓)
const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev';

const loginSec = document.getElementById('login-section');
const adminSec = document.getElementById('admin-section'); 
const adminDash = document.getElementById('admin-dashboard'); 
const statusText = document.getElementById('status');
const previewContainer = document.getElementById('preview-container');

// --- 🛡️ 0. 安全與顏色核心 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getAiColor(v) {
    if (v === 'VERY_LIKELY' || v === 'LIKELY') return '#ff4d4f'; 
    if (v === 'POSSIBLE') return '#faad14'; 
    return '#8c8c8c'; 
}

// --- 🔐 1. 初始化與門禁系統 ---
window.onload = async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            if(loginSec) loginSec.style.display = 'block';
            return;
        }

        const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();

        if (pError || !profile?.is_admin) {
            alert("⚠️ 權限不足：您不是管理員");
            await supabaseClient.auth.signOut();
            location.reload();
            return;
        }

        if(loginSec) loginSec.style.display = 'none';
        
        if(adminDash) {
            adminDash.style.display = 'flex';
            loadPendingProducts();
            loadRecentPosts();
            loadAuditList(); 
        } else if (adminSec) {
            adminSec.style.display = 'block';
        }
        
        console.log("✅ 管理員驗證成功");

    } catch (err) {
        console.error("初始化失敗:", err);
        if(loginSec) loginSec.style.display = 'block';
    }
};

// --- 🔄 2. 頁籤切換邏輯 ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};

// --- 🖼️ 3. 預覽與影像處理工具 ---
const pImageInput = document.getElementById('p-image');
if (pImageInput) {
    pImageInput.addEventListener('change', (e) => {
        if(!previewContainer) return;
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
}

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

/**
 * ✨ R2 代理上傳 (分流對接版)
 */
async function uploadToR2(blob, fileName) {
    const formData = new FormData();
    formData.append('file', blob, fileName);
    const response = await fetch(WORKER_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('R2 代理上傳失敗');
    const resData = await response.json();
    return resData.url;
}

// --- 🚀 4. 官方商品上架 (自動進入 MY_BUCKET) ---
const uploadBtn = document.getElementById('upload-btn');
if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        const rawName = document.getElementById('p-name')?.value.trim();
        const price = document.getElementById('p-price')?.value;
        const desc = document.getElementById('p-desc')?.value.trim() || ''; 
        const files = document.getElementById('p-image')?.files;

        if (!rawName || !price || !files || files.length === 0) return alert("請填寫標題、價格與圖片");

        uploadBtn.disabled = true;
        if(statusText) statusText.innerText = "⏳ 執行管理員權限上傳中...";

        try {
            let uploadedFileUrls = [];
            let lastAiReport = null;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if(statusText) statusText.innerText = `🔍 AI 掃描與壓縮中 (${i+1}/${files.length})...`;

                const base64Str = await fileToBase64(file);
                const { data: audit } = await supabaseClient.functions.invoke('vision-audit', {
                    body: { imageBase64: base64Str }
                });

                lastAiReport = audit?.safeSearchAnnotation || audit;

                const webpBlob = await generateWebPBlob(file);
                // ✨【分流關鍵】檔名帶入 product_ 以觸發 Worker 存入 MY_BUCKET 的 products/
                const fileName = `product_official_${Date.now()}_${i}.webp`;

                const publicUrl = await uploadToR2(webpBlob, fileName);
                uploadedFileUrls.push(publicUrl);
            }

            const { error: dbError } = await supabaseClient.from('products').insert([{
                name: rawName,
                price: parseInt(price),
                description: desc, 
                image_url: uploadedFileUrls.join(','),
                user_id: (await supabaseClient.auth.getUser()).data.user.id,  
                status: 'approved',
                is_official: true, 
                ai_report: lastAiReport
            }]);

            if (dbError) throw dbError;
            alert("🎉 官方商品已成功發布！");
            location.reload();

        } catch (err) {
            console.error(err);
            if(statusText) statusText.textContent = "❌ 出錯了：" + err.message;
            uploadBtn.disabled = false;
        }
    });
}

// --- 🛡️ 5. 待審核清單 (Pending Products) ---
window.loadPendingProducts = async function() {
    const grid = document.getElementById('products-grid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-10">載入中...</div>';
    
    try {
        const { data, error } = await supabaseClient.from('products')
            .select('*, profiles!user_id(display_name)')
            .eq('is_official', false)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        grid.innerHTML = (data || []).map(item => {
            let firstImg = item.image_url.split(',')[0];
            // ✨ 分流讀取邏輯
            let imgPath = firstImg;
            if (firstImg.includes('r2.dev') || firstImg.includes('workers.dev')) {
                imgPath = `${WORKER_URL}/products/${firstImg.split('/').pop()}`;
            }

            const report = item.ai_report?.safeSearchAnnotation || item.ai_report || {};
            const valAdult = report.adult || report.adultLikelihood || 'N/A';

            return `
            <div class="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div class="h-44 bg-gray-100 relative cursor-zoom-in" onclick="openLightbox('${imgPath}')">
                    <img src="${imgPath}" class="w-full h-full object-cover">
                    <span class="absolute top-2 left-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-1 rounded">待審核</span>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <h3 class="font-bold text-sm truncate">${escapeHTML(item.name)}</h3>
                    <p class="text-[10px] text-gray-500 mb-2">來自: ${escapeHTML(item.profiles?.display_name)}</p>
                    <div class="mb-4 text-[10px] ${getAiColor(valAdult) === '#ff4d4f' ? 'bg-red-50' : 'bg-gray-50'} p-2 rounded">
                        🔞 成人偵測: <span style="color:${getAiColor(valAdult)}">${valAdult}</span>
                    </div>
                    <div class="mt-auto flex gap-2">
                        <button onclick="approveProduct('${item.id}')" class="flex-1 bg-green-500 text-white font-bold py-2 rounded-lg text-xs">核准</button>
                        <button onclick="hardDeleteProduct('${item.id}', '${item.image_url}')" class="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-lg text-xs">刪除</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

// --- 🛡️ 6. 活躍商品列表中控 (Audit List) ---
window.loadAuditList = async function() {
    const listContainer = document.getElementById('audit-list');
    if(!listContainer) return;

    try {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, profiles!user_id(display_name)')
            .eq('is_archived', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        listContainer.innerHTML = (products || []).map(p => {
            const report = p.ai_report?.safeSearchAnnotation || p.ai_report || {};
            const imagesHtml = (p.image_url?.split(',') || []).map(url => {
                let imgUrl = url;
                if (url.includes('r2.dev') || url.includes('workers.dev')) {
                    imgUrl = `${WORKER_URL}/products/${url.split('/').pop()}`;
                }
                return `<img src="${imgUrl}" onclick="openLightbox('${imgUrl}')" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; margin: 2px;">`;
            }).join('');

            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${imagesHtml}</td>
                    <td style="padding: 10px;">
                        <div class="font-bold">${escapeHTML(p.name)}</div>
                        <div style="font-size:10px; color:gray;">${escapeHTML(p.profiles?.display_name)}</div>
                    </td>
                    <td style="padding: 10px; font-weight:bold; color:#ff2442;">🪙 ${p.price || p.price_usd}</td>
                    <td style="padding: 10px; font-size:10px;">🔞成人: ${report.adult || 'N/A'}<br>💀暴力: ${report.violence || 'N/A'}</td>
                    <td style="padding: 10px;">
                        <button onclick="archiveProduct('${p.id}')" style="background:#faad14; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">下架</button>
                        <button onclick="hardDeleteProduct('${p.id}', '${p.image_url}')" style="background:none; color:#ff4d4f; border:none; font-size:10px; margin-left:10px;">徹底刪除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch(e) { console.error(e); }
};

// --- 🛡️ 7. 用戶貼文管理 (對接 POST_BUCKET) ---
window.loadRecentPosts = async function() {
    const grid = document.getElementById('posts-grid');
    if(!grid) return;
    
    try {
        const { data, error } = await supabaseClient.from('posts')
            .select('*, profiles!user_id(display_name)')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;

        grid.innerHTML = (data || []).map(post => {
            let imgPath = post.media_url;
            // ✨ 貼文分流讀取邏輯：從 media/ 目錄讀取
            if (imgPath && (imgPath.includes('r2.dev') || imgPath.includes('workers.dev'))) {
                imgPath = `${WORKER_URL}/media/${imgPath.split('/').pop()}`;
            }

            return `
            <div class="bg-white border rounded-2xl overflow-hidden shadow-sm p-3">
                <img src="${imgPath}" class="w-full h-32 object-cover rounded-lg mb-2" onclick="openLightbox('${imgPath}')" onerror="this.src='https://placehold.co/200?text=No+Image'">
                <p class="text-[11px] text-gray-800 line-clamp-2">${escapeHTML(post.caption)}</p>
                <p class="text-[10px] text-blue-500 font-bold mt-1">@${escapeHTML(post.profiles?.display_name)}</p>
                <button onclick="deleteRecord('posts', '${post.id}')" class="w-full bg-red-500 text-white text-[10px] py-1 rounded-lg mt-2">強制刪除貼文</button>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

// --- 🛠️ 8. 全域管理功能 (刪除/下架/燈箱) ---

window.approveProduct = async (id) => {
    if(!confirm("核准上架？")) return;
    const { error } = await supabaseClient.from('products').update({ status: 'approved' }).eq('id', id);
    if (!error) { loadPendingProducts(); loadAuditList(); }
};

window.archiveProduct = async (id) => {
    if(!confirm("確定下架？")) return;
    const { error } = await supabaseClient.from('products').update({ is_archived: true, status: 'rejected' }).eq('id', id);
    if (!error) { loadAuditList(); loadPendingProducts(); }
};

window.hardDeleteProduct = async (id, imageUrls) => {
    if(!confirm("🚨 警告：這將永久刪除該商品及所有關聯數據，確定嗎？")) return;
    try {
        await supabaseClient.from('reports').delete().eq('product_id', id);
        const { error } = await supabaseClient.from('products').delete().eq('id', id);
        if (error) throw error;
        alert("🗑️ 已徹底刪除");
        loadAuditList(); loadPendingProducts();
    } catch(e) { alert("刪除受阻，可能已有訂單紀錄。"); }
};

window.deleteRecord = async (table, id) => {
    if(!confirm(`確定要刪除這筆 ${table} 紀錄嗎？`)) return;
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if (!error) { alert("已刪除"); if(table === 'posts') loadRecentPosts(); }
};

window.openLightbox = function(url) {
    let overlay = document.getElementById('audit-lightbox');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'audit-lightbox';
        overlay.style = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); cursor: pointer;`;
        overlay.onclick = () => { overlay.style.display = 'none'; };
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<img src="${url}" style="max-width:90%; max-height:90%; border-radius:10px; border:2px solid white;">`;
    overlay.style.display = 'flex';
};
