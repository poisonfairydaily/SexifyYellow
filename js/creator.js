/**
 * creator.js - 專業電商後台整合版
 * 包含：門禁審核、分頁控制、雙軌收益統計、實體訂單發貨、R2 多圖上傳 (含 WebP) + ✨ AI 智能視覺審核攔截
 */

const PLATFORM_FEE_RATE = 0.2; // 平台抽成 20%
const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; // R2 Worker
let selectedFiles = []; // 支援多圖

// ==========================================
// 🛡️ 門禁系統：檢查是否具有創作者資格
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            alert("請先登入");
            window.location.href = 'index.html';
            return;
        }

        // 檢查身分 (role 必須是 creator 或 admin，或者是 is_admin)
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('role, is_admin')
            .eq('id', session.user.id)
            .single();

        if (profile?.role !== 'creator' && profile?.role !== 'admin' && profile?.is_admin !== true) {
            alert("🔒 您尚未開通創作者身分，請先申請！");
            window.location.href = 'index.html'; // 踢回首頁或申請頁
            return;
        }

        // 驗證通過，載入儀表板
        window.switchCreatorTab('dashboard');
    } catch (e) {
        console.error("驗證身分時發生錯誤", e);
    }
});

// ==========================================
// 0. 分頁控制
// ==========================================
window.switchCreatorTab = function(tabName) {
    ['dashboard', 'publish', 'inventory'].forEach(t => {
        document.getElementById(`btn-${t}`).classList.remove('active');
        document.getElementById(`tab-${t}`).classList.add('hidden');
    });
    
    document.getElementById(`btn-${tabName}`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    if (tabName === 'dashboard') window.loadCreatorDashboard();
    if (tabName === 'inventory') window.loadMyProducts();
};

// ==========================================
// 1. 數據面板與訂單 (Dashboard)
// ==========================================
window.loadCreatorDashboard = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert("請先登入");

        const { data: myProducts } = await window.supabaseClient.from('products').select('id, views').eq('user_id', user.id);
        const myProductIds = myProducts?.map(p => p.id) || [];
        
        document.getElementById('stat-views').innerText = myProducts?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;

        if (myProductIds.length > 0) {
            const { data: orders, error } = await window.supabaseClient
                .from('orders')
                .select(`id, amount, amount_usd, created_at, status, shipping_address, category, products(name), profiles(display_name, avatar_url)`)
                .in('product_id', myProductIds)
                .order('created_at', { ascending: false });

            if (error) throw error;
            renderCreatorStats(orders);
        } else {
            renderCreatorStats([]);
        }
    } catch (e) { console.error("Dashboard Load Error:", e); }
};

