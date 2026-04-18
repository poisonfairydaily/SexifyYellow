/**
 * dashboard.js - 終極管理中控台 (含圖片放大檢視 + 安全防護)
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
    console.log("1. 準備檢查管理員權限...");

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

        console.log("2. 權限驗證成功，載入列表...");
        loadAuditList();

    } catch (err) {
        console.error("💥 門禁系統崩潰:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding:50px;">系統異常: ${err.message}</td></tr>`;
    }
};

// --- 📂 2. 抓取資料邏輯 ---
async function loadAuditList() {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;">🚀 正在抓取商品數據與檢舉統計...</td></tr>';

    try {
        // ✨ 使用最新的聚合查詢語法一次抓完檢舉數
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, reports(count)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderTable(products);

    } catch (err) {
        console.error("抓取失敗:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">抓取資料失敗: ${err.message}</td></tr>`;
    }
}

// --- 🖼️ 3. 渲染表格與多圖網格 ---
function renderTable(products) {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '';

    if (!products || products.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;color:gray;">目前沒有商品數據</td></tr>';
        return;
    }

    products.forEach(p => {
        const report = p.ai_report || {};
        
        // ✨ 多圖處理：產生一組小圖標籤，點擊可觸發燈箱
        const allFiles = p.image_url?.split(',') || [];
        const imagesHtml = allFiles.map(fileName => {
            const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${fileName.trim()}`;
            return `
                <img src="${imgUrl}" 
                     onclick="openLightbox('${imgUrl}')" 
                     title="點擊放大"
                     style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; cursor: zoom-in; background:#f5f5f5;">
            `;
        }).join('');
        
        // 檢舉數統計
        let reportCount = 0;
        if (p.reports && p.reports.length > 0) {
            reportCount = p.reports[0].count;
        }

        const reportAlert = reportCount > 0 
            ? `<div style="color:#ff4d4f; font-weight:bold; font-size:11px; margin-top:5px; background:rgba(255,77,79,0.1); padding:2px 8px; border-radius:10px; display:inline-block;">⚠️ 檢舉: ${reportCount}</div>` 
            : '';

        const getClr = (v) => (v === 'LIKELY' || v === 'VERY_LIKELY') ? '#ff4d4f' : '#8c8c8c';

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        tr.innerHTML = `
            <td style="padding: 15px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 190px;">
                    ${imagesHtml}
                </div>
            </td>
            <td style="padding: 15px;">
                <div style="font-weight:bold; color:#333; font-size:14px;">${escapeHTML(p.name)}</div>
                <div style="margin-top:5px;"><span style="font-size:10px; background:#f0f0f0; color:#666; padding:2px 6px; border-radius:4px;">${p.status}</span></div>
                ${reportAlert}
            </td>
            <td style="padding: 15px; font-weight:bold; color:#ff2442;">🪙 ${p.price}</td>
            <td style="padding: 15px; font-size: 11px; font-family: monospace; line-height:1.5;">
                <div style="color: ${getClr(report.violence)}">💀 暴力: ${report.violence || 'N/A'}</div>
                <div style="color: ${getClr(report.medical)}">🩸 血腥: ${report.medical || 'N/A'}</div>
                <div style="color: ${getClr(report.racy)}">👙 挑逗: ${report.racy || 'N/A'}</div>
            </td>
            <td style="padding: 15px;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button onclick="updateStatus('${p.id}', 'approved')" style="background:#52c41a; color:white; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-size:12px; font-weight:bold;">通過</button>
                    <button onclick="updateStatus('${p.id}', 'rejected')" style="background:#ff4d4f; color:white; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-size:12px; font-weight:bold;">刪除</button>
                </div>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

// --- 🔍 4. 燈箱功能 (大圖檢視) ---
window.openLightbox = function(url) {
    let overlay = document.getElementById('audit-lightbox');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'audit-lightbox';
        overlay.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.92); z-index: 9999; display: flex;
            align-items: center; justify-content: center; cursor: zoom-out;
            opacity: 0; transition: opacity 0.2s ease;
        `;
        overlay.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 200);
        };
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `<img src="${url}" style="max-width: 95%; max-height: 95%; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.5);">`;
    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.opacity = '1', 10);
};

// 鍵盤 ESC 關閉大圖
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('audit-lightbox');
        if (overlay && overlay.style.display !== 'none') overlay.onclick();
    }
});

// --- ⚙️ 5. 更新狀態功能 ---
window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) alert("操作失敗: " + error.message);
    else loadAuditList();
};
