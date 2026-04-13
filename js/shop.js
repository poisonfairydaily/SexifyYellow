/**
 * shop.js
 * * 整合式商城核心邏輯 (全替換式完整代碼)
 * 功能：商品渲染、搜尋過濾、內嵌式購物車切換、直接購買(二次確認)、加入購物車、批量結帳。
 * UI 邏輯：購物清單整合於商城頂部，不使用外部懸浮按鈕。
 */

// 1. 全域商品資料與狀態管理
let globalProducts = [
    { id: 1, name: "福利私密圖", price: 49.0, oldPrice: 99.0, img: "https://picsum.photos/300/300?random=20", desc: "內含 15 張未公開高畫質精美福利圖，解鎖專屬誘惑。" },
    { id: 2, name: "1對1 私密聊天", price: 149.0, oldPrice: 299.0, img: "https://picsum.photos/300/300?random=21", desc: "專屬 30 分鐘線上私密語音/文字聊天，享受獨處時光。" },
    { id: 3, name: "數位寫真集", price: 129.0, oldPrice: 199.0, img: "https://picsum.photos/300/300?random=22", desc: "超過 50 頁的精美數位寫真，包含多套造型完整收藏。" },
    { id: 4, name: "VIP 專屬 1個月", price: 99.0, oldPrice: 150.0, img: "https://picsum.photos/300/300?random=23", desc: "開通一個月 VIP 特權，全站部分圖集免費看、享有專屬徽章。" },
    { id: 5, name: "限量拍立得", price: 399.0, oldPrice: 499.0, img: "https://picsum.photos/300/300?random=24", desc: "實體限量親筆簽名拍立得一張，全球免運費寄送。" },
    { id: 6, name: "聲音個性包", price: 29.0, oldPrice: 59.0, img: "https://picsum.photos/300/300?random=25", desc: "包含 5 段專屬早安、晚安及撒嬌語音留言。" }
];

let cart = []; // 購物車陣列
let isCartView = false; // 目前是否處於購物車檢視模式
let currentKeyword = ''; // 紀錄當前搜尋關鍵字

/**
 * 商城主渲染入口
 * 根據當前模式 (商品列表 or 購物車清單) 決定渲染內容
 */
function renderShop(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    const shopHeaderAction = document.getElementById('shop-header-action');
    
    if (!grid) {
        console.error("找不到 shop-grid 容器");
        return;
    }

    currentKeyword = filterKeyword;

    // 更新頂部按鈕狀態 (塞在商城內的切換器)
    updateShopHeaderUI();

    if (isCartView) {
        renderCartInline();
    } else {
        renderProductGrid(filterKeyword);
    }
}

/**
 * 更新商城頂部控制區 (包含購物清單切換按鈕)
 */
function updateShopHeaderUI() {
    // 假設您的 HTML 中有一個與搜尋列同級的容器 id="shop-header-btns"
    // 若無，此邏輯將嘗試尋找並注入，確保購物功能「塞」在商城裡。
    let headerBtns = document.getElementById('shop-header-btns');
    if (!headerBtns) return;

    headerBtns.innerHTML = `
        <button onclick="toggleCartView()" class="relative p-2 text-gray-600 hover:text-sexify transition-colors">
            <i class="fa-solid ${isCartView ? 'fa-house-chimney' : 'fa-cart-shopping'} text-xl"></i>
            ${!isCartView && cart.length > 0 ? `
                <span class="absolute top-0 right-0 bg-sexify text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce">
                    ${cart.length}
                </span>
            ` : ''}
        </button>
    `;
}

/**
 * 渲染商品網格列表
 */
