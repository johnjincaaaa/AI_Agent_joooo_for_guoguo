// 后台管理前端（原生 JS，无外部依赖）
(function () {
    const API = window.location.origin;
    const TOKEN_KEY = "admin_token";

    // 配置项的中文标签 + 是否多行
    const CONFIG_META = {
        reward_base:          {label: "单人推广奖励（美金）", type: "input"},
        tier_threshold:       {label: "阶梯奖励人数阈值", type: "input"},
        tier_bonus:           {label: "阶梯额外奖励（美金）", type: "input"},
        tier_membership_days: {label: "阶梯赠送会员天数（-1=永久）", type: "input"},
        link_cache_days:      {label: "推广链接缓存有效期（天）", type: "input"},
        promo_enabled:        {label: "分享/横幅总开关（1开 0关）", type: "input"},
        input_promo_enabled:  {label: "输入框推广文案开关（1开 0关）", type: "input"},
        landing_base_url:     {label: "专属链接跳转地址", type: "input"},
        popup_intro_zh:       {label: "分享弹窗介绍·中文", type: "textarea"},
        popup_intro_en:       {label: "分享弹窗介绍·英文", type: "textarea"},
        input_promo_zh:       {label: "输入框推广文案·中文", type: "textarea"},
        input_promo_en:       {label: "输入框推广文案·英文", type: "textarea"},
        banner_promo_zh:      {label: "空状态横幅·中文", type: "textarea"},
        banner_promo_en:      {label: "空状态横幅·英文", type: "textarea"},
    };

    function token() { return sessionStorage.getItem(TOKEN_KEY); }
    function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); }
    function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

    function authHeaders() {
        return {"Content-Type": "application/json", "Authorization": "Bearer " + token()};
    }

    // 统一请求：401 自动回登录框
    async function api(path, opts) {
        opts = opts || {};
        opts.headers = Object.assign(authHeaders(), opts.headers || {});
        const res = await fetch(API + path, opts);
        if (res.status === 401) {
            clearToken();
            showLogin();
            throw new Error("unauthorized");
        }
        return res;
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
            {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    }

    // ---------------- 登录 ----------------
    function showLogin() {
        document.getElementById("adminLogin").hidden = false;
        document.getElementById("adminShell").hidden = true;
    }
    function showShell() {
        document.getElementById("adminLogin").hidden = true;
        document.getElementById("adminShell").hidden = false;
        loadDashboard();
    }

    async function doLogin() {
        const u = document.getElementById("adminUser").value.trim();
        const p = document.getElementById("adminPass").value;
        const err = document.getElementById("adminLoginErr");
        err.textContent = "";
        try {
            const res = await fetch(API + "/admin/api/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({username: u, password: p}),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.token) {
                setToken(data.token);
                showShell();
            } else {
                err.textContent = (data.detail && data.detail.msg) || data.msg || "登录失败";
            }
        } catch (e) {
            err.textContent = "网络错误，请重试";
        }
    }

    // ---------------- 数据看板 ----------------
    async function loadDashboard() {
        try {
            const res = await api("/admin/api/stats");
            const d = await res.json();
            renderStats(d);
            renderTrend(d.trend || []);
        } catch (e) { /* 401 已处理 */ }
    }

    function statCard(label, value, sub, hi) {
        return `<div class="stat-card${hi ? ' hi' : ''}">
            <div class="label">${esc(label)}</div>
            <div class="value">${esc(value)}</div>
            ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
        </div>`;
    }

    function renderStats(d) {
        const grid = document.getElementById("statGrid");
        grid.innerHTML = [
            statCard("网站访问 PV（总）", d.pv_total, "今日 +" + d.pv_today),
            statCard("独立访客 UV（总）", d.uv_total, "今日 +" + d.uv_today),
            statCard("下载点击（总）", d.download_total, "今日 +" + d.download_today),
            statCard("有效推广（总）", d.referral_total, ""),
            statCard("累计发放美金", "$" + d.rewarded_total, "", true),
            statCard("注册用户", d.total_users, "今日 +" + d.today_users),
            statCard("待审核提现", d.withdraw_pending_count + " 笔", "$" + d.withdraw_pending_amount, true),
        ].join("");
    }

    // 纯 SVG 分组柱状图
    function renderTrend(trend) {
        const box = document.getElementById("trendChart");
        if (!trend.length) { box.innerHTML = "<p class='empty-row'>暂无数据</p>"; return; }
        const series = [
            {key: "pv", color: "#4c8dff"},
            {key: "uv", color: "#2fae6a"},
            {key: "download", color: "#f0a02a"},
            {key: "referral", color: "#c07cff"},
        ];
        const W = Math.max(560, trend.length * 90), H = 220, padB = 28, padT = 12, padL = 30;
        const maxVal = Math.max(1, ...trend.flatMap(d => series.map(s => d[s.key] || 0)));
        const groupW = (W - padL) / trend.length;
        const barW = Math.min(14, (groupW - 12) / series.length);
        const chartH = H - padB - padT;

        let bars = "";
        trend.forEach((d, gi) => {
            const gx = padL + gi * groupW + (groupW - barW * series.length) / 2;
            series.forEach((s, si) => {
                const v = d[s.key] || 0;
                const h = Math.round((v / maxVal) * chartH);
                const x = gx + si * barW;
                const y = padT + chartH - h;
                bars += `<rect x="${x}" y="${y}" width="${barW - 2}" height="${h}" rx="2" fill="${s.color}"><title>${d.date} ${s.key}: ${v}</title></rect>`;
                if (v > 0) bars += `<text x="${x + (barW - 2) / 2}" y="${y - 3}" font-size="9" fill="#9aa1ad" text-anchor="middle">${v}</text>`;
            });
            bars += `<text x="${padL + gi * groupW + groupW / 2}" y="${H - 8}" font-size="11" fill="#9aa1ad" text-anchor="middle">${d.date}</text>`;
        });
        // 基线
        bars += `<line x1="${padL}" y1="${padT + chartH}" x2="${W}" y2="${padT + chartH}" stroke="rgba(255,255,255,0.12)"/>`;
        box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${bars}</svg>`;
    }

    // ---------------- 提现审批 ----------------
    async function loadWithdraws() {
        const status = document.getElementById("withdrawFilter").value;
        try {
            const res = await api("/admin/api/withdraws" + (status ? "?status=" + status : ""));
            const d = await res.json();
            const tb = document.getElementById("withdrawTbody");
            if (!d.withdraws.length) {
                tb.innerHTML = `<tr><td colspan="7" class="empty-row">暂无记录</td></tr>`;
                return;
            }
            tb.innerHTML = d.withdraws.map(w => {
                const badge = `<span class="badge badge-${w.status}">${statusZh(w.status)}</span>`;
                const actions = w.status === "pending"
                    ? `<button class="act-btn act-approve" data-approve="${w.id}">通过</button>
                       <button class="act-btn act-reject" data-reject="${w.id}">驳回</button>`
                    : (w.reviewed_at || "—");
                return `<tr>
                    <td>${w.id}</td><td>${esc(w.username)}</td>
                    <td>$${w.amount}</td><td>${esc(w.paypal_email)}</td>
                    <td>${badge}</td><td>${esc(w.created_at)}</td><td>${actions}</td>
                </tr>`;
            }).join("");
        } catch (e) { /* 401 处理过 */ }
    }

    function statusZh(s) {
        return {pending: "待审核", paid: "已到账", rejected: "已驳回"}[s] || s;
    }

    async function handleWithdrawAction(id, action) {
        const verb = action === "approve" ? "通过" : "驳回";
        if (!confirm(`确认${verb}提现 #${id}？` + (action === "reject" ? "\n驳回后金额会退回用户余额。" : ""))) return;
        try {
            const res = await api(`/admin/api/withdraws/${id}/${action}`, {method: "POST"});
            const d = await res.json().catch(() => ({}));
            if (res.ok) { loadWithdraws(); }
            else alert((d.detail && d.detail.msg) || "操作失败");
        } catch (e) { /* 401 */ }
    }

    // ---------------- 用户管理 ----------------
    async function loadUsers() {
        const q = document.getElementById("userSearch").value.trim();
        try {
            const res = await api("/admin/api/users?limit=100&q=" + encodeURIComponent(q));
            const d = await res.json();
            const tb = document.getElementById("userTbody");
            if (!d.users.length) {
                tb.innerHTML = `<tr><td colspan="8" class="empty-row">无用户</td></tr>`;
                return;
            }
            tb.innerHTML = d.users.map(u => `<tr>
                <td>${u.id}</td><td>${esc(u.username)}</td>
                <td>$${u.balance}</td><td>${u.referral_count}</td>
                <td>${esc(u.referral_code || "—")}</td><td>${esc(u.membership_expire_at || "—")}</td>
                <td>${esc(u.register_time)}</td>
                <td><button class="act-btn act-edit" data-adjust="${u.id}" data-name="${esc(u.username)}" data-bal="${u.balance}">调整余额</button></td>
            </tr>`).join("");
        } catch (e) { /* 401 */ }
    }

    async function adjustBalance(uid, username, curBal) {
        const input = prompt(`调整用户「${username}」余额（当前 $${curBal}）\n输入增减金额，正数加钱、负数扣钱：`, "");
        if (input === null) return;
        const amount = parseFloat(input);
        if (isNaN(amount) || amount === 0) { alert("请输入有效的非零数字"); return; }
        try {
            const res = await api(`/admin/api/users/${uid}/balance`, {
                method: "POST",
                body: JSON.stringify({amount: amount, reason: "admin adjust"}),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok) { alert(`已调整，新余额 $${d.balance}`); loadUsers(); }
            else alert((d.detail && d.detail.msg) || "调整失败");
        } catch (e) { /* 401 */ }
    }

    // ---------------- 配置管理 ----------------
    async function loadConfig() {
        try {
            const res = await api("/admin/api/config");
            const d = await res.json();
            const cfg = d.config || {};
            const form = document.getElementById("configForm");
            form.innerHTML = Object.keys(CONFIG_META).map(key => {
                const meta = CONFIG_META[key];
                const val = cfg[key] != null ? cfg[key] : "";
                const field = meta.type === "textarea"
                    ? `<textarea data-key="${key}">${esc(val)}</textarea>`
                    : `<input type="text" data-key="${key}" value="${esc(val)}">`;
                return `<div class="config-item">
                    <label>${esc(meta.label)} <span class="key-name">${key}</span></label>
                    ${field}
                </div>`;
            }).join("");
        } catch (e) { /* 401 */ }
    }

    async function saveConfig() {
        const items = {};
        document.querySelectorAll("#configForm [data-key]").forEach(el => {
            items[el.getAttribute("data-key")] = el.value;
        });
        const status = document.getElementById("configStatus");
        try {
            const res = await api("/admin/api/config", {method: "POST", body: JSON.stringify({items})});
            const d = await res.json().catch(() => ({}));
            if (res.ok) {
                status.textContent = "已保存 " + (d.updated ? d.updated.length : 0) + " 项配置";
                status.className = "config-status ok";
            } else {
                status.textContent = (d.detail && d.detail.msg) || "保存失败";
                status.className = "config-status err";
            }
        } catch (e) { /* 401 */ }
        setTimeout(() => { status.textContent = ""; }, 3000);
    }

    // ---------------- 标签切换 ----------------
    function switchTab(tab) {
        document.querySelectorAll(".admin-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
        document.querySelectorAll(".admin-panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + tab));
        if (tab === "dashboard") loadDashboard();
        else if (tab === "withdraws") loadWithdraws();
        else if (tab === "users") loadUsers();
        else if (tab === "config") loadConfig();
    }

    // ---------------- 初始化 ----------------
    function init() {
        document.getElementById("adminLoginBtn").addEventListener("click", doLogin);
        document.getElementById("adminPass").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
        document.getElementById("adminLogoutBtn").addEventListener("click", () => { clearToken(); showLogin(); });

        document.querySelectorAll(".admin-tab").forEach(t =>
            t.addEventListener("click", () => switchTab(t.dataset.tab)));

        document.getElementById("withdrawRefresh").addEventListener("click", loadWithdraws);
        document.getElementById("withdrawFilter").addEventListener("change", loadWithdraws);
        document.getElementById("userRefresh").addEventListener("click", loadUsers);
        document.getElementById("userSearch").addEventListener("keydown", e => { if (e.key === "Enter") loadUsers(); });
        document.getElementById("configSaveBtn").addEventListener("click", saveConfig);

        // 事件委托：提现操作 / 调整余额
        document.getElementById("withdrawTbody").addEventListener("click", e => {
            const ap = e.target.getAttribute("data-approve");
            const rj = e.target.getAttribute("data-reject");
            if (ap) handleWithdrawAction(ap, "approve");
            if (rj) handleWithdrawAction(rj, "reject");
        });
        document.getElementById("userTbody").addEventListener("click", e => {
            const uid = e.target.getAttribute("data-adjust");
            if (uid) adjustBalance(uid, e.target.getAttribute("data-name"), e.target.getAttribute("data-bal"));
        });

        // 有 token 直接进后台，否则登录
        if (token()) showShell(); else showLogin();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
