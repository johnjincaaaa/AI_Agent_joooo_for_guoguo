// ==============================
// 找工作：个人画像 · 简历 · 岗位推荐
// ==============================

let isJobHuntMode = false;
let selectedTemplateId = 'classic';
let currentResume = '';

// 下拉选项：value 用固定值（存库不随语言变），labelKey 用于显示翻译
const GENDER_OPTS = [
    { value: '', labelKey: 'opt_select' },
    { value: '男', labelKey: 'opt_male' },
    { value: '女', labelKey: 'opt_female' },
];
const EDUCATION_OPTS = [
    { value: '', labelKey: 'opt_select' },
    { value: '大专', labelKey: 'opt_edu_college' },
    { value: '本科', labelKey: 'opt_edu_bachelor' },
    { value: '硕士', labelKey: 'opt_edu_master' },
    { value: '博士', labelKey: 'opt_edu_phd' },
];
const EXPERIENCE_OPTS = [
    { value: '', labelKey: 'opt_select' },
    { value: '在校/应届', labelKey: 'opt_exp_fresh' },
    { value: '1-3年', labelKey: 'opt_exp_1_3' },
    { value: '3-5年', labelKey: 'opt_exp_3_5' },
    { value: '5-10年', labelKey: 'opt_exp_5_10' },
];

// labelKey / phKey 指向 i18n 字典，渲染时用 t() 取当前语言
const PROFILE_FIELDS = [
    { key: 'name', labelKey: 'f_name', type: 'text', phKey: 'ph_name' },
    { key: 'gender', labelKey: 'f_gender', type: 'select', options: GENDER_OPTS },
    { key: 'age', labelKey: 'f_age', type: 'text', phKey: 'ph_age' },
    { key: 'education', labelKey: 'f_education', type: 'select', options: EDUCATION_OPTS },
    { key: 'major', labelKey: 'f_major', type: 'text', phKey: 'ph_major' },
    { key: 'school', labelKey: 'f_school', type: 'text', phKey: 'ph_school' },
    { key: 'experience_years', labelKey: 'f_experience_years', type: 'select', options: EXPERIENCE_OPTS },
    { key: 'target_city', labelKey: 'f_target_city', type: 'text', phKey: 'ph_target_city' },
    { key: 'target_role', labelKey: 'f_target_role', type: 'text', phKey: 'ph_target_role' },
    { key: 'skills', labelKey: 'f_skills', type: 'text', phKey: 'ph_skills', full: false },
    { key: 'work_experience', labelKey: 'f_work_experience', type: 'textarea', full: true, phKey: 'ph_work_experience' },
    { key: 'project_experience', labelKey: 'f_project_experience', type: 'textarea', full: true, phKey: 'ph_project_experience' },
    { key: 'self_intro', labelKey: 'f_self_intro', type: 'textarea', full: true, phKey: 'ph_self_intro' },
    { key: 'preset_resume', labelKey: 'f_preset_resume', type: 'textarea', full: true, phKey: 'ph_preset_resume' },
];

function getProfileStorageKey() {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    return `jobProfile_${userId || username || 'guest'}`;
}

function readProfileFromForm() {
    const profile = {};
    PROFILE_FIELDS.forEach(field => {
        const el = document.getElementById(`jobField_${field.key}`);
        profile[field.key] = el ? el.value.trim() : '';
    });
    return profile;
}

function fillProfileForm(profile) {
    PROFILE_FIELDS.forEach(field => {
        const el = document.getElementById(`jobField_${field.key}`);
        if (el && profile[field.key] !== undefined) {
            el.value = profile[field.key];
        }
    });
}

function saveProfileLocal(profile) {
    localStorage.setItem(getProfileStorageKey(), JSON.stringify({
        profile,
        template_id: selectedTemplateId,
        resume_content: currentResume,
    }));
}

function loadProfileLocal() {
    try {
        return JSON.parse(localStorage.getItem(getProfileStorageKey()) || '{}');
    } catch {
        return {};
    }
}

function buildAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token && token !== 'null') {
        headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
}

function isLoggedIn() {
    const token = localStorage.getItem('token');
    return token && token !== 'null';
}

function setJobStatus(elId, text, type = '') {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'job-status-tip' + (type ? ` ${type}` : '');
}

function renderProfileForm() {
    const container = document.getElementById('jobProfileForm');
    if (!container) return;

    // 重新渲染前保留已填内容（语言切换时不丢数据）
    const preserved = readProfileFromForm();

    container.innerHTML = PROFILE_FIELDS.map(field => {
        const fullClass = field.full ? 'job-field full-width' : 'job-field';
        const ph = field.phKey ? t(field.phKey) : '';
        let inputHtml = '';
        if (field.type === 'select') {
            inputHtml = `<select id="jobField_${field.key}">${field.options.map(opt =>
                `<option value="${opt.value}">${t(opt.labelKey)}</option>`).join('')}</select>`;
        } else if (field.type === 'textarea') {
            inputHtml = `<textarea id="jobField_${field.key}" placeholder="${ph}"></textarea>`;
        } else {
            inputHtml = `<input id="jobField_${field.key}" type="text" placeholder="${ph}">`;
        }
        return `<div class="${fullClass}"><label for="jobField_${field.key}">${t(field.labelKey)}</label>${inputHtml}</div>`;
    }).join('');

    // 回填保留的内容
    fillProfileForm(preserved);
}

