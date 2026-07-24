// 推广钱包 / 提现 面板：余额、累计推广人数、提现表单、提现记录。
// 面板切换沿用 jobHunt 的模式（隐藏 chatBox/输入区，显示 walletPanel），与找工作互斥。
(function () {
    let isWalletMode = false;

    const API_WALLET = () => `${config.API_BASE_URL}/ai/promo/wallet`;
    const API_WITHDRAW = () => `${config.API_BASE_URL}/ai/promo/withdraw`;

    function isLoggedIn() {
        const token = localStorage.getItem("token");
        return !!(token && token !== "null");
    }

    function statusText(status) {
        const map = {
            pending: t("wallet_status_pending"),
            paid: t("wallet_status_paid"),
            rejected: t("wallet_status_rejected"),
        };
        return map[status] || status;
    }

    function renderRecords(records) {
        const box = document.getElementById("walletRecords");
        if (!box) return;
        if (!records || !records.length) {
            box.innerHTML = `<p class="wallet-status-tip">${t("wallet_no_records")}</p>`;
            return;
        }
        box.innerHTML = records.map(r => `
            <div class="wallet-record">
                <div class="wallet-record-main">
                    <span class="wallet-record-amount">$${r.amount.toFixed(2)}</span>
                    <span class="wallet-record-email">${escapeHtml(r.paypal_email)}</span>
                </div>
                <div class="wallet-record-meta">
                    <span class="wallet-record-time">${escapeHtml(r.created_at || "")}</span>
                    <span class="wallet-badge wallet-badge-${r.status}">${statusText(r.status)}</span>
                </div>
            </div>
        `).join("");
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => (
            {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]
        ));
    }

    function loadWallet() {
        const balanceEl = document.getElementById("walletBalance");
        const countEl = document.getElementById("walletCount");
        fetch(API_WALLET(), {headers: buildAuthHeaders()})
            .then(r => {
                if (r.status === 401) {
                    if (typeof showLoginExpiredModal === "function") {
                        showLoginExpiredModal(t("login_expired"), "error");
                    }
                    return null;
                }
                return r.ok ? r.json() : null;
            })
            .then(data => {
                if (!data) return;
                if (balanceEl) balanceEl.textContent = (data.balance || 0).toFixed(2);
                if (countEl) countEl.textContent = data.referral_count || 0;
                renderRecords(data.records);
            })
            .catch(() => {});
    }

    function submitWithdraw() {
        const input = document.getElementById("walletPaypalInput");
        const statusEl = document.getElementById("walletWithdrawStatus");
        const email = (input?.value || "").trim();
        if (!email || email.indexOf("@") === -1) {
            if (statusEl) {
                statusEl.textContent = t("wallet_invalid_email");
                statusEl.className = "wallet-status-tip wallet-status-error";
            }
            return;
        }
        const btn = document.getElementById("walletWithdrawBtn");
        if (btn) btn.disabled = true;
        fetch(API_WITHDRAW(), {
            method: "POST",
            headers: buildAuthHeaders(),
            body: JSON.stringify({paypal_email: email}),
        })
            .then(async r => {
                const data = await r.json().catch(() => ({}));
                if (r.ok && data.code === 200) {
                    if (statusEl) {
                        statusEl.textContent = t("wallet_withdraw_ok");
                        statusEl.className = "wallet-status-tip wallet-status-ok";
                    }
                    if (input) input.value = "";
                    loadWallet();
                } else {
                    const msg = (data.detail && data.detail.msg) || data.msg || t("wallet_withdraw_fail");
                    if (statusEl) {
                        statusEl.textContent = msg;
                        statusEl.className = "wallet-status-tip wallet-status-error";
                    }
                }
            })
            .catch(() => {
                if (statusEl) {
                    statusEl.textContent = t("wallet_withdraw_fail");
                    statusEl.className = "wallet-status-tip wallet-status-error";
                }
            })
            .finally(() => {
                if (btn) btn.disabled = false;
            });
    }

    function enterWalletMode() {
        if (!isLoggedIn()) {
            if (typeof showLoginExpiredModal === "function") {
                showLoginExpiredModal(t("wallet_need_login"), "info",
                    {subtitle: t("wallet_need_login_sub")});
            }
            return;
        }
        // 与找工作面板互斥
        if (typeof exitJobHuntMode === "function") exitJobHuntMode();
        isWalletMode = true;

        document.querySelectorAll(".history.title").forEach(el => el.classList.remove("active"));
        document.getElementById("walletEntry")?.classList.add("active");

        document.getElementById("chatSession").textContent = t("wallet_title");
        document.querySelectorAll("#chatBox .message").forEach(el => el.remove());
        document.getElementById("emptyState")?.classList.add("hidden");

        document.getElementById("chatBox")?.classList.add("hidden");
        document.getElementById("walletPanel")?.classList.remove("hidden");
        document.querySelector(".input-area")?.classList.add("hidden");
        document.getElementById("scrollBottomBtn")?.classList.add("hidden");

        loadWallet();
    }

    function exitWalletMode() {
        if (!isWalletMode) return;
        isWalletMode = false;

        document.getElementById("walletEntry")?.classList.remove("active");
        document.getElementById("walletPanel")?.classList.add("hidden");
        document.getElementById("chatBox")?.classList.remove("hidden");
        document.querySelector(".input-area")?.classList.remove("hidden");
        document.getElementById("scrollBottomBtn")?.classList.remove("hidden");

        const hasMessages = document.querySelectorAll("#chatBox .message").length > 0;
        document.getElementById("emptyState")?.classList.toggle("hidden", hasMessages);
    }

    function initWallet() {
        document.getElementById("walletEntry")?.addEventListener("click", enterWalletMode);
        document.getElementById("walletWithdrawBtn")?.addEventListener("click", submitWithdraw);
    }

    // 暴露给其它模块（jobHunt/新建会话时可调用退出）
    window.enterWalletMode = enterWalletMode;
    window.exitWalletMode = exitWalletMode;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initWallet);
    } else {
        initWallet();
    }
})();