function renderProductGrid(keyword) {
    const grid = document.getElementById('shop-grid');
    let displayProducts = globalProducts;

    if (keyword.trim() !== '') {
        const kw = keyword.toLowerCase();
        displayProducts = globalProducts.filter(p => p.name.toLowerCase().includes(kw));
    }

    if (displayProducts.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 text-sm">找不到相關商品...</div>`;
        return;
    }

    grid.innerHTML = displayProducts.map(p => `
        <div onclick="openProductModal(${p.id})" class="cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100/50 relative transform transition-all active:scale-95 hover:shadow-md">
            <div class="absolute top-2 left-2 bg-sexify text-white text-[9px] font-black px-2 py-0.5 rounded-full z-10 shadow">HOT</div>
            <div class="aspect-square w-full overflow-hidden bg-gray-50">
                <img src="${p.img}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">
            </div>
            <div class="p-3">
                <h3 class="font-bold text-xs text-gray-800 mb-1 line-clamp-1">${p.name}</h3>
                <div class="flex items-end gap-1.5 mt-2">
                    <span class="text-sexify font-black text-sm">🪙 ${p.price}</span>
                    <span class="text-gray-300 text-[10px] line-through mb-0.5">${p.oldPrice}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * 內嵌式渲染購物車清單 (取代商品網格)
 */
function renderCartInline() {
    const grid = document.getElementById('shop-grid');
    
    if (cart.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-basket-shopping text-4xl mb-4 opacity-20"></i>
                <p class="text-sm font-bold">購物清單是空的</p>
                <button onclick="toggleCartView()" class="mt-4 text-sexify text-xs font-bold border-b border-sexify">去逛逛商品</button>
            </div>
        `;
        return;
    }

    let total = cart.reduce((sum, item) => sum + item.price, 0);

    let cartHTML = `
        <div class="col-span-2 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div class="flex items-center justify-between px-2">
                <h2 class="font-black text-lg text-gray-800">購物清單 (${cart.length})</h2>
                <button onclick="clearCart()" class="text-[10px] text-gray-400 hover:text-red-500 transition-colors">清空全部</button>
            </div>
            
            <div class="flex flex-col gap-3">
                ${cart.map((item, index) => `
                    <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm relative">
                        <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover">
                        <div class="flex-1 flex flex-col justify-center">
                            <h4 class="text-xs font-bold text-gray-800">${item.name}</h4>
                            <span class="text-sexify font-black text-sm mt-1">🪙 ${item.price}</span>
                        </div>
                        <button onclick="removeFromCart(${index})" class="text-gray-300 hover:text-red-500 p-2">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="mt-4 p-5 bg-gray-50 rounded-[2rem] flex flex-col gap-4 border border-dashed border-gray-200">
                <div class="flex justify-between items-center px-1">
                    <span class="text-gray-500 font-bold text-sm">結算總價</span>
                    <span class="text-sexify font-black text-2xl">🪙 ${total.toFixed(1)}</span>
                </div>
                <button onclick="checkoutCart()" class="w-full bg-sexify text-white font-black py-4 rounded-2xl shadow-lg shadow-sexify/20 active:scale-95 transition-all">
                    立即支付並結帳
                </button>
            </div>
        </div>
    `;
    
    grid.innerHTML = cartHTML;
}

/**
 * 切換模式：商品列表 <-> 購物車
 */
function toggleCartView() {
    isCartView = !isCartView;
    renderShop(currentKeyword);
    // 切換時回到頂部
    const container = document.querySelector('.main-content'); // 根據您的佈局調整
    if(container) container.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 商品詳情模態視窗
 */
function openProductModal(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;

    let modalContainer = document.getElementById('product-modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'product-modal-container';
        document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-[3500] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity" onclick="closeProductModal()">
            <div class="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-300" onclick="event.stopPropagation()">
                
                <button onclick="closeProductModal()" class="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center z-10 backdrop-blur-md transition">
                    <i class="fa-solid fa-xmark"></i>
                </button>

                <div class="w-full aspect-square bg-gray-50">
                    <img src="${product.img}" class="w-full h-full object-cover">
                </div>

                <div class="p-6 flex flex-col gap-2">
                    <h2 class="text-xl font-black text-gray-900">${product.name}</h2>
                    <p class="text-gray-500 text-xs leading-relaxed min-h-[3rem] opacity-80">${product.desc}</p>
                    
                    <div class="mt-4 pt-4 border-t border-gray-50">
                        <div class="flex items-end gap-2 mb-4">
                            <span class="text-sexify font-black text-2xl">🪙 ${product.price}</span>
                            <span class="text-gray-300 text-xs line-through mb-1">${product.oldPrice}</span>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="addToCart(${product.id})" class="flex-1 bg-gray-100 text-gray-600 font-bold py-3.5 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all text-xs">
                                加入購物車
                            </button>
                            <button onclick="askDirectPurchase(${product.id})" class="flex-[1.5] bg-sexify text-white font-bold py-3.5 rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all text-xs">
                                直接購買
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    const modalContainer = document.getElementById('product-modal-container');
    if (modalContainer) modalContainer.innerHTML = ''; 
    document.body.style.overflow = '';
}

/**
 * 加入購物車邏輯
 */
function addToCart(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;
    
    cart.push(product);
    updateShopHeaderUI();
    closeProductModal();
    
    // 提示反饋
    showNotification(`已加入清單: ${product.name}`);
}

/**
 * 直接購買前詢問
 */
function askDirectPurchase(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (confirm(`確定要立即購買「${product.name}」嗎？\n將扣除 🪙 ${product.price}`)) {
        executePurchase(product.name, product.price);
        closeProductModal();
    }
}

/**
 * 執行購買 (共通接口)
 */
function executePurchase(name, price) {
    alert(`購買成功！\n已解鎖：「${name}」\n扣除金幣：${price}`);
    // 這裡未來可串接後端 API
}

/**
 * 購物車功能函數
 */
function removeFromCart(index) {
    cart.splice(index, 1);
    renderShop(currentKeyword);
}

function clearCart() {
    if(confirm('要清空所有選購商品嗎？')) {
        cart = [];
        renderShop(currentKeyword);
    }
}

function checkoutCart() {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    
    if (confirm(`確定要一次購買這 ${cart.length} 項商品嗎？\n總額：🪙 ${total.toFixed(1)}`)) {
        executePurchase(`購物車內 ${cart.length} 件商品`, total);
        cart = [];
        isCartView = false;
        renderShop(currentKeyword);
    }
}

/**
 * 搜尋與清除搜尋
 */
function searchShop() {
    const keyword = document.getElementById('shop-search').value;
    const clearBtn = document.getElementById('shop-search-clear-btn');
    
    if(clearBtn) {
        if(keyword.length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    
    // 搜尋時若在購物車模式，自動切回列表模式以便顯示搜尋結果
    if(isCartView && keyword.length > 0) isCartView = false;
    
    renderShop(keyword);
}

function clearShopSearch() {
    document.getElementById('shop-search').value = '';
    const clearBtn = document.getElementById('shop-search-clear-btn');
    if(clearBtn) clearBtn.classList.add('hidden');
    renderShop('');
}

/**
 * 通用通知顯示
 */
function showNotification(msg) {
    let notify = document.getElementById('shop-notify');
    if (!notify) {
        notify = document.createElement('div');
        notify.id = 'shop-notify';
        notify.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[4000] bg-gray-900/80 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-[10px] font-bold shadow-xl animate-in slide-in-from-top-4 fade-in duration-300';
        document.body.appendChild(notify);
    }
    notify.innerText = msg;
    notify.style.display = 'block';
    setTimeout(() => { notify.style.display = 'none'; }, 2000);
}

// 監聽與初次加載
document.addEventListener('DOMContentLoaded', () => {
    renderShop();
});

// 防禦性渲染 (確保容器載入)
setTimeout(() => {
    if (document.getElementById('shop-grid') && document.getElementById('shop-grid').innerHTML === '') {
        renderShop();
    }
}, 150);
