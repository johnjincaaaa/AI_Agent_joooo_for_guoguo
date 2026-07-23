// ==============================
// 附件：粘贴图片 / 本地选择多文件
// ==============================

const attachmentPreviewBar = document.getElementById('attachmentPreviewBar');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf', '.doc', '.docx', '.txt'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const ACCEPTED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
};

/** @type {{id: string, file: File, kind: 'image'|'document', previewUrl?: string, name: string}[]} */
let pendingAttachments = [];

function buildAuthHeadersForUpload() {
    const headers = {};
    const token = localStorage.getItem('token');
    if (token && token !== 'null') {
        headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
}

function getFileExtension(name) {
    const index = name.lastIndexOf('.');
    return index >= 0 ? name.slice(index).toLowerCase() : '';
}

function detectFileKind(file) {
    const ext = getFileExtension(file.name);
    if (file.type.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) {
        return 'image';
    }
    return 'document';
}

function isAcceptedFile(file) {
    const ext = getFileExtension(file.name);
    if (ACCEPTED_EXTENSIONS.includes(ext)) return true;
    if (ACCEPTED_MIME_TYPES[file.type]) return true;
    if (file.type.startsWith('image/')) return true;
    return false;
}

function normalizePastedFile(file) {
    if (!file) return null;

    const ext = getFileExtension(file.name);
    if (ext && ACCEPTED_EXTENSIONS.includes(ext)) {
        return file;
    }

    const mappedExt = ACCEPTED_MIME_TYPES[file.type]
        || (file.type.startsWith('image/') ? '.png' : '');
    if (!mappedExt) return null;

    const baseName = (file.name && file.name !== 'image.png')
        ? file.name
        : `pasted-${Date.now()}${mappedExt}`;

    const finalName = getFileExtension(baseName) ? baseName : `${baseName}${mappedExt}`;
    return new File([file], finalName, { type: file.type || 'application/octet-stream' });
}

function hasPendingAttachments() {
    return pendingAttachments.length > 0;
}

function hasPendingImages() {
    return pendingAttachments.some(item => item.kind === 'image');
}

function renderAttachmentPreviews() {
    if (!attachmentPreviewBar) return;

    if (!pendingAttachments.length) {
        attachmentPreviewBar.hidden = true;
        attachmentPreviewBar.innerHTML = '';
        return;
    }

    attachmentPreviewBar.hidden = false;
    attachmentPreviewBar.innerHTML = '';

    pendingAttachments.forEach(item => {
        const wrap = document.createElement('div');
        wrap.className = `attachment-preview-item attachment-${item.kind}`;

        if (item.kind === 'image') {
            wrap.innerHTML = `
                <img src="${item.previewUrl}" alt="${item.name}">
                <button type="button" class="attachment-preview-remove" aria-label="移除附件" data-id="${item.id}">×</button>
            `;
        } else {
            wrap.innerHTML = `
                <div class="attachment-doc-icon">📄</div>
                <div class="attachment-doc-name" title="${item.name}">${item.name}</div>
                <button type="button" class="attachment-preview-remove" aria-label="移除附件" data-id="${item.id}">×</button>
            `;
        }

        wrap.querySelector('.attachment-preview-remove').addEventListener('click', () => {
            removePendingAttachment(item.id);
        });
        attachmentPreviewBar.appendChild(wrap);
    });
}

function addPendingFile(rawFile) {
    const file = normalizePastedFile(rawFile) || rawFile;
    if (!file || !isAcceptedFile(file)) return;

    const dupKey = `${file.name}:${file.size}:${file.lastModified}`;
    if (pendingAttachments.some(item =>
        `${item.file.name}:${item.file.size}:${item.file.lastModified}` === dupKey
    )) {
        return;
    }

    const kind = detectFileKind(file);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const item = {
        id,
        file,
        kind,
        name: file.name || (kind === 'image' ? 'pasted-image.png' : 'document'),
    };

    if (kind === 'image') {
        item.previewUrl = URL.createObjectURL(file);
        if (typeof enableSkill === 'function') {
            enableSkill('image_parsing');
        }
    } else if (typeof enableSkill === 'function') {
        enableSkill('document_parsing');
    }

    pendingAttachments.push(item);
    renderAttachmentPreviews();
    updateAttachBtnState();
}

function removePendingAttachment(id) {
    const index = pendingAttachments.findIndex(item => item.id === id);
    if (index === -1) return;
    if (pendingAttachments[index].previewUrl) {
        URL.revokeObjectURL(pendingAttachments[index].previewUrl);
    }
    pendingAttachments.splice(index, 1);
    renderAttachmentPreviews();
    updateAttachBtnState();
}

function clearPendingAttachments() {
    pendingAttachments.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    pendingAttachments = [];
    renderAttachmentPreviews();
    updateAttachBtnState();
}

function updateAttachBtnState() {
    if (!attachBtn) return;
    attachBtn.classList.toggle('active', pendingAttachments.length > 0);
}

async function uploadSingleFile(file) {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const res = await fetch(`${config.API_BASE_URL}/ai/upload-file`, {
        method: 'POST',
        headers: buildAuthHeadersForUpload(),
        body: formData,
    });

    if (res.status === 429) {
        throw new Error('RATE_LIMIT');
    }
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseApiErrorMessage(errData, '文件上传失败'));
    }

    return res.json();
}

