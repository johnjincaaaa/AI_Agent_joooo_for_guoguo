// ==============================
// 国际化（中英切换）
//  - LANG.zh / LANG.en 为翻译字典
//  - t(key) 取当前语言文案
//  - setLang(lang) 切换语言并广播 'langchange' 事件
//  - applyStaticI18n() 刷新所有带 data-i18n / data-i18n-ph 属性的静态元素
// ==============================

const LANG = {
    zh: {
        // 顶部 / 通用
        brand_name: '有料ai',
        login: '登录',
        logged_in: '已登录',
        not_logged_in: '未登录',
        guide_btn: '接入教程',
        lang_toggle_title: '切换中/英文',

        // 主题切换
        theme_toggle_title: '切换亮/暗主题',
        theme_to_light: '切换到亮色主题',
        theme_to_dark: '切换到暗色主题',

        // 右侧悬浮图标
        float_share: '分享APP',
        float_service: '在线客服',
        float_app: '下载App',

        // 分享弹窗
        share_modal_title: '分享APP 赚美金',
        share_link_label: '你的专属推广链接',
        share_copy_btn: '一键复制',
        share_copied: '已复制',
        share_need_login: '登录后才能获取专属推广链接',
        share_need_login_sub: '登录即可分享赚美金',

        // 侧边栏
        sidebar_jobhunt_section: '找工作',
        jobhunt_entry: '简历制作 · 岗位推荐',
        sidebar_wallet_section: '我的收益',
        wallet_entry: '推广钱包 · 提现',
        history_label: '历史会话',
        new_session: '新对话',
        logout: '退出登录',

        // 顶部工具条按钮
        fold_title: '折叠/展开侧边栏',
        new_chat_title: '新建对话',

        // 空状态
        empty_title: '我是有料ai，有什么可以帮你？',
        empty_desc: '输入你的问题，开启一段新的对话',

        // 输入区
        input_placeholder: '输入问题，可粘贴图片/文档或点击附件上传...',
        attach_btn: '附件',
        attach_title: '上传图片或文档',
        skills_btn: '技能',
        skills_tip: '选择 AI 技能工具链',
        skills_dropdown_title: '选择技能',
        skills_empty: '暂无可用技能',
        online_btn: '智能联网',
        online_tip: '按需搜索网页',
        net_off: '未联网',
        net_on: '已联网',
        net_status_title: '智能体是否基于网络回答',
        input_tip: '内容由 AI 生成，请注意甄别',
        send_title: '发送',

        // 登录/注册弹窗
        modal_welcome: '欢迎使用 有料ai',
        modal_subtitle: '登录后即可保存你的对话历史',
        tab_login: '登录',
        tab_register: '注册',
        label_username: '用户名',
        label_password: '密码',
        label_repassword: '确认密码',
        ph_login_username: '请输入用户名',
        ph_login_pwd: '请输入密码',
        ph_reg_username: '请设置用户名',
        ph_reg_pwd: '请设置密码',
        ph_reg_repwd: '请再次输入密码',
        btn_do_login: '立即登录',
        btn_do_register: '立即注册',
        show_pwd: '显示密码',
        hide_pwd: '隐藏密码',

        // 登录/注册 提示（alert / modal）
        alert_need_username: '请输入用户名！',
        alert_need_pwd: '请输入密码！',
        alert_need_repwd: '请确认密码！',
        alert_pwd_mismatch: '两次输入的密码不一致！',
        alert_login_fail: '登录失败：',
        alert_login_neterr: '网络异常，登录请求失败！',
        alert_reg_success: '注册成功！请登录',
        alert_reg_fail: '注册失败：',
        alert_reg_neterr: '网络异常，注册请求失败！',
        unknown_error: '未知错误',
        please_login: '未登录,请登录！',
        login_expired: '🔐 登录已过期，请重新登录！',

        // 聊天错误 / 限流
        ai_error_key: 'AI出错了，请检查API Key',
        rate_limit_msg: '未登录用户今日免费体验次数已用完，请注册或登录后继续使用',
        rate_limit_modal: '🎁 今日免费体验已用完',
        rate_limit_sub: '注册成为会员，畅享无限次对话；也可联系在线客服咨询。',
        upload_fail: '文件上传失败，请重试',
        modal_default_sub: '请重新登录后继续使用',
        modal_go_register: '立即注册',
        quota_remaining_1: '今日免费体验还剩 ',
        quota_remaining_2: ' 次',
        quota_low_tip: '免费次数快用完啦，注册成为会员可无限畅聊',

        // 推广钱包 / 提现
        wallet_title: '推广钱包',
        wallet_desc: '分享专属链接邀请好友下载APP，即可赚取美金奖励并提现到 PayPal。',
        wallet_balance: '当前美金余额',
        wallet_referrals: '累计有效推广',
        wallet_people: ' 人',
        wallet_withdraw_title: '申请提现',
        wallet_withdraw_hint: '提交后将提现全部余额，后台人工审核后打款到你的 PayPal。',
        wallet_paypal_ph: '请输入你的 PayPal 邮箱',
        wallet_withdraw_btn: '提交提现申请',
        wallet_records_title: '提现记录',
        wallet_no_records: '暂无提现记录',
        wallet_status_pending: '待审核',
        wallet_status_paid: '已到账',
        wallet_status_rejected: '已驳回',
        wallet_invalid_email: '请输入有效的 PayPal 邮箱',
        wallet_withdraw_ok: '提现申请已提交，等待人工审核',
        wallet_withdraw_fail: '提现失败，请稍后重试',
        wallet_need_login: '登录后才能查看推广钱包',
        wallet_need_login_sub: '登录即可查看余额并提现',

        // 技能名（前端兜底）
        skill_image_name: '图片解析',
        skill_image_desc: '分析图片内容、尺寸、格式等属性',
        skill_doc_name: '文档解析',
        skill_doc_desc: '读取 PDF、Word、TXT 文件内容',

        // 找工作面板
        job_panel_title: '找工作',
        job_panel_desc: '完善个人画像 → 选择简历模板 → AI 生成简历 → 匹配 BOSS 直聘对口岗位（当前为虚拟数据）',
        job_step_1: '① 个人画像',
        job_step_2: '② 简历模板',
        job_step_3: '③ AI 简历',
        job_step_4: '④ 岗位推荐',
        job_section_1: '个人画像',
        job_section_2: '挑选简历模板',
        job_section_3: 'AI 完善简历',
        job_section_4: '对口岗位推荐',
        job_save_profile: '保存画像',
        job_resume_empty: '点击「AI 完善简历」生成专业简历',
        job_generate_btn: 'AI 完善简历',
        job_match_default: '完成画像与简历后，点击匹配推荐岗位',
        job_match_btn: '匹配推荐岗位',

        // 找工作表单字段 label
        f_name: '姓名',
        f_gender: '性别',
        f_age: '年龄',
        f_education: '学历',
        f_major: '专业',
        f_school: '毕业院校',
        f_experience_years: '工作年限',
        f_target_city: '期望城市',
        f_target_role: '期望岗位',
        f_skills: '技能标签',
        f_work_experience: '工作经历',
        f_project_experience: '项目经历',
        f_self_intro: '自我评价',
        f_preset_resume: '预设简历草稿（AI 将在此基础上完善）',

        // 找工作表单 placeholder
        ph_name: '张三',
        ph_age: '24',
        ph_major: '计算机科学与技术',
        ph_school: 'XX大学',
        ph_target_city: '北京',
        ph_target_role: 'Java开发工程师',
        ph_skills: 'Java,Spring Boot,MySQL',
        ph_work_experience: '公司、岗位、时间、主要工作内容…',
        ph_project_experience: '项目名称、职责、技术栈、成果…',
        ph_self_intro: '简要介绍优势与求职动机…',
        ph_preset_resume: '可粘贴现有简历内容，AI 会自动润色补全…',

        // 找工作下拉选项
        opt_select: '请选择',
        opt_male: '男',
        opt_female: '女',
        opt_edu_college: '大专',
        opt_edu_bachelor: '本科',
        opt_edu_master: '硕士',
        opt_edu_phd: '博士',
        opt_exp_fresh: '在校/应届',
        opt_exp_1_3: '1-3年',
        opt_exp_3_5: '3-5年',
        opt_exp_5_10: '5-10年',

        // 找工作状态提示
        js_template_fail: '模板加载失败',
        js_save_local: '已保存到本地',
        js_save_local_hint: '已保存到本地（登录后可同步云端）',
        js_save_expired: '登录已过期，仅保存到本地',
        js_save_cloud: '已同步到云端',
        js_save_cloud_fail: '云端同步失败，已保存到本地',
        js_need_resume_fields: '请至少填写姓名、期望岗位或预设简历草稿',
        js_generating: 'AI 正在完善简历，请稍候…',
        js_gen_rate_limit: '免费次数已用完，请登录后继续使用',
        js_resume_done: '简历已生成',
        js_resume_fail: '简历生成失败，请稍后重试',
        js_no_jobs: '暂无匹配岗位，请完善画像后重试',
        js_need_match_fields: '请填写期望岗位或技能标签',
        js_matching: '正在匹配 BOSS 直聘岗位（虚拟数据）…',
        js_match_rate_limit: '免费次数已用完，请登录后继续使用',
        js_match_fail: '岗位匹配失败，请稍后重试',
        js_match_done_1: '已推荐 ',
        js_match_done_2: ' 个对口岗位',
        job_match_score: '匹配度 ',
        job_source_default: 'BOSS直聘',
    },
    en: {
        brand_name: 'YouLiao AI',
        login: 'Sign in',
        logged_in: 'Signed in',
        not_logged_in: 'Sign in',
        guide_btn: 'API Guide',
        lang_toggle_title: 'Switch Chinese / English',

        theme_toggle_title: 'Toggle light/dark theme',
        theme_to_light: 'Switch to light theme',
        theme_to_dark: 'Switch to dark theme',

        float_share: 'Share',
        float_service: 'Support',
        float_app: 'Get App',

        share_modal_title: 'Share the App, Earn USD',
        share_link_label: 'Your personal referral link',
        share_copy_btn: 'Copy link',
        share_copied: 'Copied',
        share_need_login: 'Sign in to get your referral link',
        share_need_login_sub: 'Sign in to share and earn USD',

        sidebar_jobhunt_section: 'Job Hunt',
        jobhunt_entry: 'Resume Builder · Job Match',
        sidebar_wallet_section: 'My Earnings',
        wallet_entry: 'Wallet · Withdraw',
        history_label: 'History',
        new_session: 'New Chat',
        logout: 'Log out',

        fold_title: 'Collapse / expand sidebar',
        new_chat_title: 'New chat',

        empty_title: "I'm YouLiao AI. How can I help?",
        empty_desc: 'Type your question to start a new conversation',

        input_placeholder: 'Type a message, paste an image/document, or click to attach…',
        attach_btn: 'Attach',
        attach_title: 'Upload image or document',
        skills_btn: 'Skills',
        skills_tip: 'Choose AI skill tools',
        skills_dropdown_title: 'Choose skills',
        skills_empty: 'No skills available',
        online_btn: 'Web Search',
        online_tip: 'Search the web on demand',
        net_off: 'Offline',
        net_on: 'Online',
        net_status_title: 'Whether the agent answers from the web',
        input_tip: 'Content is AI-generated. Please verify.',
        send_title: 'Send',

        modal_welcome: 'Welcome to YouLiao AI',
        modal_subtitle: 'Sign in to save your conversation history',
        tab_login: 'Sign in',
        tab_register: 'Register',
        label_username: 'Username',
        label_password: 'Password',
        label_repassword: 'Confirm password',
        ph_login_username: 'Enter your username',
        ph_login_pwd: 'Enter your password',
        ph_reg_username: 'Choose a username',
        ph_reg_pwd: 'Choose a password',
        ph_reg_repwd: 'Enter the password again',
        btn_do_login: 'Sign in',
        btn_do_register: 'Register',
        show_pwd: 'Show password',
        hide_pwd: 'Hide password',

        alert_need_username: 'Please enter a username!',
        alert_need_pwd: 'Please enter a password!',
        alert_need_repwd: 'Please confirm your password!',
        alert_pwd_mismatch: 'The two passwords do not match!',
        alert_login_fail: 'Sign-in failed: ',
        alert_login_neterr: 'Network error, sign-in request failed!',
        alert_reg_success: 'Registration successful! Please sign in.',
        alert_reg_fail: 'Registration failed: ',
        alert_reg_neterr: 'Network error, registration request failed!',
        unknown_error: 'Unknown error',
        please_login: 'Not signed in. Please sign in!',
        login_expired: '🔐 Session expired. Please sign in again!',

        ai_error_key: 'AI request failed. Please check your API Key.',
        rate_limit_msg: "Today's free trial limit reached. Please register or sign in to continue.",
        rate_limit_modal: '🎁 Free trial used up for today',
        rate_limit_sub: 'Register to chat without limits, or contact online support.',
        upload_fail: 'File upload failed, please try again',
        modal_default_sub: 'Please sign in again to continue',
        modal_go_register: 'Register now',
        quota_remaining_1: 'Free trials left today: ',
        quota_remaining_2: '',
        quota_low_tip: 'Almost out of free trials. Register to chat without limits.',

        wallet_title: 'Referral Wallet',
        wallet_desc: 'Share your link, invite friends to download the App, earn USD and withdraw to PayPal.',
        wallet_balance: 'USD Balance',
        wallet_referrals: 'Valid Referrals',
        wallet_people: '',
        wallet_withdraw_title: 'Request Withdrawal',
        wallet_withdraw_hint: 'Submitting withdraws your full balance; paid to your PayPal after manual review.',
        wallet_paypal_ph: 'Enter your PayPal email',
        wallet_withdraw_btn: 'Submit Withdrawal',
        wallet_records_title: 'Withdrawal Records',
        wallet_no_records: 'No withdrawal records yet',
        wallet_status_pending: 'Pending',
        wallet_status_paid: 'Paid',
        wallet_status_rejected: 'Rejected',
        wallet_invalid_email: 'Please enter a valid PayPal email',
        wallet_withdraw_ok: 'Withdrawal request submitted, awaiting review',
        wallet_withdraw_fail: 'Withdrawal failed, please try again later',
        wallet_need_login: 'Sign in to view your wallet',
        wallet_need_login_sub: 'Sign in to see your balance and withdraw',

        skill_image_name: 'Image Analysis',
        skill_image_desc: 'Analyze image content, size, format and more',
        skill_doc_name: 'Document Analysis',
        skill_doc_desc: 'Read content from PDF, Word and TXT files',

        job_panel_title: 'Job Hunt',
        job_panel_desc: 'Complete your profile → pick a resume template → generate resume with AI → match relevant jobs (demo data)',
        job_step_1: '① Profile',
        job_step_2: '② Template',
        job_step_3: '③ AI Resume',
        job_step_4: '④ Job Match',
        job_section_1: 'Personal Profile',
        job_section_2: 'Pick a Resume Template',
        job_section_3: 'Polish Resume with AI',
        job_section_4: 'Recommended Jobs',
        job_save_profile: 'Save Profile',
        job_resume_empty: 'Click "Polish Resume with AI" to generate a professional resume',
        job_generate_btn: 'Polish Resume with AI',
        job_match_default: 'After finishing the profile and resume, click to match jobs',
        job_match_btn: 'Match Jobs',

        f_name: 'Name',
        f_gender: 'Gender',
        f_age: 'Age',
        f_education: 'Education',
        f_major: 'Major',
        f_school: 'School',
        f_experience_years: 'Experience',
        f_target_city: 'Target City',
        f_target_role: 'Target Role',
        f_skills: 'Skills',
        f_work_experience: 'Work Experience',
        f_project_experience: 'Project Experience',
        f_self_intro: 'Self Introduction',
        f_preset_resume: 'Resume Draft (AI will build on this)',

        ph_name: 'John Doe',
        ph_age: '24',
        ph_major: 'Computer Science',
        ph_school: 'XX University',
        ph_target_city: 'New York',
        ph_target_role: 'Java Developer',
        ph_skills: 'Java, Spring Boot, MySQL',
        ph_work_experience: 'Company, role, dates, main responsibilities…',
        ph_project_experience: 'Project name, role, tech stack, results…',
        ph_self_intro: 'Briefly describe your strengths and motivation…',
        ph_preset_resume: 'Paste your existing resume; AI will polish and complete it…',

        opt_select: 'Please select',
        opt_male: 'Male',
        opt_female: 'Female',
        opt_edu_college: 'College',
        opt_edu_bachelor: "Bachelor's",
        opt_edu_master: "Master's",
        opt_edu_phd: 'PhD',
        opt_exp_fresh: 'Student / New Grad',
        opt_exp_1_3: '1-3 yrs',
        opt_exp_3_5: '3-5 yrs',
        opt_exp_5_10: '5-10 yrs',

        js_template_fail: 'Failed to load templates',
        js_save_local: 'Saved locally',
        js_save_local_hint: 'Saved locally (sign in to sync to cloud)',
        js_save_expired: 'Session expired, saved locally only',
        js_save_cloud: 'Synced to cloud',
        js_save_cloud_fail: 'Cloud sync failed, saved locally',
        js_need_resume_fields: 'Please fill in at least name, target role or resume draft',
        js_generating: 'AI is polishing your resume, please wait…',
        js_gen_rate_limit: 'Free trial used up. Please sign in to continue.',
        js_resume_done: 'Resume generated',
        js_resume_fail: 'Failed to generate resume, please try again later',
        js_no_jobs: 'No matching jobs yet. Complete your profile and retry.',
        js_need_match_fields: 'Please fill in target role or skills',
        js_matching: 'Matching jobs (demo data)…',
        js_match_rate_limit: 'Free trial used up. Please sign in to continue.',
        js_match_fail: 'Job matching failed, please try again later',
        js_match_done_1: 'Recommended ',
        js_match_done_2: ' matching jobs',
        job_match_score: 'Match ',
        job_source_default: 'Jobs',
    },
};

