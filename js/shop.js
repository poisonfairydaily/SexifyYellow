// js/shop.js
let cart = JSON.parse(localStorage.getItem('sexify_cart')) || [];

// 初始化商店頁面 UI
async function initShop() {
    renderShopProducts();
    updateCartBadge();
}

// 渲染商品列表 (擴充功能 3)
async function renderShopProducts() {
    const { data: products, error } = await supabase.from('products').select('*');
    const container = document.getElementById('main-content');
    if (error) return;

    let html = `<div class="grid grid-cols-2 gap-4 p-4">`;
    products.forEach(product => {
        html += `
            <div class="bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-800">
                <img src="${product.image_url}" class="w-full h-40 object-cover" onclick="viewProductDetail('${product.id}')">
                <div class="p-3">
                    <h3 class="font-bold truncate">${product.name}</h3>
                    <p class="text-pink-500 font-bold">${product.price} 金幣</p>
                    <div class="flex gap-2 mt-3">
                        <button onclick="addToCart('${product.id}', '${product.name}', ${product.price}, '${product.image_url}')" 
                                class="flex-1 bg-pink-500 text-[12px] py-2 rounded-lg font-bold">加入購物車</button>
                        <button onclick="goToVendorStore('${product.vendor_id}')" 
                                class="flex-1 bg-gray-800 text-[12px] py-2 rounded-lg border border-gray-700">進店</button>
                    </div>
                </div>
            </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
    document.getElementById('shop-actions').classList.remove('hidden');
}

// 購物車管理 (功能 1)
function addToCart(id, name, price, img) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price, img, quantity: 1, selected: true });
    }
    saveCart();
    alert('已加入購物車！');
}

function saveCart() {
    localStorage.setItem('sexify_cart', JSON.stringify(cart));
    updateCartBadge();
    if (!document.getElementById('cart-modal').classList.contains('hidden')) renderCart();
}

function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').innerText = count;
}

function toggleCartModal() {
    const modal = document.getElementById('cart-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) renderCart();
}

function renderCart() {
    const list = document.getElementById('cart-items-list');
    let total = 0;
    if (cart.length === 0) {
        list.innerHTML = `<div class="text-center text-gray-500 mt-20">購物車是空的</div>`;
        document.getElementById('cart-total').innerText = '0 金幣';
        return;
    }

    list.innerHTML = cart.map((item, index) => {
        if (item.selected) total += (item.price * item.quantity);
        return `
            <div class="flex items-center gap-4 bg-gray-900 p-3 rounded-xl border border-gray-800">
                <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleCartItemSelection(${index})" class="w-5 h-5 accent-pink-500">
                <img src="${item.img}" class="w-16 h-16 object-cover rounded-lg">
                <div class="flex-1">
                    <h4 class="font-bold text-sm">${item.name}</h4>
                    <p class="text-pink-500 text-xs">${item.price} 金幣</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="updateCartQty(${index}, -1)" class="w-6 h-6 bg-gray-800 rounded">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartQty(${index}, 1)" class="w-6 h-6 bg-gray-800 rounded">+</button>
                </div>
                <button onclick="removeFromCart(${index})" class="text-red-500 ml-2">🗑️</button>
            </div>
        `;
    }).join('');
    document.getElementById('cart-total').innerText = `${total} 金幣`;
}

function toggleCartItemSelection(index) {
    cart[index].selected = !cart[index].selected;
    saveCart();
}

function updateCartQty(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) return removeFromCart(index);
    saveCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
}

// 結算與訂單 (功能 1 & 2)
async function proceedToCheckout() {
    const selectedItems = cart.filter(item => item.selected);
    if (selectedItems.length === 0) return alert('請選擇要購買的商品');

    const { data: user } = await supabase.auth.getUser();
    const orderData = {
        user_id: user.user.id,
        items: selectedItems,
        total_price: selectedItems.reduce((s, i) => s + (i.price * i.quantity), 0),
        status: 'ongoing',
        created_at: new Date()
    };

    const { error } = await supabase.from('orders').insert(orderData);
    if (!error) {
        cart = cart.filter(item => !item.selected);
        saveCart();
        alert('購買成功！訂單已建立。');
        toggleCartModal();
        toggleOrdersModal();
    }
}

function toggleOrdersModal() {
    const modal = document.getElementById('orders-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) filterOrders('ongoing');
}

async function filterOrders(status) {
    // UI Tab 切換切換
    document.getElementById('order-tab-ongoing').className = status === 'ongoing' ? 'flex-1 py-3 border-b-2 border-pink-500' : 'flex-1 py-3 text-gray-400';
    document.getElementById('order-tab-completed').className = status === 'completed' ? 'flex-1 py-3 border-b-2 border-pink-500' : 'flex-1 py-3 text-gray-400';

    const { data: orders } = await supabase.from('orders').select('*').eq('status', status).order('created_at', { ascending: false });
    const list = document.getElementById('orders-list');
    
    if (!orders || orders.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-500">暫無訂單</p>`;
        return;
    }

    list.innerHTML = orders.map(order => `
        <div class="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <div class="flex justify-between mb-2">
                <span class="text-xs text-gray-500">訂單 ID: ${order.id.slice(0,8)}</span>
                <span class="text-xs ${order.status === 'ongoing' ? 'text-blue-400' : 'text-green-400'}">${order.status === 'ongoing' ? '進行中' : '已完成'}</span>
            </div>
            <div class="space-y-2">
                ${order.items.map(i => `<div class="text-sm flex justify-between"><span>${i.name} x${i.quantity}</span><span>${i.price * i.quantity}💰</span></div>`).join('')}
            </div>
            <div class="mt-3 pt-2 border-t border-gray-800 text-right font-bold text-pink-500">
                總金額: ${order.total_price} 金幣
            </div>
        </div>
    `).join('');
}
