// 右侧悬浮图标：把 config.js 中自定义的链接绑定到「在线客服」「下载App」上。
// 链接留空时自动隐藏对应图标。
(function () {
    function bindDockItem(btnId, url) {
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

    // config 在 config.js 中以 const 声明，不会挂到 window 上，这里用 typeof 安全读取
    function getConfig() {
        return (typeof config !== "undefined" && config) ? config : {};
    }

    function initFloatDock() {
        const cfg = getConfig();
        bindDockItem("floatServiceBtn", cfg.CUSTOMER_SERVICE_URL);
        bindDockItem("floatAppBtn", cfg.APP_DOWNLOAD_URL);
    }

    // 供限流用完时的弹窗复用：跳转到在线客服（新标签页）
    window.openCustomerService = function () {
        const link = (getConfig().CUSTOMER_SERVICE_URL || "").trim();
        if (link) {
            window.open(link, "_blank", "noopener");
            return true;
        }
        return false;
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initFloatDock);
    } else {
        initFloatDock();
    }
})();
