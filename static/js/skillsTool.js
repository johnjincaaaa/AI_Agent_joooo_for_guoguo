// ==============================
// 技能选择：指定 LLM 工具链
// ==============================

const SKILL_ICONS = {
    image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
    </svg>`,
    document: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>`,
    default: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
    </svg>`,
};

const skillsBtn = document.getElementById('skillsBtn');
const skillsDropdown = document.getElementById('skillsDropdown');
const skillsList = document.getElementById('skillsList');

/** @type {Set<string>} */
const enabledSkills = new Set(
    JSON.parse(localStorage.getItem('enabledSkills') || '[]')
);

function getSkillIcon(iconKey) {
    return SKILL_ICONS[iconKey] || SKILL_ICONS.default;
}

function persistEnabledSkills() {
    localStorage.setItem('enabledSkills', JSON.stringify([...enabledSkills]));
}

function updateSkillsBtnLabel() {
    if (!skillsBtn) return;
    const count = enabledSkills.size;
    skillsBtn.classList.toggle('active', count > 0);
    const label = skillsBtn.querySelector('.skills-btn-label');
    if (label) {
        label.textContent = count > 0 ? `${t('skills_btn')} · ${count}` : t('skills_btn');
    }
}

function renderSkillsList(skills) {
    if (!skillsList) return;
    skillsList.innerHTML = '';

    if (!skills.length) {
        skillsList.innerHTML = `<div class="skills-empty">${t('skills_empty')}</div>`;
        return;
    }

    skills.forEach(skill => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'skills-item' + (enabledSkills.has(skill.id) ? ' selected' : '');
        item.dataset.skillId = skill.id;
        item.title = skill.description || skill.name;
        item.innerHTML = `
            <span class="skills-item-icon">${getSkillIcon(skill.icon)}</span>
            <span class="skills-item-text">
                <span class="skills-item-name">${skill.name}</span>
                ${skill.description ? `<span class="skills-item-desc">${skill.description}</span>` : ''}
            </span>
            <span class="skills-item-check" aria-hidden="true">✓</span>
        `;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSkill(skill.id, item);
        });
        skillsList.appendChild(item);
    });
}

function toggleSkill(skillId, itemEl) {
    if (enabledSkills.has(skillId)) {
        enabledSkills.delete(skillId);
        itemEl?.classList.remove('selected');
    } else {
        enabledSkills.add(skillId);
        itemEl?.classList.add('selected');
    }
    persistEnabledSkills();
    updateSkillsBtnLabel();
}

function buildFallbackSkills() {
    return [
        {
            id: 'image_parsing',
            name: t('skill_image_name'),
            description: t('skill_image_desc'),
            icon: 'image',
        },
        {
            id: 'document_parsing',
            name: t('skill_doc_name'),
            description: t('skill_doc_desc'),
            icon: 'document',
        },
    ];
}

// 已知内置技能的本地化映射（后端返回的这两个技能名也随语言切换）
const SKILL_I18N = {
    image_parsing: { name: 'skill_image_name', desc: 'skill_image_desc' },
    document_parsing: { name: 'skill_doc_name', desc: 'skill_doc_desc' },
};

function localizeSkill(skill) {
    const map = SKILL_I18N[skill.id];
    if (!map) return skill;
    return { ...skill, name: t(map.name), description: t(map.desc) };
}

// 记住最近一次技能目录，语言切换时重新渲染
let lastSkills = [];

function mergeSkills(apiSkills) {
    const map = new Map();
    [...buildFallbackSkills(), ...(apiSkills || [])].forEach(skill => {
        map.set(skill.id, skill);
    });
    return [...map.values()].map(localizeSkill);
}

async function loadSkillsCatalog() {
    try {
        const res = await fetch(`${config.API_BASE_URL}/ai/skills`);
        if (!res.ok) throw new Error('fetch skills failed');
        const data = await res.json();
        lastSkills = mergeSkills(data.skills || []);
        renderSkillsList(lastSkills);
    } catch (err) {
        console.error('加载技能列表失败：', err);
        lastSkills = buildFallbackSkills().map(localizeSkill);
        renderSkillsList(lastSkills);
    }
    updateSkillsBtnLabel();
}

function getEnabledSkills() {
    return [...enabledSkills];
}

function enableSkill(skillId) {
    if (enabledSkills.has(skillId)) return;
    enabledSkills.add(skillId);
    persistEnabledSkills();
    updateSkillsBtnLabel();
    const item = skillsList?.querySelector(`[data-skill-id="${skillId}"]`);
    item?.classList.add('selected');
}

if (skillsBtn && skillsDropdown) {
    skillsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        skillsDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
        skillsDropdown.classList.remove('open');
    });

    skillsDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    loadSkillsCatalog();
}

// 语言切换时重新渲染技能名与按钮标签
document.addEventListener('langchange', () => {
    lastSkills = lastSkills.map(localizeSkill);
    renderSkillsList(lastSkills);
    updateSkillsBtnLabel();
});

window.getEnabledSkills = getEnabledSkills;
window.enableSkill = enableSkill;
