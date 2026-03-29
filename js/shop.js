// 1. 在資料中加入 id 與 desc (商品描述)
let globalProducts = [
    { id: 1, name: "福利私密圖", price: 49.0, oldPrice: 99.0, img: "https://picsum.photos/300/300?random=20", desc: "內含 15 張未公開高畫質精美福利圖，解鎖專屬誘惑。" },
    { id: 2, name: "1對1 私密聊天", price: 149.0, oldPrice: 299.0, img: "https://picsum.photos/300/300?random=21", desc: "專屬 30 分鐘線上私密語音/文字聊天，享受獨處時光。" },
    { id: 3, name: "數位寫真集", price: 129.0, oldPrice: 199.0, img: "https://picsum.photos/300/300?random=22", desc: "超過 50 頁的精美數位寫真，包含多套造型完整收藏。" },
    { id: 4, name: "VIP 專屬 1個月", price: 99.0, oldPrice: 150.0, img: "https://picsum.photos/300/300?random=23", desc: "開通一個月 VIP 特權，全站部分圖集免費看、享有專屬徽章。" },
    { id: 5, name: "限量拍立得", price: 399.0, oldPrice: 499.0, img: "https://picsum.photos/300/300?random=24", desc: "實體限量親筆簽名拍立得一張，全球免運費寄送。" },
    { id: 6, name: "聲音個性包", price: 29.0, oldPrice: 59.0, img: "https://picsum.photos/300/300?random=25", desc: "包含 5 段專屬早安、晚安及撒嬌語音留言。" }
];

function renderShop(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    let displayProducts = globalProducts;
    if (filterKeyword.trim() !== '') {
        const kw = filterKeyword.toLowerCase();
        displayProducts = globalProducts.filter(p => p.name.toLowerCase().includes(kw));
    }

    if (displayProducts.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-sm">找不到相關商品...</div>`;
        return;
    }

    // 2. 在外層 div 加上 cursor-pointer 與 onclick="openProductModal(${p.id})"
    grid.innerHTML = displayProducts.map(p => `
        <div onclick="openProductModal(${p.id})" class="cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100/50 relative transform transition-transform active:scale-95">
            <div class="absolute top-2 left-2 bg-sexify text-white text-[9px] font-black px-2 py-0.5 rounded-full z-10 shadow">HOT</div>
            <div class="aspect-square w-full overflow-hidden">
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

function searchShop() {
    const keyword = document.getElementById('shop-search').value;
    renderShop(keyword);
}

// 3. 新增彈出詳情視窗的功能
function openProductModal(productId) {
    // 找出對應的商品資料
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;

    // 檢查是否已經有 modal 容器，沒有就建一個
    let modalContainer = document.getElementById('product-modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'product-modal-container';
        document.body.appendChild(modalContainer);
    }

    // 將彈窗 HTML 注入到容器中
    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity" onclick="closeProductModal()">
            <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col relative shadow-2xl" onclick="event.stopPropagation()">
                
                <button onclick="closeProductModal()" class="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center z-10 backdrop-blur-md transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div class="w-full aspect-square bg-gray-50">
                    <img src="${product.img}" class="w-full h-full object-cover">
                </div>

                <div class="p-5 flex flex-col gap-2">
                    <h2 class="text-xl font-bold text-gray-900">${product.name}</h2>
                    <p class="text-gray-500 text-sm leading-relaxed min-h-[3rem]">${product.desc}</p>
                    
                    <div class="flex justify-between items-end mt-4 pt-4 border-t border-gray-100">
                        <div class="flex flex-col">
                            <span class="text-gray-400 text-xs line-through mb-1">原價 🪙 ${product.oldPrice}</span>
                            <span class="text-sexify font-black text-2xl">🪙 ${product.price}</span>
                        </div>
                        
                        <button onclick="confirmPurchase(${product.id})" class="bg-sexify text-white font-bold py-2.5 px-6 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all">
                            確認購買
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 關閉彈窗功能
function closeProductModal() {
    const modalContainer = document.getElementById('product-modal-container');
    if (modalContainer) {
        modalContainer.innerHTML = ''; // 清空內容即關閉
    }
}

// 處理購買邏輯
function confirmPurchase(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;
    
    // 這裡可以串接你的扣款系統或 API
    alert(\`購買成功！\\n已解鎖「\${product.name}」\\n扣除金幣：\${product.price}\`);
    
    // 購買完成後關閉彈窗
    closeProductModal();
}