async function loadTemplates() {
    const grid = document.getElementById('jobTemplateGrid');
    if (!grid) return;

    try {
        const res = await fetch(`${config.API_BASE_URL}/ai/job/templates`);
        const data = await res.json();
        const templates = data.templates || [];
        grid.innerHTML = templates.map(t => `
            <div class="template-card${selectedTemplateId === t.id ? ' selected' : ''}" data-template-id="${t.id}">
                <h4>${t.name}</h4>
                <p>${t.description}</p>
            </div>
        `).join('');

        grid.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                selectedTemplateId = card.dataset.templateId;
                grid.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                updateStepTags(2);
            });
        });
    } catch (err) {
        grid.innerHTML = `<p class="job-status-tip error">${t('js_template_fail')}</p>`;
    }
}

async function loadUserProfile() {
    const cached = loadProfileLocal();
    if (cached.profile) {
        fillProfileForm(cached.profile);
        selectedTemplateId = cached.template_id || 'classic';
        currentResume = cached.resume_content || '';
        renderResumePreview(currentResume);
    }

    if (!isLoggedIn()) return;

    try {
        const res = await fetch(`${config.API_BASE_URL}/ai/job/profile`, {
            headers: buildAuthHeaders(),
        });
        if (res.status === 401) return;
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile && Object.keys(data.profile).length) {
            fillProfileForm(data.profile);
            selectedTemplateId = data.template_id || selectedTemplateId;
            currentResume = data.resume_content || currentResume;
            renderResumePreview(currentResume);
            saveProfileLocal(data.profile);
        }
    } catch (err) {
        console.warn('加载云端画像失败', err);
    }
}

async function saveProfile() {
    const profile = readProfileFromForm();
    saveProfileLocal(profile);
    setJobStatus('jobSaveStatus', t('js_save_local'), 'success');

    if (!isLoggedIn()) {
        setJobStatus('jobSaveStatus', t('js_save_local_hint'), 'success');
        return;
    }

    try {
        const res = await fetch(`${config.API_BASE_URL}/ai/job/profile`, {
            method: 'POST',
            headers: buildAuthHeaders(),
            body: JSON.stringify({
                profile,
                template_id: selectedTemplateId,
                resume_content: currentResume,
            }),
        });
        if (res.status === 401) {
            setJobStatus('jobSaveStatus', t('js_save_expired'), 'error');
            return;
        }
        if (!res.ok) throw new Error('save failed');
        setJobStatus('jobSaveStatus', t('js_save_cloud'), 'success');
    } catch {
        setJobStatus('jobSaveStatus', t('js_save_cloud_fail'), 'error');
    }
}

function renderResumePreview(text) {
    const box = document.getElementById('jobResumePreview');
    if (!box) return;
    if (!text) {
        box.className = 'resume-preview empty';
        box.innerHTML = t('job_resume_empty');
        return;
    }
    box.className = 'resume-preview';
    box.innerHTML = typeof renderMarkdown === 'function' ? renderMarkdown(text) : text;
}

