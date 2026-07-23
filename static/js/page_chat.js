/* global marked */
const API_AI_CHAT = `${config.API_BASE_URL}/ai/chat`;
const API_AI_CHAT_savaToDb = `${config.API_BASE_URL}/ai/chat/savaToDb`;
const API_AI_CHAT_history = `${config.API_BASE_URL}/ai/chat/history`;
const API_AI_CHAT_STREAM = `${config.API_BASE_URL}/ai/chatStream`; // 流式接口

function buildAuthHeaders() {
    const headers = {"Content-Type": "application/json"};
    const token = localStorage.getItem("token");
    if (token && token !== "null") {
        headers["Authorization"] = "Bearer " + token;
    }
    return headers;
}

function parseApiErrorMessage(data, fallback) {
    if (!data) return fallback;
    if (typeof data.detail === "string") return data.detail;
    if (data.detail?.msg) return data.detail.msg;
    if (data.msg) return data.msg;
    return fallback;
}

function renderMarkdown(text) {
    marked.setOptions({ breaks: true, gfm: true });
    const html = marked.parse(text);
    return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

window.renderMarkdown = renderMarkdown;

// 点击按钮发送
// 全局锁：防止重复发送
let isSending = false;
let chatData = [];
let div;
// 流式控制：用于中止请求
let abortController = null;

// ==================== 免费体验次数（未登录用户）====================
const API_AI_QUOTA = `${config.API_BASE_URL}/ai/quota`;
// null 表示已登录/未知（不限流）；数字表示今日剩余次数
let anonRemaining = null;

function isLoggedIn() {
    const token = localStorage.getItem("token");
    return !!(token && token !== "null");
}

// 刷新底部「今日还剩 N 次」提示
function renderQuotaTip() {
    const tip = document.getElementById("quotaTip");
    if (!tip) return;
    if (isLoggedIn() || anonRemaining === null) {
        tip.hidden = true;
        return;
    }
    tip.hidden = false;
    if (anonRemaining <= 0) {
        tip.textContent = t('rate_limit_msg');
        tip.classList.add('quota-tip-warn');
    } else {
        tip.textContent = t('quota_remaining_1') + anonRemaining + t('quota_remaining_2');
        tip.classList.toggle('quota-tip-warn', anonRemaining <= 3);
    }
}

// 弹出「注册成为会员 + 在线客服」引导弹窗
function showRegisterPrompt() {
    if (typeof showLoginExpiredModal === 'function') {
        showLoginExpiredModal(t('rate_limit_modal'), 'error', {
            goRegister: true,
            showService: true,
            subtitle: t('rate_limit_sub'),
        });
    }
}

// 页面加载时拉取一次剩余次数（仅未登录用户展示）
async function initQuota() {
    if (isLoggedIn()) {
        anonRemaining = null;
        renderQuotaTip();
        return;
    }
    try {
        const res = await fetch(API_AI_QUOTA, {headers: buildAuthHeaders()});
        if (res.ok) {
            const data = await res.json();
            anonRemaining = data.logged_in ? null : data.remaining;
        }
    } catch (e) {
        console.warn("获取免费次数失败", e);
    }
    renderQuotaTip();
}

document.addEventListener('DOMContentLoaded', initQuota);
document.addEventListener('langchange', renderQuotaTip);


async function sendMessage() {
    const input = document.getElementById("userInput");
    const content = input.value.trim();
    const chatSession = document.getElementById('chatSession');
    const sideBar = document.getElementById('sideBar');
    const sendMessage_ele = document.getElementById("sendMessage");
    // ==============================================
    // 🔥 核心修复1：先判断【停止】，再判断【发送】
    // ==============================================
    if (isSending && abortController) {
        console.log("🛑 手动停止AI输出");
        abortController.abort();
        isSending = false;
        sendMessage_ele.textContent = "➤";
        return;
    }


    // 🔥 锁已经打开 → 直接拒绝！绝对不会执行第二次
    if (isSending) {
        return;
    }

    const hasAttachments = typeof hasPendingAttachments === 'function' && hasPendingAttachments();
    if (!content && !hasAttachments) {
        return;
    }

    // 未登录且今日免费次数已用完：禁止发送，弹注册/客服引导
    if (!isLoggedIn() && anonRemaining !== null && anonRemaining <= 0) {
        showRegisterPrompt();
        return;
    }

    let displayMessage = content;
    let imagePaths = [];
    let documentPaths = [];

    if (hasAttachments) {
        try {
            const uploaded = await uploadPendingAttachments();
            imagePaths = uploaded.imagePaths;
            documentPaths = uploaded.documentPaths;
            displayMessage = buildDisplayMessage(content, uploaded.imageUrls, uploaded.documentNames);
            clearPendingAttachments();
        } catch (uploadErr) {
            if (uploadErr.message === 'RATE_LIMIT') {
                addMessage(t('rate_limit_msg'), "ai");
                anonRemaining = 0;
                renderQuotaTip();
                showRegisterPrompt();
            } else {
                addMessage(uploadErr.message || t('upload_fail'), "ai");
            }
            return;
        }
    }

    // 显示用户消息
    addMessage(displayMessage, "user");

    input.value = "";
    input.dispatchEvent(new Event('input'));
    isSending = true;
    sendMessage_ele.textContent = "⏹️";
    // 创建AI消息占位框（流式实时更新）
    const box = document.getElementById("chatBox");


    const currentAiMessageDiv = document.createElement("div");
    currentAiMessageDiv.className = "message ai";
    box.appendChild(currentAiMessageDiv);
    let aiFullReply = "";


    try {
        abortController = new AbortController();
        const isOnline = document.getElementById('searchBtn').classList.contains('active');
        const signal = abortController.signal;
        // 🔥 核心：调用流式接口
        const response = await fetch(API_AI_CHAT_STREAM + "?temperature=0.7", {
            method: "POST",
            headers: buildAuthHeaders(),
            body: JSON.stringify({
                history: chatData,
                newMessage: displayMessage,
                open_online: isOnline,
                enabled_skills: typeof getEnabledSkills === 'function' ? getEnabledSkills() : [],
                image_paths: imagePaths,
                document_paths: documentPaths,
                lang: typeof getLang === 'function' ? getLang() : 'zh'
            }),
            signal: signal
        });

        if (response.status === 429) {
            currentAiMessageDiv.remove();
            const errData = await response.json();
            addMessage(parseApiErrorMessage(errData, t('rate_limit_msg')), "ai");
            anonRemaining = 0;
            renderQuotaTip();
            showRegisterPrompt();
            return;
        }
        if (!response.ok) {
            currentAiMessageDiv.remove();
            addMessage(t('ai_error_key'), "ai");
            return;
        }

        // 未登录用户：从响应头同步今日剩余次数
        if (!isLoggedIn()) {
            const remainHeader = response.headers.get("X-Anon-Remaining");
            if (remainHeader !== null) {
                anonRemaining = parseInt(remainHeader, 10);
                renderQuotaTip();
            }
        }

        const decoder = new TextDecoder("utf-8");
        const reader = response.body.getReader();
        let buffer = "";

        signal.addEventListener("abort", () => {
            reader.cancel();
        });

        while (true) {


            const {done, value} = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, {stream: true});
            const lines = buffer.split("\n");
            // 专门解决网络传输中数据分包 / 不完整行的问题，没有它会导致消息解析错乱、内容丢失或格式错误。
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimLine = line.trim();
                if (!trimLine.startsWith("data: ")) continue;
                const data = trimLine.replace("data: ", "").trim();

                // 结束
                if (data === "[DONE]") continue;
                // 接收完整历史
                if (data.startsWith("[HISTORY]")) {
                    const historyJson = data.replace("[HISTORY] ", "");
                    chatData = JSON.parse(historyJson);
                    continue;
                }
                // 流式输出文字
                aiFullReply += data;
                currentAiMessageDiv.innerHTML = renderMarkdown(aiFullReply);
                box.scrollTop = box.scrollHeight;
            }
        }

        if (chatSession.textContent.trim() === t('new_session')) {

            div = document.createElement("div");
            div.title = String(new Date().getTime());
            window.localStorage.setItem('thisSessionTime', div.title);
            // 改为ai分析第一句话的标题，指定提示词
            let aiGenerateContent = await generateTitleFromTwoRounds(chatData || []);

            chatSession.textContent = aiGenerateContent;
            div.className = `history title active`;
            div.textContent = aiGenerateContent;
            // 对历史会话操作：拉取数据库对话数据到对话框 && 清除class active 并激活点击历史对话
            div.addEventListener('click', async function () {
                if (typeof exitJobHuntMode === 'function') exitJobHuntMode();
                // 清空当前右边聊天记录,清空chatSession,调取数据库存入全部聊天记录，chatDate取全部聊天记录
                document.getElementById("chatBox").querySelectorAll(".message").forEach(el => el.remove());
                const histories = document.querySelectorAll('.history');
                histories.forEach(h => {
                    h.classList.remove('active')
                });
                this.classList.add('active');
                const session_time = this.title;
                window.localStorage.setItem('thisSessionTime', this.title);
                const messageList = JSON.parse(window.localStorage.getItem(session_time) || '[]');
                chatData = messageList;
                chatSession.textContent = this.textContent;

                renderHistoryChat(chatData);
                document.getElementById('emptyState')?.classList.toggle('hidden', chatData.length > 0);
            });
            if (chatSession.textContent.trim() !== t('new_session')) {
                const firstHistoryItem = sideBar.querySelector('.history.title');
                if (firstHistoryItem) {
                    sideBar.insertBefore(div, firstHistoryItem);
                } else {
                    sideBar.appendChild(div);
                }
            }
        }

        // try {
        //     // 调用AI接口
        //     // params = {
        //     //     "message": content,
        //     // };
        //     // const queryString = new URLSearchParams(params).toString();
        //
        //     // 判断是否联网
        //     const isOnline = document.getElementById('searchBtn').classList.contains('active');
        //     const response = await fetch(`${API_AI_CHAT}`, {
        //         method: "POST",
        //         headers: {
        //             "Content-Type": "application/json"
        //         },
        //
        //         body: JSON.stringify({
        //             "history": chatData,
        //             "newMessage": content,
        //             "open_online": isOnline
        //
        //         })
        //     });
        //
        //     const data = await response.json();
        //     const aiReply = data.content;
        //     chatData = data['new_history'];
        //     addMessage(aiReply, "ai");
        //
        //
        //     if (chatSession.textContent.trim() === "新对话") {
        //
        //         div = document.createElement("div");
        //         div.title = String(new Date().getTime());
        //         window.localStorage.setItem('thisSessionTime', div.title);
        //         // 改为ai分析第一句话的标题，指定提示词
        //         let aiGenerateContent = await generateTitleFromTwoRounds(chatData || []);
        //
        //         chatSession.textContent = aiGenerateContent;
        //         div.className = `history title active`;
        //         div.textContent = aiGenerateContent;
        //         // 对历史会话操作：拉取数据库对话数据到对话框 && 清除class active 并激活点击历史对话
        //         div.addEventListener('click', async function () {
        //             // 清空当前右边聊天记录,清空chatSession,调取数据库存入全部聊天记录，chatDate取全部聊天记录
        //             document.getElementById("chatBox").querySelectorAll(".message").forEach(el => el.remove());
        //             const histories = document.querySelectorAll('.history');
        //             histories.forEach(h => {
        //                 h.classList.remove('active')
        //             });
        //             this.classList.add('active');
        //             const session_time = this.title;
        //             window.localStorage.setItem('thisSessionTime', this.title);
        //             const messageList = JSON.parse(window.localStorage.getItem(session_time) || []);
        //             chatData = messageList;
        //             chatSession.textContent = this.textContent;
        //
        //             renderHistoryChat(chatData);
        //         });
        //         if (chatSession.textContent.trim() !== "新对话") {
        //             sideBar.insertBefore(div, sideBar.children[1]);
        //         }
        //     }

    } catch (err) {
        // ==============================================
        // 🔥 修复：用户主动停止，不报错
        // ==============================================
        if (err.name === "AbortError") {
            console.log("✅ 手动停止输出");
            return;
        }
        addMessage(t('ai_error_key'), "ai");
        console.error(err);

    } finally {
        if (chatData.at(-1)?.role === "ai" && currentAiMessageDiv.isConnected) {
            currentAiMessageDiv.innerHTML = renderMarkdown(chatData.at(-1).message);
        } else if (currentAiMessageDiv.isConnected && !currentAiMessageDiv.textContent.trim()) {
            currentAiMessageDiv.remove();
        }
        isSending = false;
        sendMessage_ele.disabled = false;
        sendMessage_ele.textContent = "➤";
        if (chatSession.textContent.trim() !== t('new_session')) {
            window.localStorage.setItem(window.localStorage.getItem('thisSessionTime'), JSON.stringify(chatData));
            await postToDb(chatData, window.localStorage.getItem('thisSessionTime'), chatSession.textContent);
        }
    }
}

