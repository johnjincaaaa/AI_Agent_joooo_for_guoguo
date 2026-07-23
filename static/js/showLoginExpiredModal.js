// 🔥 终极豪华版：登录过期 / 免费次数用完 弹窗（毛玻璃 + 动画 + 图标 + 按钮）
// showLoginExpiredModal(meg, type, options)
//   options.showService: true 时额外显示「联系在线客服」按钮（需 config.CUSTOMER_SERVICE_URL 有值）
//   options.subtitle: 覆盖默认副标题文案
function showLoginExpiredModal(meg, type, options) {
    options = options || {};
    // 避免重复叠加：已有弹窗时先移除
    document.querySelectorAll('.login-expired-overlay').forEach(el => el.remove());

    if (typeof openBtn !== 'undefined' && openBtn) {
        openBtn.disabled = false;        // 启用按钮
        openBtn.style.cursor = 'pointer'; // 恢复小手光标
        openBtn.style.opacity = '1';     // 恢复正常透明度
    }

    // 遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'login-expired-overlay';
    overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.4); z-index: 9999;
    backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.3s ease forwards;
  `;

    // 弹窗主体（毛玻璃 + 滑入动画）
    const modal = document.createElement('div');
    modal.style.cssText = `
    width: 320px; max-width: calc(100vw - 40px); background: rgba(255,255,255,0.25); backdrop-filter: blur(20px);
    border-radius: 20px; padding: 30px; text-align: center; color: #fff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);
    animation: slideIn 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  `;

    // 动画样式
    const style = document.createElement('style');
    style.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateY(40px) scale(0.95); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes breath { 0% { box-shadow: 0 8px 32px rgba(255,80,80,0.4); } 50% { box-shadow: 0 8px 32px rgba(255,80,80,0.8); } 100% { box-shadow: 0 8px 32px rgba(255,80,80,0.4); } }
  `;
    document.head.appendChild(style);
    modal.style.animation = 'breath 2s infinite ease-in-out, slideIn 0.5s ease';

    // 是否展示在线客服按钮（需配置了客服链接）
    // config 在 config.js 中以 const 声明，不会挂到 window 上，用 typeof 安全读取
    const cfg = (typeof config !== 'undefined' && config) ? config : {};
    const serviceUrl = (cfg.CUSTOMER_SERVICE_URL || '').trim();
    const wantService = options.showService && serviceUrl;
    const subtitle = options.subtitle || (typeof t === 'function' ? t('modal_default_sub') : '请重新登录后继续使用');
    // 限流用完引导注册，其余场景（登录过期等）保持「立即登录」
    const goRegister = !!options.goRegister;
    const primaryLabel = goRegister
        ? (typeof t === 'function' ? t('modal_go_register') : '立即注册')
        : (typeof t === 'function' ? t('btn_do_login') : '立即登录');
    const serviceLabel = typeof t === 'function' ? t('float_service') : '在线客服';

    modal.innerHTML = `
    <div style="font-size: 50px; margin-bottom: 16px;">🔒</div>
    <h2 style="margin: 0 0 8px 0; font-size: 18px;">${meg}</h2>
    <p style="margin:0 0 24px 0; font-size:14px; opacity:0.9;">${subtitle}</p>
    <button id="loginModalBtn" style="padding:12px 24px; border-radius:12px; border:none; background:#ff4b4b; color:#fff; font-weight:bold; cursor:pointer; width:100%;">${primaryLabel}</button>
    ${wantService ? `<button id="serviceModalBtn" style="margin-top:12px; padding:12px 24px; border-radius:12px; border:1px solid rgba(255,255,255,0.5); background:transparent; color:#fff; font-weight:bold; cursor:pointer; width:100%;">${serviceLabel}</button>` : ''}
  `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 点击遮罩空白处关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // 「立即注册/登录」→ 打开登录弹窗（限流场景自动切到注册页）
    document.getElementById('loginModalBtn').onclick = () => {
        overlay.remove();
        const loginOpenBtn = document.getElementById('openLoginBtn');
        if (loginOpenBtn) loginOpenBtn.click();
        if (goRegister) {
            const regTab = document.querySelector('.tab[data-tab="register"]');
            if (regTab) regTab.click();
        }
    };

    // 「在线客服」→ 新标签页打开客服链接
    const serviceBtn = document.getElementById('serviceModalBtn');
    if (serviceBtn) {
        serviceBtn.onclick = () => {
            window.open(serviceUrl, '_blank', 'noopener');
        };
    }
}