async function generateResume() {
    const profile = readProfileFromForm();
    if (!profile.name && !profile.target_role && !profile.preset_resume) {
        setJobStatus('jobResumeStatus', t('js_need_resume_fields'), 'error');
        return;
    }

    const btn = document.getElementById('jobGenerateBtn');
    btn.disabled = true;
    setJobStatus('jobResumeStatus', t('js_generating'));

    try {
        const res = await fetch(`${config.API_BASE_URL}/ai/job/generate-resume`, {
            method: 'POST',
            headers: buildAuthHeaders(),
            body: JSON.stringify({ profile, template_id: selectedTemplateId, lang: typeof getLang === 'function' ? getLang() : 'zh' }),
        });
        if (res.status === 429) {
            setJobStatus('jobResumeStatus', t('js_gen_rate_limit'), 'error');
            return;
        }
        if (!res.ok) throw new Error('generate failed');
        const data = await res.json();
        currentResume = data.resume || '';
        renderResumePreview(currentResume);
        saveProfileLocal(profile);
        updateStepTags(3);
        setJobStatus('jobResumeStatus', t('js_resume_done'), 'success');
    } catch (err) {
        setJobStatus('jobResumeStatus', t('js_resume_fail'), 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
    }
}

function renderJobCards(jobs) {
    const list = document.getElementById('jobRecommendList');
    if (!list) return;

    if (!jobs.length) {
        list.innerHTML = `<p class="job-status-tip">${t('js_no_jobs')}</p>`;
        return;
    }

    list.innerHTML = jobs.map(job => `
        <a class="job-card" href="${job.url}" target="_blank" rel="noopener noreferrer">
            <div class="job-card-top">
                <div class="job-card-title">
                    ${job.title}
                    <span class="job-source-badge">${job.source || t('job_source_default')}</span>
                </div>
                <div class="job-card-salary">${job.salary}</div>
            </div>
            <div class="job-card-company">${job.company}</div>
            <div class="job-card-meta">
                <span>${job.city}</span>
                <span>${job.experience}</span>
                <span>${job.education}</span>
            </div>
            <div class="job-card-tags">
                ${(job.tags || []).map(tag => `<span class="job-tag">${tag}</span>`).join('')}
            </div>
            <div class="job-match">
                <span class="job-match-score">${t('job_match_score')}${job.match_score}%</span>
                <span class="job-match-reason">${job.match_reason || ''}</span>
            </div>
        </a>
    `).join('');
}

async function matchJobs() {
    const profile = readProfileFromForm();
    if (!profile.target_role && !profile.skills) {
        setJobStatus('jobMatchStatus', t('js_need_match_fields'), 'error');
        return;
    }

    const btn = document.getElementById('jobMatchBtn');
    btn.disabled = true;
    setJobStatus('jobMatchStatus', t('js_matching'));

    try {
        const res = await fetch(`${config.API_BASE_URL}/ai/job/match`, {
            method: 'POST',
            headers: buildAuthHeaders(),
            body: JSON.stringify({
                profile,
                resume_content: currentResume,
            }),
        });
        if (res.status === 429) {
            setJobStatus('jobMatchStatus', t('js_match_rate_limit'), 'error');
            return;
        }
        if (!res.ok) throw new Error('match failed');
        const data = await res.json();
        renderJobCards(data.jobs || []);
        updateStepTags(4);
        setJobStatus('jobMatchStatus', `${t('js_match_done_1')}${(data.jobs || []).length}${t('js_match_done_2')}`, 'success');
    } catch (err) {
        setJobStatus('jobMatchStatus', t('js_match_fail'), 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
    }
}

function updateStepTags(activeStep) {
    document.querySelectorAll('.job-step-tag').forEach((tag, index) => {
        const step = index + 1;
        tag.classList.remove('active', 'done');
        if (step < activeStep) tag.classList.add('done');
        if (step === activeStep) tag.classList.add('active');
    });
}

function enterJobHuntMode() {
    if (typeof exitWalletMode === 'function') exitWalletMode();
    isJobHuntMode = true;

    document.querySelectorAll('.history.title').forEach(el => el.classList.remove('active'));
    document.getElementById('jobHuntEntry')?.classList.add('active');

    document.getElementById('chatSession').textContent = t('job_panel_title');
    document.querySelectorAll('#chatBox .message').forEach(el => el.remove());
    document.getElementById('emptyState')?.classList.add('hidden');

    if (typeof chatData !== 'undefined') chatData = [];
    if (typeof clearPendingAttachments === 'function') clearPendingAttachments();

    document.getElementById('chatBox')?.classList.add('hidden');
    document.getElementById('jobHuntPanel')?.classList.remove('hidden');
    document.querySelector('.input-area')?.classList.add('hidden');
    document.getElementById('scrollBottomBtn')?.classList.add('hidden');

    loadUserProfile();
    loadTemplates();
    updateStepTags(1);
}

function exitJobHuntMode() {
    if (!isJobHuntMode) return;
    isJobHuntMode = false;

    document.getElementById('jobHuntEntry')?.classList.remove('active');
    document.getElementById('jobHuntPanel')?.classList.add('hidden');
    document.getElementById('chatBox')?.classList.remove('hidden');
    document.querySelector('.input-area')?.classList.remove('hidden');
    document.getElementById('scrollBottomBtn')?.classList.remove('hidden');

    const hasMessages = document.querySelectorAll('#chatBox .message').length > 0;
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.classList.toggle('hidden', hasMessages);
    }
}

function initJobHunt() {
    renderProfileForm();

    document.getElementById('jobHuntEntry')?.addEventListener('click', enterJobHuntMode);
    document.getElementById('jobSaveProfileBtn')?.addEventListener('click', saveProfile);
    document.getElementById('jobGenerateBtn')?.addEventListener('click', generateResume);
    document.getElementById('jobMatchBtn')?.addEventListener('click', matchJobs);

    const cached = loadProfileLocal();
    if (cached.profile) {
        fillProfileForm(cached.profile);
        selectedTemplateId = cached.template_id || 'classic';
        currentResume = cached.resume_content || '';
    }
}

// 语言切换：重渲染表单（label/placeholder/下拉选项），并更新当前标题/预览
document.addEventListener('langchange', () => {
    renderProfileForm();
    if (isJobHuntMode) {
        const cs = document.getElementById('chatSession');
        if (cs) cs.textContent = t('job_panel_title');
        renderResumePreview(currentResume);
    }
});

window.enterJobHuntMode = enterJobHuntMode;
window.exitJobHuntMode = exitJobHuntMode;
window.isJobHuntMode = () => isJobHuntMode;
window.refreshJobProfile = loadUserProfile;

document.addEventListener('DOMContentLoaded', initJobHunt);
