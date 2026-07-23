// 打开/关闭弹窗
const openBtn = document.getElementById('openLoginBtn');
const closeBtn = document.getElementById('closeLoginBtn');
const modal = document.getElementById('loginModal');
/* global marked */
// 验证登录状态
const isLogining = window.localStorage.getItem('token');
if (isLogining) {
    openBtn.textContent = t('logged_in');
    // ✅ 核心：关闭按钮操作（禁用点击）
    openBtn.disabled = true;          // 禁用按钮（无法点击）
    openBtn.style.cursor = 'not-allowed'; // 鼠标变成禁止图标
    openBtn.style.opacity = '0.3';    // 视觉上变灰（可选）
    // 登录成功时初始化头像状态
    initUserProfile();
    // 登录成功时初始化历史会话记录
    initHistory().then(r => {
        console.log(r)
    });
} else {
    openBtn.textContent = t('not_logged_in');
    showLoginExpiredModal(t('please_login'), 'error');
}
// 打开弹窗
openBtn.onclick = () => {
    modal.style.display = 'block';
};

// 关闭弹窗
closeBtn.onclick = () => {
    modal.style.display = 'none';
};

// 密码可视切换
document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.classList.toggle('visible', show);
        btn.setAttribute('aria-label', show ? t('hide_pwd') : t('show_pwd'));
        btn.title = show ? t('hide_pwd') : t('show_pwd');
    });
});


// 登录/注册 切换
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.form-box');

// 点哪个标签哪个标签亮 && 表单show
tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('show'));
        tab.classList.add('active');
        const type = tab.dataset.tab;
        document.getElementById(type + 'Form').classList.add('show');
    };
});

// =============== 登录请求 ===============
document.getElementById('doLogin').onclick = async () => {
    // 1. 获取输入框内容
    const username = document.getElementById('login_username').value.trim();
    const pwd = document.getElementById('login_pwd').value.trim();

    // 2. 判空（空则中止）
    if (!username) {
        alert(t('alert_need_username'));
        return;
    }
    if (!pwd) {
        alert(t('alert_need_pwd'));
        return;
    }

    try {
        // 3. 发送请求
        const res = await fetch(`${config.API_BASE_URL}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password: pwd})
        });

        const data = await res.json();

        // 4. 成功/失败判断
        if (data.code === 200) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username);
            if (data.user_id) localStorage.setItem('user_id', data.user_id);
            document.getElementById("userName").textContent = username;

            modal.style.display = 'none';
            openBtn.textContent = t('logged_in');
            window.location.reload();
            // 登录成功时初始化头像状态
            initUserProfile();
            // 登录成功时初始化历史会话记录
            await initHistory();
        } else {
            alert(t('alert_login_fail') + (data.msg || t('unknown_error')));
        }
    } catch (err) {
        console.error(err);
        alert(t('alert_login_neterr'));
    }
};

// =============== 注册请求 ===============
document.getElementById('doRegister').onclick = async () => {
    // 1. 获取输入框内容
    const username = document.getElementById('reg_username').value.trim();
    const pwd = document.getElementById('reg_pwd').value.trim();
    const repwd = document.getElementById('reg_repwd').value.trim();

    // 2. 判空（空则中止）
    if (!username) {
        alert(t('alert_need_username'));
        return;
    }
    if (!pwd) {
        alert(t('alert_need_pwd'));
        return;
    }
    if (!repwd) {
        alert(t('alert_need_repwd'));
        return;
    }

    // 3. 两次密码不一致（中止）
    if (pwd !== repwd) {
        alert(t('alert_pwd_mismatch'));
        return;
    }

    try {
        // 4. 发送注册请求
        const res = await fetch(`${config.API_BASE_URL}/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password: pwd})
        });

        const data = await res.json();

        // 5. 成功/失败判断
        if (data.code === 200) {
            alert(t('alert_reg_success'));
            tabs[0].click();
        } else {
            alert(t('alert_reg_fail') + (data.msg || t('unknown_error')));
        }
    } catch (err) {
        console.error(err);
        alert(t('alert_reg_neterr'));
    }
};