function renderCreatorStats(orders) {
    const listEl = document.getElementById('sales-record-list');
    let tokenRev = 0, cashRev = 0, pendingCount = 0;

    if (!orders || orders.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">目前尚無成交記錄</div>`;
        document.getElementById('stat-sales').innerText = '0';
        return;
    }

    listEl.innerHTML = orders.map(order => {
        const isPhysical = order.category === 'physical';
        const netAmount = isPhysical ? (order.amount_usd || 0) * (1 - PLATFORM_FEE_RATE) : (order.amount || 0) * (1 - PLATFORM_FEE_RATE);
        
        if (isPhysical) cashRev += netAmount; else tokenRev += netAmount;
        if (order.status === 'pending') pendingCount++;

        // 處理 profiles 若為陣列的情況
        const buyer = Array.isArray(order.profiles) ? order.profiles[0] : (order.profiles || { display_name: '匿名買家' });
        const statusText = order.status === 'pending' ? '待處理' : (order.status === 'shipped' ? '已發貨' : '已完成');
        const statusColor = order.status === 'pending' ? 'text-orange-500' : 'text-green-500';

        return `
            <div class="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-3">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${isPhysical ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}">${isPhysical ? '📦 實體快遞' : '✨ 虛擬解鎖'}</span>
                    <span class="text-[10px] font-black ${statusColor}">${statusText}</span>
                </div>
                <div class="flex items-center gap-3">
                    <img src="${buyer.avatar_url || 'https://ui-avatars.com/api/?name=B'}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-black text-gray-900 truncate">${window.escapeHTML(order.products?.name)}</p>
                        <p class="text-[10px] text-gray-400 font-bold">買家: ${window.escapeHTML(buyer.display_name)}</p>
                    </div>
                    <div class="text-right">
                        <p class="${isPhysical ? 'text-blue-600' : 'text-sexify'} font-black text-sm">${isPhysical ? '$' : '🪙'} ${netAmount.toFixed(1)}</p>
                        <p class="text-[8px] text-gray-400 font-bold">${new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                ${isPhysical && order.status === 'pending' ? `
                    <div class="mt-3 p-3 bg-white rounded-xl border border-dashed border-gray-200">
                        <p class="text-[9px] text-gray-400 font-black mb-1">📦 收貨地址：</p>
                        <p class="text-[10px] text-gray-700 leading-relaxed">${window.escapeHTML(order.shipping_address || '未提供')}</p>
                        <button onclick="window.markAsShipped('${order.id}')" class="w-full mt-2 py-2 bg-black text-white text-[10px] font-black rounded-lg active:scale-95 transition">標記為已發貨</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('stat-sales').innerText = orders.length;
    document.getElementById('stat-revenue-token').innerText = tokenRev.toFixed(1);
    document.getElementById('stat-revenue-cash').innerText = cashRev.toFixed(1);
    document.getElementById('stat-pending').innerText = pendingCount;
}

window.markAsShipped = async function(orderId) {
    if (!confirm("確定已寄出商品嗎？這將通知買家。")) return;
    try {
        const { error } = await window.supabaseClient.from('orders').update({ status: 'shipped' }).eq('id', orderId);
        if (error) throw error;
        alert("發貨狀態已更新！");
        window.loadCreatorDashboard();
    } catch (e) { alert("更新失敗: " + e.message); }
};

// ==========================================
// 2. 動態表單與 WebP 多圖上傳 (Publish)
// ==========================================
window.togglePriceInput = function() {
    const category = document.getElementById('p-category').value;
    const priceLabel = document.getElementById('price-label');
    const priceIcon = document.getElementById('price-icon');
    const priceInput = document.getElementById('p-price');

    if (category === 'physical') {
        priceLabel.innerText = "定價 (USD 美金)";
        priceLabel.className = "block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2 ml-1";
        priceIcon.innerText = "＄";
        priceIcon.className = "absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600";
        priceInput.className = "w-full bg-gray-50 border border-gray-100 rounded-2xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none font-black";
    } else {
        priceLabel.innerText = "定價 (代幣)";
        priceLabel.className = "block text-[11px] font-black text-sexify uppercase tracking-widest mb-2 ml-1";
        priceIcon.innerText = "🪙";
        priceIcon.className = "absolute left-4 top-1/2 -translate-y-1/2 font-black text-sexify";
        priceInput.className = "w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-sexify outline-none font-black";
    }
    priceInput.value = '';
};

window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

window.handleProductFiles = function(input) {
    const container = document.getElementById('preview-container');
    container.innerHTML = '';
    selectedFiles = Array.from(input.files);

    if (selectedFiles.length > 0) {
        selectedFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'w-full aspect-square object-cover rounded-xl shadow-sm border border-gray-100';
                container.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    }
};

// ✨ 新增：將檔案轉換為 Base64 供 AI 讀取
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}

// Creator 端的 WebP 壓縮引擎
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

// 確保送給 R2 的是壓縮過的 WebP 並帶有正確檔名
async function uploadToR2(blob, fileName) {
    const formData = new FormData();
    formData.append('file', blob, fileName);
    const response = await fetch(WORKER_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('伺服器上傳失敗');
    return (await response.json()).url;
}

// ✨ 升級：加入 AI 審核的上架主邏輯
window.publishProduct = async function() {
    const btn = document.getElementById('upload-btn');
    const originalText = btn.innerText;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert("請先登入");

        const name = document.getElementById('p-name').value.trim();
        const desc = document.getElementById('p-desc').value.trim();
        const category = document.getElementById('p-category').value;
        const priceVal = parseFloat(document.getElementById('p-price').value) || 0;

        if (!name || selectedFiles.length === 0) return alert("請輸入商品名稱並上傳至少一張圖片");
        if (priceVal <= 0) return alert("請設定有效的價格");

        btn.disabled = true;

        let uploadedUrls = [];
        let lastAiReport = null;

        // ✨ 為了讓 AI 能一張一張擋下違規圖片，這裡改用循序的 for 迴圈
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // 1. AI 掃描階段
            btn.innerText = `🔍 AI 掃描審核中 (${i+1}/${selectedFiles.length})...`;
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await window.supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            if (auditError) throw new Error("AI 審核系統連線失敗");

            const safeSearch = audit.safeSearchAnnotation || audit;

            if (safeSearch) {
                // 相容 Likelihood 命名格式
                const valViolence = safeSearch.violence || safeSearch.violenceLikelihood;
                const valMedical = safeSearch.medical || safeSearch.medicalLikelihood;
                
                const dangerLevels = ['POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
                
                // 如果偵測到暴力血腥，直接拋出錯誤中斷整個上傳流程
                if (dangerLevels.includes(valViolence) || dangerLevels.includes(valMedical)) {
                    alert(`🚨 嚴重違規：圖片 "${window.escapeHTML(file.name)}" 偵測到暴力或血腥內容，上傳已強制中斷！\n請移除違規圖片後再試。`);
                    throw new Error("圖片含有暴力或血腥違規內容"); 
                }
                
                lastAiReport = safeSearch; // 儲存安全報告供後台查看
            } else if (audit && audit.safe === false) {
                alert(`❌ 警告：圖片 "${window.escapeHTML(file.name)}" 偵測到違規 (${audit.reason})，上傳已中斷！`);
                throw new Error("圖片含有其他違規內容");
            }

            // 2. 轉換與上傳階段
            btn.innerText = `📦 壓縮並上傳中 (${i+1}/${selectedFiles.length})...`;
            const webpBlob = await generateWebPBlob(file);
            const baseName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_');
            const fileName = `${Date.now()}_${i}_${baseName}.webp`; 
            
            const uploadedUrl = await uploadToR2(webpBlob, fileName);
            uploadedUrls.push(uploadedUrl);
        }

        btn.innerText = "資料寫入中...";
        const imageUrlsString = uploadedUrls.join(',');
        
        const productData = {
            user_id: user.id,
            name: window.escapeHTML(name),
            description: window.escapeHTML(desc),
            category: category,
            image_url: imageUrlsString,
            status: 'pending', // 創作者上傳強制為 pending 待審核
            price: category === 'virtual' ? priceVal : 0,
            price_usd: category === 'physical' ? priceVal : 0,
            ai_report: lastAiReport // ✨ 將 AI 報告寫入資料庫，供 Admin 審核參考
        };

        const { error } = await window.supabaseClient.from('products').insert([productData]);
        if (error) throw error;

        alert("🎉 商品上架申請已送出！請等待管理員審核。");
        
        document.getElementById('p-name').value = '';
        document.getElementById('p-desc').value = '';
        document.getElementById('p-price').value = '';
        document.getElementById('preview-container').innerHTML = '';
        selectedFiles = [];
        
        window.switchCreatorTab('inventory');

    } catch (e) {
        // 如果是我們自己拋出的違規錯誤，就不顯示系統原始報錯，讓 UI 乾淨點
        if (!e.message.includes("違規")) {
            alert("發佈失敗: " + e.message);
        }
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// ==========================================
// 3. 庫存管理 (Inventory)
// ==========================================
window.loadMyProducts = async function() {
    const listEl = document.getElementById('my-products-list');
    listEl.innerHTML = `<div class="text-center py-10 text-gray-300 font-bold"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i>載入中...</div>`;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!products || products.length === 0) {
            listEl.innerHTML = `<div class="text-center py-20 text-gray-400 font-bold">你還沒有上架任何商品</div>`;
            return;
        }

        listEl.innerHTML = products.map(p => {
            const firstImg = p.image_url ? p.image_url.split(',')[0] : 'https://placehold.co/150';
            const displayImg = firstImg.includes('r2.dev') ? `${WORKER_URL}media/${firstImg.split('/').pop()}` : firstImg;
            const isPhysical = p.category === 'physical';
            
            let statusBadge = '';
            if(p.status === 'approved') statusBadge = '<span class="text-[8px] font-black px-2 py-0.5 rounded bg-green-100 text-green-600">已上架</span>';
            else if(p.status === 'rejected' || p.status === 'deleted') statusBadge = '<span class="text-[8px] font-black px-2 py-0.5 rounded bg-red-100 text-red-600">已遭下架</span>';
            else statusBadge = '<span class="text-[8px] font-black px-2 py-0.5 rounded bg-orange-100 text-orange-600">審核中</span>';

            return `
                <div class="flex gap-4 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <img src="${displayImg}" class="w-20 h-20 rounded-xl object-cover shadow-sm">
                    <div class="flex-1 min-w-0 flex flex-col justify-center">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[8px] font-black px-2 py-0.5 rounded bg-gray-200 text-gray-500">${isPhysical ? '實體' : '虛擬'}</span>
                            ${statusBadge}
                        </div>
                        <h4 class="font-black text-sm text-gray-900 truncate mb-1">${window.escapeHTML(p.name)}</h4>
                        <p class="font-black text-xs ${isPhysical ? 'text-blue-600' : 'text-sexify'}">${isPhysical ? '$' + p.price_usd : '🪙' + p.price}</p>
                    </div>
                    <button onclick="window.deleteProduct('${p.id}')" class="w-10 h-10 self-center bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        listEl.innerHTML = `<div class="text-center py-10 text-red-500 font-bold">載入失敗</div>`;
    }
};

window.deleteProduct = async function(productId) {
    if (!confirm("確定要下架並刪除此商品嗎？")) return;
    try {
        const { data, error: dbError } = await window.supabaseClient.from('products').delete().eq('id', productId).select();
        
        // 創作者防呆機制：被擋下 (dbError) 或資料沒少 (!data)，代表已售出被保護
        if (dbError || !data || data.length === 0) {
            await window.supabaseClient.from('products').update({ is_archived: true, status: 'rejected' }).eq('id', productId);
            alert("⚠️ 由於商品已有成交紀錄，已為您轉為「下架封存」狀態，不再於商城顯示。");
        } else {
            alert("🗑️ 商品已徹底刪除。");
        }
        
        window.loadMyProducts();
        window.loadCreatorDashboard();
    } catch (e) { alert("刪除失敗"); }
};
