// 访客溯源：读取链接里的 ?ref=<推广码>，缓存到 localStorage；生成浏览器指纹。
// 下载按钮点击时会带上这两个值上报服务器完成溯源发奖。
(function () {
    const REF_KEY = "promo_ref";        // {code, ts}
    const FP_KEY = "promo_visitor_fp";  // 浏览器指纹（随机uuid）
    // 默认缓存有效期（天）；实际以后端 /ai/promo/config 的 link_cache_days 为准
    let cacheDays = 30;

    function nowMs() {
        return new Date().getTime();
    }

    function genUUID() {
        if (window.crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return "fp-" + nowMs().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
    }

    // 读取 URL 上的 ref 并写入缓存
    function captureRefFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const ref = (params.get("ref") || "").trim();
            if (ref) {
                localStorage.setItem(REF_KEY, JSON.stringify({code: ref, ts: nowMs()}));
            }
        } catch (e) {
            console.warn("captureRef failed", e);
        }
    }

    // 取有效期内的推广码，过期返回 ""
    function getReferral() {
        try {
            const raw = localStorage.getItem(REF_KEY);
            if (!raw) return "";
            const obj = JSON.parse(raw);
            if (!obj || !obj.code) return "";
            const ageMs = nowMs() - (obj.ts || 0);
            if (ageMs > cacheDays * 24 * 3600 * 1000) {
                localStorage.removeItem(REF_KEY);
                return "";
            }
            return obj.code;
        } catch (e) {
            return "";
        }
    }

    // 取（或生成）浏览器指纹
    function getFingerprint() {
        let fp = localStorage.getItem(FP_KEY);
        if (!fp) {
            fp = genUUID();
            localStorage.setItem(FP_KEY, fp);
        }
        return fp;
    }

    // 从后端同步缓存有效期
    function syncCacheDays() {
        fetch(`${config.API_BASE_URL}/ai/promo/config`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && typeof data.link_cache_days === "number" && data.link_cache_days > 0) {
                    cacheDays = data.link_cache_days;
                }
            })
            .catch(() => {});
    }

    // 立即执行：先抓 ref（不依赖 DOM），再确保指纹存在
    captureRefFromUrl();
    getFingerprint();
    syncCacheDays();

    // 暴露给 floatDock.js 使用
    window.getReferral = getReferral;
    window.getFingerprint = getFingerprint;
})();
