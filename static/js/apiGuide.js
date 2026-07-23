// API 接入教程弹窗交互
(function () {
    const openBtn = document.getElementById("openGuideBtn");
    const modal = document.getElementById("guideModal");
    const overlay = document.getElementById("guideOverlay");
    const closeBtn = document.getElementById("closeGuideBtn");

    if (!openBtn || !modal) return;

    function openGuide() {
        modal.classList.add("show");
    }

    function closeGuide() {
        modal.classList.remove("show");
    }

    openBtn.addEventListener("click", openGuide);
    closeBtn && closeBtn.addEventListener("click", closeGuide);
    overlay && overlay.addEventListener("click", closeGuide);
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeGuide();
    });

    // 页签切换
    const tabs = modal.querySelectorAll(".guide-tab");
    const panes = modal.querySelectorAll(".guide-pane");
    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            const key = tab.getAttribute("data-guide");
            tabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            panes.forEach(function (pane) {
                pane.classList.toggle(
                    "show",
                    pane.getAttribute("data-guide-pane") === key
                );
            });
        });
    });
})();
