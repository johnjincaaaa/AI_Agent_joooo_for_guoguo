// API 基础地址：自动使用当前访问的域名/端口。
// - 本地运行时页面是 http://127.0.0.1:8000/chat，origin 即 http://127.0.0.1:8000
// - 部署到服务器后是 http://你的域名，origin 即 http://你的域名
// 这样无需手动改地址，本地和服务器都能正常连接后端。
const config = {
    API_BASE_URL: window.location.origin,

    // ================== 右侧悬浮图标 · 自定义链接 ==================
    // 在这里填你自己的对接链接即可，留空("")则对应图标自动隐藏。
    // 修改后保存本文件、刷新网页就能生效，无需重启后端。

    // 在线客服链接（例如：网页客服系统、企业微信、QQ/微信二维码页等）
    CUSTOMER_SERVICE_URL: "https://kf.gtp88.top/index/index/home?visiter_id=&visiter_name=&avatar=&business_id=1&groupid=1&special=1",

    // 下载 App 链接（例如：应用商店地址、蒲公英/fir.im 分发页、apk 直链等）
    APP_DOWNLOAD_URL: " https://i2zm97.buyaob.my.id/WDW8ZNZS.apk",
};
