// 右侧悬浮栏：分享APP / 下载APP / 在线客服。
// - 下载/客服链接来自 config.js（留空自动隐藏）
// - 下载按钮点击时携带缓存的推广码 + 指纹上报服务器完成溯源发奖
// - 分享按钮弹出专属链接弹窗
(function () {
    // config 在 config.js 中以 const 声明，不会挂到 window 上，这里用 typeof 安全读取
    function getConfig() {
        return (typeof config !== "undefined" && config) ? config : {};
    }

    function bindLink(btnId, url) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const link = (url || "").trim();
        if (link) {
            btn.href = link;
            btn.hidden = false;
        } else {
            btn.hidden = true;
        }
    }

    // ---------------- 下载按钮：溯源埋点 ----------------
    function getSlugFromUrl() {
        // 分发链接 /go/{slug} 跳转过来时 URL 带 ?slug=xxx，读取用于 link_slug 埋点
        try {
            return (new URLSearchParams(window.location.search)).get("slug") || "";
        } catch (e) { return ""; }
    }

    function trackDownload() {
        const ref = typeof getReferral === "function" ? getReferral() : "";
        const slug = getSlugFromUrl();
        // 无推广来源且无分发链接 slug 则不上报（两个都没意义）
        if (!ref && !slug) return;
        const fingerprint = typeof getFingerprint === "function" ? getFingerprint() : "";
        try {
            fetch(`${getConfig().API_BASE_URL || ""}/ai/promo/track-download`, {
                method: "POST",
                headers: (typeof buildAuthHeaders === "function")
                    ? buildAuthHeaders()
                    : {"Content-Type": "application/json"},
                body: JSON.stringify({ref, fingerprint, slug}),
                keepalive: true, // 即使随后页面跳转也尽量把请求发出去
            }).catch(() => {});
        } catch (e) {
            // 上报失败不影响下载
        }
    }

    // ---------------- 分享弹窗 ----------------
    function isLoggedInLocal() {
        const token = localStorage.getItem("token");
        return !!(token && token !== "null");
    }

    function openShareModal() {
        // 未登录：无法生成专属链接，引导登录
        if (!isLoggedInLocal()) {
            if (typeof showLoginExpiredModal === "function") {
                showLoginExpiredModal(
                    typeof t === "function" ? t("share_need_login") : "登录后才能获取你的专属推广链接",
                    "info",
                    {subtitle: typeof t === "function" ? t("share_need_login_sub") : "登录即可分享赚美金"}
                );
            }
            return;
        }
        const modal = document.getElementById("shareModal");
        if (!modal) return;
        modal.classList.add("show");
        loadShareContent();
    }

    function closeShareModal() {
        const modal = document.getElementById("shareModal");
        if (modal) modal.classList.remove("show");
    }

    function applyShareIntro() {
        const introEl = document.getElementById("shareIntro");
        if (introEl && window._promoIntro) {
            const lang = typeof getLang === "function" ? getLang() : "zh";
            introEl.textContent = window._promoIntro[lang] || window._promoIntro.zh || "";
        }
    }

    function loadShareContent() {
        const input = document.getElementById("shareLinkInput");
        const base = getConfig().API_BASE_URL || "";
        // 介绍文案
        fetch(`${base}/ai/promo/config`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.popup_intro) {
                    window._promoIntro = data.popup_intro;
                    applyShareIntro();
                }
            })
            .catch(() => {});
        // 专属链接
        if (input) input.value = "...";
        fetch(`${base}/ai/promo/my-link`, {
            headers: (typeof buildAuthHeaders === "function")
                ? buildAuthHeaders()
                : {"Content-Type": "application/json"},
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.link && input) {
                    input.value = data.link;
                } else if (input) {
                    input.value = "";
                }
            })
            .catch(() => {
                if (input) input.value = "";
            });
    }

    function copyLink() {
        const input = document.getElementById("shareLinkInput");
        const btn = document.getElementById("shareCopyBtn");
        if (!input || !input.value) return;
        const done = () => {
            if (btn) {
                const original = typeof t === "function" ? t("share_copy_btn") : "一键复制";
                btn.textContent = typeof t === "function" ? t("share_copied") : "已复制";
                btn.classList.add("copied");
                setTimeout(() => {
                    btn.textContent = original;
                    btn.classList.remove("copied");
                }, 1800);
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value).then(done).catch(() => fallbackCopy(input, done));
        } else {
            fallbackCopy(input, done);
        }
    }

    function fallbackCopy(input, done) {
        input.removeAttribute("readonly");
        input.select();
        try {
            document.execCommand("copy");
            done();
        } catch (e) {
            // ignore
        }
        input.setAttribute("readonly", "readonly");
        window.getSelection().removeAllRanges();
    }

    function initFloatDock() {
        const cfg = getConfig();
        bindLink("floatAppBtn", cfg.APP_DOWNLOAD_URL);
        bindLink("floatServiceBtn", cfg.CUSTOMER_SERVICE_URL);

        // 下载按钮埋点（不阻止默认跳转）
        const appBtn = document.getElementById("floatAppBtn");
        if (appBtn) appBtn.addEventListener("click", trackDownload);

        // 分享按钮
        const shareBtn = document.getElementById("floatShareBtn");
        if (shareBtn) shareBtn.addEventListener("click", openShareModal);

        // 弹窗交互
        const closeBtn = document.getElementById("closeShareBtn");
        const overlay = document.getElementById("shareOverlay");
        const copyBtn = document.getElementById("shareCopyBtn");
        if (closeBtn) closeBtn.addEventListener("click", closeShareModal);
        if (overlay) overlay.addEventListener("click", closeShareModal);
        if (copyBtn) copyBtn.addEventListener("click", copyLink);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeShareModal();
        });
        // 语言切换时刷新弹窗介绍文案
        document.addEventListener("langchange", applyShareIntro);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initFloatDock);
    } else {
        initFloatDock();
    }
})();
