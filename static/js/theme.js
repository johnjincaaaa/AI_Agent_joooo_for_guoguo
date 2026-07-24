// 亮/暗主题切换。
// - 主题写在 <html data-theme="light|dark">，CSS 变量据此覆盖
// - 选择持久化到 localStorage('app_theme')
// - <head> 里有一段提前执行的脚本先设好 data-theme，避免刷新闪暗色
//   默认（无存储）走暗色主题（不设 data-theme，用 :root 默认值）
(function () {
    const THEME_STORAGE_KEY = 'app_theme';

    function getTheme() {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch (e) {}
        return 'dark';
    }

    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else {
            root.setAttribute('data-theme', 'dark');
        }
        updateThemeToggleLabel();
        // 广播，供需要感知主题的模块（如代码高亮）响应
        document.dispatchEvent(new CustomEvent('themechange', {detail: {theme}}));
    }

    function setTheme(theme) {
        const next = theme === 'light' ? 'light' : 'dark';
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch (e) {}
        applyTheme(next);
    }

    function toggleTheme() {
        setTheme(getTheme() === 'light' ? 'dark' : 'light');
    }

    // 按钮里有太阳/月亮两个图标，靠 CSS 根据当前主题显隐；这里只更新提示文案
    function updateThemeToggleLabel() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const goingToLight = getTheme() !== 'light';
        // 优先用 i18n 文案，未加载时兜底中文
        const tf = (typeof t === 'function') ? t : null;
        btn.title = goingToLight
            ? (tf ? tf('theme_to_light') : '切换到亮色主题')
            : (tf ? tf('theme_to_dark') : '切换到暗色主题');
    }

    // 暴露到全局
    window.getTheme = getTheme;
    window.setTheme = setTheme;
    window.toggleTheme = toggleTheme;

    function init() {
        // data-theme 已由 head 脚本按存储设好；这里补一次确保按钮状态一致
        applyTheme(getTheme());
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.addEventListener('click', toggleTheme);
        // 语言切换后刷新一下 title 文案
        document.addEventListener('langchange', updateThemeToggleLabel);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
