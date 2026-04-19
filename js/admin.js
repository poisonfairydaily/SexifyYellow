/**
 * admin.js - 管理員專用：WebP 轉換 + Google Vision API (18+ 專屬審核) + 全域內容中控
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSec = document.getElementById('login-section');
const adminSec = document.getElementById('admin-section'); // 兼容舊版 HTML ID
const adminDash = document.getElementById('admin-dashboard'); // 新版多頁籤 HTML ID
const statusText = document.getElementById('status');
const previewContainer = document.getElementById('preview-container');

// --- 🛡️ 0. 安全核心：防止 XSS 攻擊 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- 🔐 1. 初始化門禁檢查 ---
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
            alert("權限不足：您不是管理員");
            await supabaseClient.auth.signOut();
            location.reload();
            return;
        }

        if(loginSec) loginSec.style.display = 'none';
        
        // 支援新版 Dashboard 或舊版 Section
        if(adminDash) {
            adminDash.style.display = 'flex';
            // 初始載入審核數據
            if(typeof loadPendingProducts === 'function') loadPendingProducts();
            if(typeof loadRecentPosts === 'function') loadRecentPosts();
        } else if (adminSec) {
            adminSec.style.display = 'block';
        }
        
        console.log("✅ 管理員驗證成功");

    } catch (err) {
        console.error("初始化崩潰:", err);
        if(loginSec) loginSec.style.display = 'block';
    }
};

// --- 🔑 2. 登入/登出功能 ---
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            document.getElementById('login-status').textContent = "❌ " + error.message;
        } else {
            location.reload();
        }
    });
}

const logoutBtnTrigger = document.getElementById('logout-btn-trigger');
if (logoutBtnTrigger) {
    logoutBtnTrigger.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        location.reload();
    });
}

// --- 🔄 3. 頁籤切換 (若使用新版 admin.html) ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};

// --- 🖼️ 4. 預覽與轉換工具 ---
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

// --- 🚀 5. 上架主邏輯 (結合 Google Vision API 18+ 規則) ---
const uploadBtn = document.getElementById('upload-btn');
if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        const rawName = document.getElementById('p-name')?.value.trim();
        const price = document.getElementById('p-price')?.value;
        const files = document.getElementById('p-image')?.files;
        const btn = document.getElementById('upload-btn');

        if (!rawName || !price || !files || files.length === 0) return alert("請填寫標題、價格與圖片");

        btn.disabled = true;
        if(statusText) statusText.innerText = "⏳ 管理員身分確認，準備上傳...";

        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            
            // 再次確認管理員權限
            const { data: profile } = await supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single();
            if (!profile?.is_admin) throw new Error("您無權從此介面上傳商品");

            let uploadedFileNames = [];
            let lastAiReport = null;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if(statusText) statusText.innerText = `🔍 Google Vision 掃描中 (${i+1}/${files.length})...`;

                const base64Str = await fileToBase64(file);
                
                // 呼叫你的 Edge Function
                const { data: audit, error: auditError } = await supabaseClient.functions.invoke('vision-audit', {
                    body: { imageBase64: base64Str }
                });

                if (auditError) throw new Error("AI 審核系統連線失敗");
                
                // --- ✨ Google Vision SafeSearch 18+ 專屬邏輯 ---
                // 取得 Google 回傳的 SafeSearch 節點 (依據你 Edge Function 的寫法，可能在 audit.safeSearchAnnotation 或 audit 裡面)
                const safeSearch = audit.safeSearchAnnotation || audit;

                if (safeSearch && safeSearch.violence) {
                    const dangerLevels = ['POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
                    
                    // 1. 檢查暴力與血腥 (絕對零容忍)
                    const isViolent = dangerLevels.includes(safeSearch.violence);
                    const isMedicalGore = dangerLevels.includes(safeSearch.medical);
                    
                    if (isViolent || isMedicalGore) {
                        alert(`🚨 嚴重違規：圖片 "${escapeHTML(file.name)}" 偵測到暴力或血腥內容，已強制攔截！`);
                        continue; // 跳過這張圖片，不予上傳
                    }

                    // 2. 檢查成人與性感內容 (18+ 平台專屬放行)
                    const isAdult = dangerLevels.includes(safeSearch.adult);
                    const isRacy = dangerLevels.includes(safeSearch.racy);
                    
                    if (isAdult || isRacy) {
                        console.log(`🔥 圖片 "${file.name}" 包含成人/性感內容，安全放行 (18+ 政策)。`);
                    }
                    
                    lastAiReport = safeSearch; // 紀錄報告
                } else if (audit && audit.safe === false) {
                    // 兼容舊版 AI 回傳格式的防護
                    alert(`❌ 警告：圖片 "${escapeHTML(file.name)}" 偵測到違規 (${audit.reason})，已略過。`);
                    continue; 
                }
                // ------------------------------------------

                if(statusText) statusText.innerText = `📦 轉換 WebP (${i+1}/${files.length})...`;
                const webpBlob = await generateWebPBlob(file);
                
                const baseName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_');
                const fileName = `${Date.now()}_${i}_${baseName}.webp`;

                if(statusText) statusText.innerText = `🚀 上傳儲存空間 (${i+1}/${files.length})...`;
                await supabaseClient.storage.from('products').upload(fileName, webpBlob);
                await supabaseClient.storage.from('previews').upload(fileName, webpBlob);
                
                uploadedFileNames.push(fileName);
            }

            if (uploadedFileNames.length === 0) throw new Error("沒有符合安全規範的圖片可供上傳");

            // 寫入資料庫：自動標記 status 為 approved 且 is_official 為 true
            const { error: dbError } = await supabaseClient.from('products').insert([{
                name: rawName,
                price: parseInt(price),
                image_url: uploadedFileNames.join(','),
                creator_id: user.id,
                status: 'approved',
                is_official: true, 
                ai_report: lastAiReport,
                is_archived: false
            }]);

            if (dbError) throw dbError;

            alert("🎉 官方商品已成功發布！");
            location.reload();

        } catch (err) {
            console.error(err);
            if(statusText) statusText.textContent = "❌ 出錯了：" + err.message;
            btn.disabled = false;
        }
    });
}

// ==========================================
// 🛡️ 模塊 B：全域審查介面 (Products & Posts)
// ==========================================

window.loadPendingProducts = async function() {
    const grid = document.getElementById('products-grid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';
    
    try {
        const { data, error } = await supabaseClient.from('products')
            .select('*, profiles(display_name)')
            .eq('is_official', false)
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;
        
        if(data.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-400 font-bold py-10">目前沒有需要審核的商戶商品</div>';
            return;
        }

        grid.innerHTML = data.map(item => `
            <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div class="h-40 bg-gray-100 relative">
                    <img src="${supabaseClient.storage.from('previews').getPublicUrl(item.image_url.split(',')[0]).data.publicUrl}" class="w-full h-full object-cover">
                    <span class="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded">🪙 ${item.price}</span>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <h3 class="font-bold text-sm text-gray-900 mb-1 truncate">${escapeHTML(item.name)}</h3>
                    <p class="text-[10px] text-gray-500 mb-3">創作者: ${escapeHTML(item.profiles?.display_name || '未知')}</p>
                    <div class="mt-auto grid grid-cols-2 gap-2">
                        <button onclick="deleteRecord('products', '${item.id}')" class="bg-red-50 text-red-600 border border-red-100 font-bold py-2 rounded-lg text-xs hover:bg-red-100 transition">刪除違規</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch(e) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold">載入失敗</div>';
    }
}

window.loadRecentPosts = async function() {
    const grid = document.getElementById('posts-grid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';
    
    try {
        const { data, error } = await supabaseClient.from('posts')
            .select('*, profiles(display_name)')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;
        
        if(data.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-400 font-bold py-10">目前沒有用戶動態</div>';
            return;
        }

        grid.innerHTML = data.map(post => `
            <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div class="h-40 bg-gray-50 relative flex items-center justify-center">
                    ${post.media_url ? `<img src="${escapeHTML(post.media_url)}" class="w-full h-full object-cover">` : `<span class="text-gray-300 text-xs font-bold">無圖片</span>`}
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <p class="text-[12px] text-gray-800 line-clamp-3 mb-2">${escapeHTML(post.caption || '無文字內容')}</p>
                    <p class="text-[10px] text-blue-500 font-bold mb-3">@${escapeHTML(post.profiles?.display_name || '用戶')}</p>
                    
                    <div class="mt-auto">
                        <button onclick="deleteRecord('posts', '${post.id}')" class="w-full bg-red-500 text-white font-bold py-2 rounded-lg text-xs shadow-md hover:bg-red-600 transition active:scale-95">強制刪除</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch(e) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold">載入失敗</div>';
    }
}

window.deleteRecord = async function(table, id) {
    if(!confirm(`確定要強制刪除這筆 ${table} 紀錄嗎？此操作不可逆！`)) return;
    
    try {
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) throw error;
        
        alert("🗑️ 已成功刪除！");
        if(table === 'products') loadPendingProducts();
        if(table === 'posts') loadRecentPosts();
    } catch(e) {
        alert("刪除失敗：" + e.message);
    }
}