const I18N_STORAGE_KEY = 'app_lang';

function getLang() {
    const saved = localStorage.getItem(I18N_STORAGE_KEY);
	return saved === 'zh' ? 'zh' : 'en';
}

function t(key) {
    const lang = getLang();
    // 用 in 判断而非真值，避免空字符串文案被当成缺失而回退到中文
    if (LANG[lang] && key in LANG[lang]) return LANG[lang][key];
    if (key in LANG.zh) return LANG.zh[key];
    return key;
}

function applyStaticI18n() {
    // 文本内容
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    // placeholder
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    // title 属性
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    // data-tip 属性（tooltip）
    document.querySelectorAll('[data-i18n-tip]').forEach(el => {
        el.setAttribute('data-tip', t(el.getAttribute('data-i18n-tip')));
    });
    // <html lang>
    document.documentElement.setAttribute('lang', getLang() === 'en' ? 'en' : 'zh-CN');
}

function setLang(lang) {
    const next = lang === 'en' ? 'en' : 'zh';
    localStorage.setItem(I18N_STORAGE_KEY, next);
    applyStaticI18n();
    updateLangToggleLabel();
    // 广播给动态渲染的模块（技能、找工作、聊天状态等）
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
}

function toggleLang() {
    setLang(getLang() === 'en' ? 'zh' : 'en');
}

function updateLangToggleLabel() {
    const btn = document.getElementById('langToggleBtn');
    if (btn) {
        // 显示“将切换到的目标语言”，直观易懂
        btn.textContent = getLang() === 'en' ? '中' : 'EN';
    }
}

// 暴露到全局，供其它脚本调用
window.t = t;
window.getLang = getLang;
window.setLang = setLang;
window.applyStaticI18n = applyStaticI18n;

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('langToggleBtn');
    if (btn) {
        btn.addEventListener('click', toggleLang);
    }
    applyStaticI18n();
    updateLangToggleLabel();
});
