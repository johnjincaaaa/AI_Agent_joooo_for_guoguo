// ==============================
// 智能联网按钮开关
// ==============================
const searchBtn = document.getElementById('searchBtn');
const netStatus = document.getElementById('netStatus');
const netText = document.querySelector('.net-text');

// 联网开关状态
let isNetEnabled = false;

searchBtn.addEventListener('click', () => {
    isNetEnabled = !isNetEnabled;

    if (isNetEnabled) {
        searchBtn.classList.add('active');
        netStatus.classList.add('online');
        netText.textContent = t('net_on');
    } else {
        searchBtn.classList.remove('active');
        netStatus.classList.remove('online');
        netText.textContent = t('net_off');
    }
});

// 语言切换时，同步联网状态文案（静态 data-i18n 只处理默认“未联网”）
document.addEventListener('langchange', () => {
    netText.textContent = isNetEnabled ? t('net_on') : t('net_off');
});


// 输入框自动高度扩展逻辑
const userInput = document.getElementById('userInput');

// 监听输入事件，实时调整高度
userInput.addEventListener('input', function () {
    // 先重置高度，再根据内容计算
    this.style.height = 'auto';
    // 设置高度为内容高度，但不超过max-height
    const newHeight = Math.min(this.scrollHeight, 300); // 300 和 CSS 里的 max-height 一致
    this.style.height = newHeight + 'px';
});

// 初始化：加载时设置一次初始高度
userInput.dispatchEvent(new Event('input'));