// 根据前两轮对话生成 8～12 字标题
async function generateTitleFromTwoRounds(dialogue) {
    // 未登录用户不保存历史，且标题生成会额外消耗免费次数，这里直接跳过
    if (!isLoggedIn()) {
        return t('new_session');
    }

    // AI 生成标题
    const res = await fetch(`${API_AI_CHAT}?temperature=1.5`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
            "history": dialogue,
            "newMessage": `
                    请根据以上2轮对话，生成一个8-12字的对话标题。
                    要求：简洁概括、无标点、不换行。
                    只返回标题，不要任何多余内容。
                    `.trim()
        })
    });
    if (res.status === 429) {
        return t('new_session');
    }
    if (res.status === 200) {
        let resJson = await res.json();
        return resJson.content;
    } else {
        return t('new_session')
    }

}


// 渲染历史记录（切换会话时用）
function renderHistoryChat(messages) {
    const box = document.getElementById("chatBox");

    messages.forEach(msg => {

        const sender = msg.role === "user" ? "user" : "ai";
        const div = document.createElement("div");
        div.className = `message ${sender}`;
        // div.textContent = msg.message;
        div.innerHTML = renderMarkdown(msg.message);
        box.appendChild(div);
    });

    // box.scrollTop = box.scrollHeight;
}


