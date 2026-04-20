/**
 * creator.js - 2026 專業電商後台整合版
 * 修正重點：
 * 1. ✨ 雙桶分流對接：上傳檔名強制帶入 "product" 以存入 MY_BUCKET (products/)
 * 2. 🛡️ 門禁審核：嚴格身分驗證
 * 3. 📦 實體/虛擬雙軌：USD 與 代幣自動切換
 * 4. 🔍 AI 視覺檢測：純紀錄模式 (存入資料庫供管理員查閱)
 */

const PLATFORM_FEE_RATE = 0.2; // 平台抽成 20%
const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; // R2 Worker 代理地址
let selectedFiles = []; // 支援多圖預覽

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

        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('role, is_admin')
            .eq('id', session.user.id)
            .single();

        if (profile?.role !== 'creator' && profile?.role !== 'admin' && profile?.is_admin !== true) {
            alert("🔒 您尚未開通創作者身分，請先申請！");
            window.location.href = 'index.html';
            return;
        }

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
        const btn = document.getElementById(`btn-${t}`);
        const tab = document.getElementById(`tab-${t}`);
        if(btn) btn.classList.remove('active');
        if(tab) tab.classList.add('hidden');
    });
    
    const targetBtn = document.getElementById(`btn-${tabName}`);
    const targetTab = document.getElementById(`tab-${tabName}`);
    if(targetBtn) targetBtn.classList.add('active');
    if(targetTab) targetTab.classList.remove('hidden');

    if (tabName === 'dashboard') window.loadCreatorDashboard();
    if (tabName === 'inventory') window.loadMyProducts();
};

// ==========================================
// 1. 數據面板與訂單 (Dashboard)
// ==========================================
window.loadCreatorDashboard = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const { data: myProducts } = await window.supabaseClient.from('products').select('id, views').eq('user_id', user.id);
        const myProductIds = myProducts?.map(p => p.id) || [];
        
        const viewEl = document.getElementById('stat-views');
        if(viewEl) viewEl.innerText = myProducts?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;

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

    if (!listEl) return;
    if (!orders || orders.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">目前尚無成交記錄</div>`;
        const salesEl = document.getElementById('stat-sales');
        if(salesEl) salesEl.innerText = '0';
        return;
    }

    listEl.innerHTML = orders.map(order => {
        const isPhysical = order.category === 'physical';
        const netAmount = isPhysical ? (order.amount_usd || 0) * (1 - PLATFORM_FEE_RATE) : (order.amount || 0) * (1 - PLATFORM_FEE_RATE);
        
        if (isPhysical) cashRev += netAmount; else tokenRev += netAmount;
        if (order.status === 'pending') pendingCount++;

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

    const salesStat = document.getElementById('stat-sales');
    const tokenStat = document.getElementById('stat-revenue-token');
    const cashStat = document.getElementById('stat-revenue-cash');
    const pendingStat = document.getElementById('stat-pending');

    if(salesStat) salesStat.innerText = orders.length;
    if(tokenStat) tokenStat.innerText = tokenRev.toFixed(1);
    if(cashStat) cashStat.innerText = cashRev.toFixed(1);
    if(pendingStat) pendingStat.innerText = pendingCount;
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
    if(!container) return;
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

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
}





// ✨ 修改版：AI 只負責記錄，上傳時觸發分流進入 MY_BUCKET
window.publishProduct = async function() {
    const btn = document.getElementById('upload-btn');
    if(!btn) return;
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

        btn.innerText = `🔍 影像分析與優化中 (0/${selectedFiles.length})...`;

        let processedCount = 0;
        const uploadPromises = selectedFiles.map(async (file, i) => {
            // 1. AI 報告生成階段
            const base64Str = await fileToBase64(file);
            const { data: audit, error: auditError } = await window.supabaseClient.functions.invoke('vision-audit', {
                body: { imageBase64: base64Str }
            });

            let aiReport = null;
            if (!auditError && audit) {
                aiReport = audit.safeSearchAnnotation || audit;
            }

            // 2. 轉換與上傳
            const webpBlob = await window.generateWebPBlob(file);
            
            // ✨【核心修復】檔名必須包含 "product"，觸發 Worker 存入 MY_BUCKET (products/)
            const fileName = `product_${Date.now()}_${i}.webp`; 
            const uploadedUrl = await window.uploadToR2File(webpBlob, fileName);

            processedCount++;
            btn.innerText = `🔍 影像分析與優化中 (${processedCount}/${selectedFiles.length})...`;

            return { uploadedUrl, aiReport };
        });

        const results = await Promise.all(uploadPromises);
        const uploadedUrls = results.map(r => r.uploadedUrl);

        // 取得最後一個成功的 AI 報告 (保留原邏輯：lastAiReport 會是迴圈中最後一個有效值)
        let lastAiReport = null;
        for (const res of results) {
            if (res.aiReport) lastAiReport = res.aiReport;
        }

        btn.innerText = "資料寫入中...";
        const imageUrlsString = uploadedUrls.join(',');
        
        const productData = {
            user_id: user.id,
            name: window.escapeHTML(name),
            description: window.escapeHTML(desc),
            category: category,
            image_url: imageUrlsString,
            status: 'pending', 
            price: category === 'virtual' ? priceVal : 0,
            price_usd: category === 'physical' ? priceVal : 0,
            ai_report: lastAiReport
        };

        const { error } = await window.supabaseClient.from('products').insert([productData]);
        if (error) throw error;

        alert("🎉 商品已成功送出！請等待審核。");
        
        // 重置表單
        document.getElementById('p-name').value = '';
        document.getElementById('p-desc').value = '';
        document.getElementById('p-price').value = '';
        const preview = document.getElementById('preview-container');
        if(preview) preview.innerHTML = '';
        selectedFiles = [];
        
        window.switchCreatorTab('inventory');

    } catch (e) {
        alert("發佈過程中斷: " + e.message);
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
    if(!listEl) return;
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
            const firstImg = p.image_url ? p.image_url.split(',')[0] : '';
            
            // ✨【核心修復】對接雙桶邏輯：產品圖片應指向 Worker 的 products/ 資料夾
            let displayImg = 'https://placehold.co/150';
            if (firstImg) {
                const fileName = firstImg.split('/').pop();
                displayImg = `${WORKER_URL}products/${fileName}`;
            }

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
