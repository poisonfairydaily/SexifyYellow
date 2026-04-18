/**
 * dashboard.js - 終極管理中控台 (多圖顯示 + 安全防護版)
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 🛡️ 安全核心：防止 XSS 攻擊的文字過濾器 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.onload = async () => {
    const listContainer = document.getElementById('audit-list');
    console.log("1. 頁面載入成功，準備檢查 Session");

    try {
        // 檢查登入
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError) throw new Error("驗證系統出錯: " + authError.message);
        
        if (!session) {
            console.warn("未登入");
            alert("請先登入管理員帳號");
            window.location.href = 'index.html';
            return;
        }
        console.log("2. 登入檢查通過，UID:", session.user.id);

        // 檢查管理員權限
        const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();

        if (pError) {
            console.error("Profile 讀取失敗:", pError);
            throw new Error("無法讀取權限資料，請檢查 profiles 表 RLS 設定");
        }

        if (!profile?.is_admin) {
            alert("⚠️ 權限不足：你不是管理員！");
            window.location.href = 'index.html';
            return;
        }

        console.log("3. 管理員驗證成功，準備抓取資料");
        loadAuditList();

    } catch (err) {
        console.error("💥 門禁系統崩潰:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding:50px;">
            系統異常: ${err.message}<br>請按 F12 檢查 Console 報錯。
        </td></tr>`;
    }
};

async function loadAuditList() {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;">🚀 正在抓取商品數據與檢舉統計...</td></tr>';

    try {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, reports(count)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("抓取產品失敗:", error);
            throw error;
        }

        console.log("4. 資料抓取成功:", products);
        renderTable(products);

    } catch (err) {
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">抓取資料失敗: ${err.message}</td></tr>`;
    }
}

function renderTable(products) {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '';

    if (!products || products.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;color:gray;">目前沒有商品數據</td></tr>';
        return;
    }

    products.forEach(p => {
        const report = p.ai_report || {};
        
        // ✨ 修改 1：處理多圖顯示
        const allFiles = p.image_url?.split(',') || [];
        const imagesHtml = allFiles.map(fileName => {
            // 注意：這裡使用 previews bucket 以節省載入頻寬
            const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${fileName.trim()}`;
            return `<img src="${imgUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; background:#f5f5f5;">`;
        }).join('');
        
        // 檢舉數提取
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

window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) alert("操作失敗: " + error.message);
    else loadAuditList();
};