// 发送聊天数据到数据库
async function postToDb(chatData, createTime, sessionName) {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(API_AI_CHAT_savaToDb, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                chat_data: chatData,
                create_time: createTime,
                session_name: sessionName,
            }),
        });
        if (res.status === 401) {
            window.localStorage.setItem('token', null);
            document.getElementById('openLoginBtn').textContent = '未登录';
            showLoginExpiredModal('🔐 登录已过期，请重新登录！', 'error');
            return null;
        }
        const result = await res.json();

        console.log("✅ 保存数据成功：", result);
        return result;
    } catch (err) {
        console.error("❌ 保存数据请求失败：", err);
        return null;
    }
}


// 添加消息到界面
function addMessage(text, sender) {
    const box = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    // div.textContent = text;
    div.innerHTML = renderMarkdown(text);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight; // 自动滚动到底部
}

// 回车发送
document.getElementById("userInput").addEventListener("keypress", e => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

// 折叠和添加会话按钮
function foldHistorySession() {
    const appShell = document.querySelector('.app-shell');
    const backdrop = document.getElementById('sidebarBackdrop');
    // 移动端（<=768px）：侧边栏为覆盖式抽屉，切换抽屉开合 + 遮罩
    if (window.matchMedia('(max-width: 768px)').matches) {
        const open = appShell.classList.toggle('sidebar-open');
        if (backdrop) backdrop.classList.toggle('show', open);
        return;
    }
    // 桌面端：原有折叠逻辑
    const sideBar = document.getElementById('sideBar');
    const userprofile = document.getElementById('userProfile');
    sideBar.classList.toggle('hidden');
    userprofile.classList.toggle('hidden');
}

// 移动端：点击遮罩关闭侧边栏抽屉
document.addEventListener('DOMContentLoaded', () => {
    const backdrop = document.getElementById('sidebarBackdrop');
    const appShell = document.querySelector('.app-shell');
    function closeMobileDrawer() {
        appShell?.classList.remove('sidebar-open');
        backdrop?.classList.remove('show');
    }
    if (backdrop && appShell) {
        backdrop.addEventListener('click', closeMobileDrawer);
    }
    // 移动端点击历史会话/找工作入口后自动收起抽屉
    const sideBar = document.getElementById('sideBar');
    if (sideBar) {
        sideBar.addEventListener('click', (e) => {
            if (!window.matchMedia('(max-width: 768px)').matches) return;
            if (e.target.closest('.history.title') || e.target.closest('#jobHuntEntry')) {
                closeMobileDrawer();
            }
        });
    }
});

function createNewSession() {
    if (typeof exitJobHuntMode === 'function') exitJobHuntMode();
    const chatSession = document.getElementById('chatSession');
    // 清除所有 class="message" 的子元素 并清空缓存
    document.querySelectorAll("#chatBox .message").forEach(el => el.remove());
    chatData = [];
    div = null;
    chatSession.textContent = t('new_session');
    document.getElementById('emptyState')?.classList.remove('hidden');
    const histories = document.querySelectorAll('.history');
    histories.forEach(h => {
        h.classList.remove('active')
    });
    if (typeof clearPendingAttachments === 'function') {
        clearPendingAttachments();
    }

}