// =============== 初始化历史会话记录 ===============
async function initHistory() {
    const token = window.localStorage.getItem('token');
    const res = await fetch(
        `${config.API_BASE_URL}/ai/chat/history?is_Load_All=true`,
        {
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json",
            }
        }
    );
    if (res.status === 200) {
        const result = await res.json();
        const sideBar = document.getElementById('sideBar');

        result['chat_sessions'].forEach(e => {
            div = document.createElement("div");
            div.textContent = e['session_name'];
            div.title = e['session_time'];
            div.className = `history title`;
            sideBar.appendChild(div);
            div.addEventListener('click', async function () {
                if (typeof exitJobHuntMode === 'function') exitJobHuntMode();
                document.getElementById("chatBox").querySelectorAll(".message").forEach(el => el.remove());
                const histories = document.querySelectorAll('.history');
                const chatSession = document.getElementById('chatSession');
                chatSession.textContent = e['session_name'];
                histories.forEach(h => {
                    h.classList.remove('active')
                });
                this.classList.add('active');
                this.title = e['session_time'];
                window.localStorage.setItem('thisSessionTime', this.title);
                const stored = localStorage.getItem(String(this.title));
                chatData = stored ? JSON.parse(stored) : e['messages'];
                const box = document.getElementById("chatBox");

                chatData.forEach(msg => {

                    const sender = msg.role === "user" ? "user" : "ai";
                    const div = document.createElement("div");
                    div.className = `message ${sender}`;
                    // div.textContent = msg.message;
                    div.innerHTML = typeof renderMarkdown === 'function'
                        ? renderMarkdown(msg.message)
                        : marked.parse(msg.message);
                    box.appendChild(div);
                });
                document.getElementById('emptyState')?.classList.add('hidden');

            });
            window.localStorage.setItem(e['session_time'], JSON.stringify(e['messages']))
        });

    } else if (res.status === 401) {
        // 清除本地存储的登录信息
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("user_id");
        // 关闭菜单
        profileDropdown.classList.remove("show");
        // 刷新页面，更新头像状态（也可以改成跳转到登录页）
        window.location.reload();
    }

}

// =============== 初始化用户头像状态 ===============
function initUserProfile() {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const avatarImg = document.getElementById("avatarImg");
    const userName = document.getElementById("userName");

    if (token && username) {
        // 已登录状态：显示用户名和头像
        userName.textContent = username;
        // 后期微信登录时，这里可以改成微信返回的头像地址：
        // const avatarUrl = localStorage.getItem("avatarUrl");
        // avatarImg.src = avatarUrl || "/static/default-avatar.png";
        avatarImg.src = "../static/a.png"; // 暂时先用默认头像
    } else {
        // 未登录状态：显示默认头像和“未登录”
        userName.textContent = t('not_logged_in');
        avatarImg.src = "/static/a.png";
    }
}

// --------------- 头像菜单控制逻辑 ---------------
const profileMenuBtn = document.getElementById("profileMenuBtn");
const profileDropdown = document.getElementById("profileDropdown");
const logoutBtn = document.getElementById("logoutBtn");

// 点击按钮：切换菜单显示/隐藏
profileMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止冒泡，不然会触发下面的document点击事件
    profileDropdown.classList.toggle("show");
});

// 点击页面其他地方：关闭菜单
document.addEventListener("click", () => {
    profileDropdown.classList.remove("show");
});

// --------------- 退出登录逻辑 ---------------
logoutBtn.addEventListener("click", () => {
    // 清除本地存储的登录信息
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    // 关闭菜单
    profileDropdown.classList.remove("show");
    // 刷新页面，更新头像状态（也可以改成跳转到登录页）
    window.location.reload();
});

