// ==========================================
// js/shop.js - 商城模組 (安全加強版)
// ==========================================

// 1. 渲染商城列表 (從資料庫動態抓取，取代靜態內容)
window.renderShop = async function() {
    const container = document.getElementById('shop-grid');
    if (!container) return;

    // 進入時先顯示 Loading，並清空原本內容（防止舊商品殘留）
    container.innerHTML = `
        <div class="col-span-2 text-center py-20">
            <i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl mb-2"></i>
            <p class="text-xs text-gray-400">正在加載精品商城...</p>
        </div>`;

    try {
        // 從 Supabase 抓取商品，確保價格與庫存是真實的
        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 如果資料庫沒商品
        if (!products || products.length === 0) {
            container.innerHTML = `
                <div class="col-span-2 text-center py-20 text-gray-400">
                    <i class="fa-solid fa-store-slash text-4xl mb-4 opacity-20"></i>
                    <p class="text-sm font-bold">目前商城暫無商品</p>
                </div>`;
            return;
        }

        // 成功抓取後，徹底覆蓋 container 的內容
        container.innerHTML = products.map(item => `
            <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all active:scale-[0.98]">
                <div class="relative aspect-square">
                    <img src="${item.image_url || 'https://via.placeholder.com/300'}" class="w-full h-full object-cover">
                    ${item.stock <= 0 ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">已售罄</div>' : ''}
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <h3 class="font-bold text-sm text-gray-800 line-clamp-1 mb-1">${item.name}</h3>
                    <p class="text-[10px] text-gray-400 mb-3 line-clamp-2 leading-relaxed">${item.description || '暫無描述'}</p>
                    
                    <div class="mt-auto flex items-center justify-between">
                        <div class="flex items-center gap-1">
                            <i class="fa-solid fa-coins text-sexify text-xs"></i>
                            <span class="text-sm font-black text-gray-900">${item.price}</span>
                        </div>
                        <button 
                            onclick="handlePurchase('${item.id}', '${item.name}')" 
                            ${item.stock <= 0 ? 'disabled' : ''}
                            class="bg-gray-900 text-white text-[10px] px-4 py-2 rounded-full font-bold disabled:bg-gray-200">
                            ${item.stock <= 0 ? '補貨中' : '購買'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error("商城加載錯誤:", e);
        container.innerHTML = `<div class="col-span-2 text-center py-20 text-red-400 text-xs">數據加載異常，請重新整理</div>`;
    }
};

// 2. 核心購買動作 (調用 SQL RPC 函數，防止前端篡改)
window.handlePurchase = async function(itemId, itemName) {
    // 獲取按鈕狀態，防止重複點擊
    const btn = event.currentTarget;
    if (btn.disabled) return;

    if (!confirm(`確認購買「${itemName}」？\n此操作將從帳戶扣除點數。`)) return;

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "驗證中...";

    try {
        // 安全關鍵點：不傳價格給後端，只傳 ID，價格由後端自行查詢
        const { data, error } = await window.supabaseClient.rpc('process_purchase', {
            p_item_id: itemId,
            p_quantity: 1
        });

        if (error) throw error;

        // data 是來自 SQL 的回傳對象 { success: bool, message: string, new_balance: int }
        if (data.success) {
            alert(`🎉 購買成功！\n剩餘點數：${data.new_balance}`);
            
            // 更新畫面上顯示的點數（如果有點數顯示元素）
            const balanceDisplay = document.getElementById('user-points-display');
            if (balanceDisplay) balanceDisplay.innerText = data.new_balance;

            // 重新刷新列表以更新庫存顯示
            window.renderShop();
            
            // 如果個人資料頁面需要同步更新，呼叫 renderProfile
            if (typeof window.renderProfile === 'function') window.renderProfile();
        } else {
            alert(`⚠️ 交易失敗：${data.message}`);
        }

    } catch (e) {
        console.error("交易異常:", e);
        alert("網路通訊失敗，請檢查連線。");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// 3. 頁面初始化監聽
document.addEventListener('DOMContentLoaded', () => {
    // 如果頁面加載時商城分頁是開啟的，直接渲染
    const shopTab = document.getElementById('shop-tab');
    if (shopTab && !shopTab.classList.contains('hidden')) {
        window.renderShop();
    }
});