async function uploadPendingAttachments() {
    const imagePaths = [];
    const imageUrls = [];
    const documentPaths = [];
    const documentNames = [];

    for (const item of pendingAttachments) {
        const data = await uploadSingleFile(item.file);
        if (data.kind === 'image') {
            imagePaths.push(data.path);
            imageUrls.push(data.url);
        } else {
            documentPaths.push(data.path);
            documentNames.push({ name: data.name || item.name, url: data.url });
        }
    }

    return { imagePaths, imageUrls, documentPaths, documentNames };
}

function buildDisplayMessage(text, imageUrls, documentNames) {
    const parts = [];

    imageUrls.forEach(url => {
        parts.push(`![图片](${url})`);
    });

    documentNames.forEach(doc => {
        parts.push(`📎 [${doc.name}](${doc.url})`);
    });

    if (text) {
        parts.push(text);
    }

    if (!parts.length) {
        if (documentNames.length) return '请分析这些文档';
        return '请分析这张图片';
    }

    return parts.join('\n\n');
}

function collectClipboardFiles(clipboard) {
    const collected = [];
    const seen = new Set();

    const pushFile = (rawFile) => {
        const file = normalizePastedFile(rawFile);
        if (!file || !isAcceptedFile(file)) return;
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (seen.has(key)) return;
        seen.add(key);
        collected.push(file);
    };

    // files 与 items 常重复，优先 FileList
    if (clipboard.files?.length) {
        for (const file of clipboard.files) {
            pushFile(file);
        }
    } else {
        for (const item of clipboard.items || []) {
            if (item.kind === 'file') {
                pushFile(item.getAsFile());
            }
        }
    }

    return collected;
}

function handlePaste(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const collected = collectClipboardFiles(clipboard);
    if (!collected.length) return;

    event.preventDefault();
    event.stopPropagation();
    collected.forEach(addPendingFile);
}

function handleFileInputChange(event) {
    const files = Array.from(event.target.files || []);
    files.forEach(addPendingFile);
    event.target.value = '';
}

const inputBoxWrapper = document.querySelector('.input-box-wrapper');
if (inputBoxWrapper) {
    inputBoxWrapper.addEventListener('paste', handlePaste);
}

if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileInputChange);
}

window.hasPendingAttachments = hasPendingAttachments;
window.hasPendingImages = hasPendingImages;
window.uploadPendingAttachments = uploadPendingAttachments;
window.clearPendingAttachments = clearPendingAttachments;
window.buildDisplayMessage = buildDisplayMessage;

// 兼容旧接口
window.uploadPendingImages = uploadPendingAttachments;
window.clearPendingImages = clearPendingAttachments;
