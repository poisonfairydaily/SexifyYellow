/**
 * dashboard.js - 正式營運版 (支援軟刪除 is_archived + AI 審核)
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 🛡️ 0. 安全核心：防止 XSS 攻擊 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- 🔐 1. 初始化門禁檢查 ---
window.onload = async () => {
    const listContainer = document.getElementById('audit-list');
    try {
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError) throw new Error("驗證系統出錯: " + authError.message);
        
        if (!session) {
            alert("請先登入管理員帳號");
            window.location.href = 'index.html';
            return;
        }

        const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();

        if (pError || !profile?.is_admin) {
            alert("⚠️ 權限不足：你不是管理員！");
            window.location.href = 'index.html';
            return;
        }

        loadAuditList();

    } catch (err) {
        console.error("💥 門禁系統崩潰:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding:50px;">系統異常: ${err.message}</td></tr>`;
    }
};

// --- 📂 2. 抓取資料邏輯 ---
async function loadAuditList() {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;">🚀 正在載入活躍商品列表...</td></tr>';

    try {
        // ✨ 修改點：增加 .eq('is_archived', false)，不顯示已下架商品
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, reports(count)')
            .eq('is_archived', false) 
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderTable(products);

    } catch (err) {
        console.error("抓取失敗:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">抓取資料失敗: ${err.message}</td></tr>`;
    }
}

// --- 🖼️ 3. 渲染表格 ---
function renderTable(products) {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '';

    if (!products || products.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;color:gray;">目前沒有待處理的活躍商品</td></tr>';
        return;
    }

    products.forEach(p => {
        const report = p.ai_report || {};
        const allFiles = p.image_url?.split(',') || [];
        const imagesHtml = allFiles.map(fileName => {
            const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${fileName.trim()}`;
            return `<img src="${imgUrl}" onclick="openLightbox('${imgUrl}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; cursor: zoom-in;">`;
        }).join('');
        
        let reportCount = 0;
        if (p.reports && p.reports.length > 0) reportCount = p.reports[0].count;

        const getClr = (v) => (v === 'LIKELY' || v === 'VERY_LIKELY') ? '#ff4d4f' : '#8c8c8c';

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        tr.innerHTML = `
            <td style="padding: 15px;"><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 190px;">${imagesHtml}</div></td>
            <td style="padding: 15px;">
                <div style="font-weight:bold;">${escapeHTML(p.name)}</div>
                <div style="margin-top:5px;"><span style="font-size:10px; background:#f0f0f0; padding:2px 6px; border-radius:4px;">${p.status}</span></div>
                ${reportCount > 0 ? `<div style="color:#ff4d4f; font-size:11px;">⚠️ 檢舉: ${reportCount}</div>` : ''}
            </td>
            <td style="padding: 15px; font-weight:bold; color:#ff2442;">🪙 ${p.price}</td>
            <td style="padding: 15px; font-size: 11px; font-family: monospace;">
                <div style="color: ${getClr(report.violence)}">💀 暴力: ${report.violence || 'N/A'}</div>
                <div style="color: ${getClr(report.racy)}">👙 挑逗: ${report.racy || 'N/A'}</div>
            </td>
            <td style="padding: 15px;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button onclick="updateStatus('${p.id}', 'approved')" style="background:#52c41a; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer;">通過</button>
                    <button onclick="archiveProduct('${p.id}')" style="background:#ff4d4f; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer;">下架封存</button>
                </div>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

// --- 🔍 4. 燈箱與封存功能 ---
window.openLightbox = function(url) {
    let overlay = document.getElementById('audit-lightbox');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'audit-lightbox';
        overlay.className = 'lightbox-overlay'; // 配合 CSS 使用
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:none; align-items:center; justify-content:center; cursor:zoom-out;";
        overlay.onclick = () => overlay.style.display = 'none';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<img src="${url}" style="max-width:90%; max-height:90%; border-radius:8px;">`;
    overlay.style.display = 'flex';
};

// ✨ 核心功能：下架封存 (Soft Delete)
window.archiveProduct = async (id) => {
    const ok = confirm("確定要下架此商品嗎？\n下架後商品將不再商城顯示，但歷史訂單資料會被保留。");
    if (!ok) return;

    const { error } = await supabaseClient
        .from('products')
        .update({ is_archived: true }) // 將封存標記設為 true
        .eq('id', id);

    if (error) alert("下架失敗: " + error.message);
    else loadAuditList();
};

// --- ⚙️ 5. 更新審核狀態 ---
window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) alert("操作失敗: " + error.message);
    else loadAuditList();
};
