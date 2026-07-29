from sqlalchemy.orm import Session
import uvicorn
from fastapi import FastAPI, Request, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel
from typing import List, Optional
import logging
import uuid
from pathlib import Path

import config

logger = logging.getLogger("uvicorn.info")

from config import *
from token_utils import (
    create_access_token, verify_token, get_optional_user_id,
    create_admin_token, verify_admin_token,
)
from password_utils import hash_password, verify_password, needs_rehash
from rate_limit import check_anonymous_rate_limit, get_anonymous_remaining
from services import promo
# 提前引入 ORM（get_db 等），供靠前定义的路由用作默认参数（默认值在定义时求值）
from sqlOrm import *
import tools
from tools.skills_registry import get_skill_catalog, resolve_tools
from services.job_mock_data import RESUME_TEMPLATES, MOCK_JOBS, match_jobs

try:
    from langchain.chat_models import init_chat_model
    from langchain.agents import create_agent
    from langchain.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
except ModuleNotFoundError as e:
    print(e)

# 初始化 FastAPI 应用
app = FastAPI(
    title="Rove AI",
    description="一个致力于取悦自我的ai应用",
    version="1.0",

)
app.mount("/static", StaticFiles(directory="static"), name="static")  # ✅ 静态文件统一配置（全局只需这一句）
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
templates = Jinja2Templates(directory="templates")  # 自动找 HTML

# 静态资源版本号：附加到 css/js 链接后（?v=），改动后浏览器会自动拉新，避免缓存旧文件。
# 用启动时间戳，每次重启服务即刷新缓存；生产可改成固定版本号或 git commit。
import time as _time
ASSET_VERSION = str(int(_time.time()))
templates.env.globals["ASSET_VERSION"] = ASSET_VERSION

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"}
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
}
ALLOWED_FILE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
    ".pdf", ".doc", ".docx", ".txt",
}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DOCUMENT_SIZE = 20 * 1024 * 1024  # 20MB

# 允许跨域（让你的 HTML 页面可以调用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------- 聊天页 -------------------
@app.get("/chat", summary="聊天页",
         description="启动入口，返回html")
def chat_page(request: Request, db: Session = Depends(get_db)):
    # 访问埋点（PV/UV）——失败绝不影响页面返回
    try:
        promo.record_page_visit(
            db,
            ip=promo.client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            ref_code=request.query_params.get("ref", ""),
            path="/chat",
        )
    except Exception as e:
        logger.warning(f"[埋点] 访问记录失败：{e}")
    return templates.TemplateResponse(name="ai.html", request=request)


# 定义消息结构
class ChatMessage(BaseModel):
    role: str  # user / ai
    message: str


# 前端传过来的结构
class ChatRequest(BaseModel):
    """
    {
      "history": [
        {"role": "user", "message": "你好"}, === ChatMessage
        {"role": "ai", "message": "你好！"},
        ...
      ],
      "newMessage": "我最新说的话",
      open_online: False # 全局一键联网开关


    }
    """
    history: List[ChatMessage]  # 完整历史
    newMessage: str  # 最新一条消息
    open_online: bool = False  # 全局一键联网开关
    enabled_skills: List[str] = []  # 前端选中的技能 id 列表
    image_paths: List[str] = []  # 用户粘贴/上传图片的服务端路径
    document_paths: List[str] = []  # 用户上传文档的服务端路径
    lang: str = "zh"  # 界面语言，AI 回复语言随之切换（zh / en）


def augment_message_with_attachments(
        message: str,
        image_paths: List[str],
        document_paths: List[str],
) -> str:
    hints = []
    if image_paths:
        paths_text = "\n".join(f"- {path}" for path in image_paths)
        hints.append(
            f"[系统提示] 用户附带了图片，请使用 image_analyze 工具分析，图片本地路径：\n{paths_text}"
        )
    if document_paths:
        paths_text = "\n".join(f"- {path}" for path in document_paths)
        hints.append(
            f"[系统提示] 用户附带了文档，请使用 document_analyze 工具读取，文档本地路径：\n{paths_text}"
        )
    if not hints:
        return message

    if image_paths and not message.strip():
        base = "请分析这张图片"
    elif document_paths and not message.strip():
        base = "请分析这些文档"
    else:
        base = message.strip() if message.strip() else "请处理附件内容"

    return f"{base}\n\n" + "\n\n".join(hints)


def resolve_enabled_skills(
        enabled_skills: List[str],
        image_paths: List[str],
        document_paths: List[str],
) -> List[str]:
    skills = list(enabled_skills)
    if image_paths and "image_parsing" not in skills:
        skills.append("image_parsing")
    if document_paths and "document_parsing" not in skills:
        skills.append("document_parsing")
    return skills


def build_agent_messages(
        ai_context: List[ChatMessage],
        image_paths: List[str],
        document_paths: List[str],
):
    messages = []
    for i, msg in enumerate(ai_context):
        content = msg.message
        if msg.role == "user" and i == len(ai_context) - 1:
            content = augment_message_with_attachments(content, image_paths, document_paths)
        if msg.role == "user":
            messages.append(HumanMessage(content=content))
        else:
            messages.append(AIMessage(content=content))
    return messages


def _detect_file_kind(content_type: str, suffix: str) -> str:
    if content_type in ALLOWED_IMAGE_TYPES or suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}:
        return "image"
    return "document"


def _save_upload_file(content: bytes, filename: str, suffix: str) -> Path:
    safe_suffix = suffix if suffix in ALLOWED_FILE_EXTENSIONS else ".bin"
    save_name = f"{uuid.uuid4().hex}{safe_suffix}"
    save_path = UPLOAD_DIR / save_name
    save_path.write_bytes(content)
    return save_path


def build_system_prompt(lang: str = "zh") -> str:
    """根据界面语言返回系统提示词，控制 AI 回复语言。"""
    if (lang or "zh").lower().startswith("en"):
        return "You are a helpful assistant. Always respond in English."
    return SYSTEM_PROMPT


def build_tool_list(open_online: bool, enabled_skills: Optional[List[str]] = None):
    tool_list = list(config.TOOL_LIST)
    tool_list.extend(resolve_tools(enabled_skills or []))
    if open_online:
        tool_list.extend([tools.online, tools.online_intensive])
    return tool_list


@app.get("/ai/skills", summary="获取可用技能列表")
def list_skills():
    return {"code": 200, "skills": get_skill_catalog()}


@app.post("/ai/upload-image", summary="上传聊天图片")
async def upload_image(
        http_request: Request,
        file: UploadFile = File(...),
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    result = await _handle_file_upload(http_request, file, user_id)
    if result["kind"] != "image":
        raise HTTPException(status_code=400, detail={"code": 400, "msg": "请使用文档上传接口上传非图片文件"})
    return result


@app.post("/ai/upload-file", summary="上传聊天附件")
async def upload_file(
        http_request: Request,
        file: UploadFile = File(...),
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    return await _handle_file_upload(http_request, file, user_id)


async def _handle_file_upload(
        http_request: Request,
        file: UploadFile,
        user_id: Optional[int],
):
    ensure_chat_access(http_request, user_id)

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={"code": 400, "msg": "仅支持图片、PDF、Word(doc/docx)、TXT 文件"},
        )

    kind = _detect_file_kind(file.content_type or "", suffix)
    max_size = MAX_IMAGE_SIZE if kind == "image" else MAX_DOCUMENT_SIZE

    content = await file.read()
    if len(content) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail={"code": 400, "msg": f"文件大小不能超过 {limit_mb}MB"})

    save_path = _save_upload_file(content, file.filename or "file", suffix)

    return {
        "code": 200,
        "path": str(save_path.resolve()),
        "url": f"/uploads/{save_path.name}",
        "kind": kind,
        "name": file.filename or save_path.name,
    }


def ensure_chat_access(http_request: Request, user_id: Optional[int]) -> Optional[int]:
    """已登录用户不限流，返回 None；未登录用户消耗一次并返回今日剩余次数。"""
    if user_id is None:
        return check_anonymous_rate_limit(http_request)
    return None


# 未登录体验剩余次数（前端用于展示「今日还剩 N 次」并做用完拦截）
@app.get("/ai/quota", summary="查询未登录用户今日免费体验剩余次数")
def get_quota(
        http_request: Request,
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    if user_id is not None:
        return {"code": 200, "logged_in": True, "limit": None, "remaining": None}
    return {
        "code": 200,
        "logged_in": False,
        "limit": config.ANONYMOUS_RATE_LIMIT_MAX,
        "remaining": get_anonymous_remaining(http_request),
    }


# ==================== 改造后的 流式+历史 接口 ====================
@app.post("/ai/chatStream")
async def chat_stream(
        chat_request: ChatRequest,
        http_request: Request,
        temperature: float = 0.7,
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    """SSE流式输出 + 最终返回完整对话历史"""
    remaining = ensure_chat_access(http_request, user_id)

    # 1. 构建历史（和原来完全一样）
    full_history = chat_request.history.copy()
    full_history.append(ChatMessage(role='user', message=chat_request.newMessage))
    ai_context = full_history[-20:]

    # 2. 初始化模型（和原来完全一样）
    model = init_chat_model(
        model=MODEL,
        model_provider="openai",
        base_url=DASHSCOPE_URL,
        api_key=DASHSCOPE_API_KEY,
        temperature=temperature,
    )
    enabled_skills = resolve_enabled_skills(
        chat_request.enabled_skills,
        chat_request.image_paths,
        chat_request.document_paths,
    )
    tool_list = build_tool_list(chat_request.open_online, enabled_skills)

    agent = create_agent(
        model=model,
        system_prompt=build_system_prompt(chat_request.lang),
        tools=tool_list,
    )

    # 3. 格式化消息（含图片路径提示）
    messages = build_agent_messages(
        ai_context,
        chat_request.image_paths,
        chat_request.document_paths,
    )

    # ==================== 核心改造：流式输出 + 收集完整回答 ====================
    async def generate():
        # 新增：用于收集AI完整的回答内容
        full_ai_reply = ""

        # 1. 流式输出每一段文字
        async for msg_chunk, metadata in agent.astream(
                {"messages": messages},
                stream_mode="messages",
        ):
            if msg_chunk.content:
                content = msg_chunk.content
                full_ai_reply += content  # 拼接完整回答
                yield f"data: {content}\n\n"  # 实时流式输出

        # 2. AI回答完毕，构建完整历史
        # 格式化为标准ChatMessage结构
        ai_message = ChatMessage(role="ai", message=full_ai_reply)
        final_history = full_history + [ai_message]

        # 3. 通过SSE发送【完整历史数据】给前端（特殊标记）
        yield f"data: [HISTORY] {json.dumps([m.model_dump() for m in final_history], ensure_ascii=False)}\n\n"

        # 4. 发送结束标记
        yield "data: [DONE]\n\n"

    # 返回SSE流式响应；未登录用户回传今日剩余次数，供前端展示与用完拦截
    headers = {}
    if remaining is not None:
        headers["X-Anon-Remaining"] = str(remaining)
        headers["Access-Control-Expose-Headers"] = "X-Anon-Remaining"
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=headers,
    )

# ------------------- 主接口：AI 聊天 -------------------
@app.post("/ai/chat", summary='AI 聊天'
    , description="""构建完整对话历史,取最后20条传给 AI，返回完整新历史给前端，前端同步内存""")
def ai_chat(
        chat_request: ChatRequest,
        http_request: Request,
        temperature: float = 0.7,
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    ensure_chat_access(http_request, user_id)

    # ==========================================
    # 1. 构建完整对话历史 = 历史对话 + 最新发送
    # ==========================================
    full_history = chat_request.history.copy()
    full_history.append(ChatMessage(role='user', message=chat_request.newMessage))
    # ==========================================
    # 2. 【关键】只取最后 20 条给 AI
    # ==========================================
    ai_context = full_history[-20:]  # 取最后20条！

    # ==========================================
    # 3. 把 ai_context 传给 AI
    # ==========================================
    model = init_chat_model(
        model=MODEL,
        model_provider="openai",  # 走openai兼容模式
        base_url=DASHSCOPE_URL,
        api_key=DASHSCOPE_API_KEY,
        temperature=temperature,
        # num_gpu=-1
    )
    tool_list = build_tool_list(
        chat_request.open_online,
        resolve_enabled_skills(
            chat_request.enabled_skills,
            chat_request.image_paths,
            chat_request.document_paths,
        ),
    )
    agent = create_agent(
        model=model,
        system_prompt=build_system_prompt(chat_request.lang),
        tools=tool_list,
    )

    messages = build_agent_messages(
        ai_context,
        chat_request.image_paths,
        chat_request.document_paths,
    )
    try:
        result = agent.invoke({"messages": messages})
        for msg in result["messages"]:
            if msg.type == "tool":
                logger.info(f"[调用工具] {msg.name} | {msg.content}")
            elif msg.type == "ai" and msg.content:
                logger.info(f"\n最终AI回答: {msg.content}")
        ai_reply = result["messages"][-1].content

        # ==========================================
        # 4. 返回【完整对话】
        # ==========================================
        # 完整新历史 = (旧历史 + 用户新消息) + AI回复
        final_history = full_history + [{"role": "ai", "message": ai_reply}]

        # ==========================================
        # 5. 返回完整新历史给前端，前端同步内存
        # ==========================================
        return {
            "code": 200,
            "content": ai_reply,
            "new_history": final_history  # 前端用这个覆盖 chatData
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={"code": 500, "msg": f"异常：{str(error)}"}
        )


class ChatDbRequest(BaseModel):
    chat_data: List[ChatMessage]
    create_time: int
    session_name: str


# ------------------- 接口：接收数据并存入数据库 -------------------
from sqlOrm import *


@app.post('/ai/chat/savaToDb', summary='接收数据并存入数据库',
          description=""" 按 【user_id + 秒级时间】 查询,数据更新或创建""")
def ai_savaToDb(
        request: ChatDbRequest,
        db: Session = Depends(get_db),
        user_id: int = Depends(verify_token)
):
    # 转化为用户凭证
    # user_id = 1
    session_time = request.create_time

    # ========================
    # 按 【user_id + 秒级时间】 查询
    # ========================
    existing_session = db.query(ChatSession).filter(
        ChatSession.user_id == user_id,
        ChatSession.session_time == session_time
    ).first()

    try:
        if existing_session:
            # 更新
            existing_session.messages = [m.model_dump() for m in request.chat_data]
            existing_session.session_name = request.session_name

        else:
            # 插入
            new_session = ChatSession(
                user_id=user_id,
                session_name=request.session_name,
                session_time=session_time,
                messages=[m.model_dump() for m in request.chat_data]
            )
            db.add(new_session)

        db.commit()
        return {"code": 200, "msg": "保存/更新成功"}

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": 500, "msg": f"异常：{str(error)}"}
        )


# ------------------- 接口：读取数据库chat_sessions中的messages ------------------
@app.get('/ai/chat/history', summary='读取数据库chat_sessions中的messages',
         description="""需要加密 ！！ """)
def ai_history(
        # 转化为用户凭证，由前端传入，后端校验
        user_id: int = Depends(verify_token),
        session_time: int = Query(None),
        is_Load_All: bool = Query(False),
        db: Session = Depends(get_db)
):
    if is_Load_All:
        existing_sessions = db.query(ChatSession).filter(
            ChatSession.user_id == user_id,
        ).order_by(ChatSession.session_time.desc()).all()
        try:
            if existing_sessions:
                # ✅ 把对象转成字典列表（前端能识别）
                result = []
                for item in existing_sessions:
                    result.append({
                        "session_name": item.session_name,
                        "session_time": item.session_time,
                        "messages": item.messages
                    })
                return {
                    "code": 200,
                    "chat_sessions": result,
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail={"messages": None, "session_name": None}
                )
        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail={"code": 500, "msg": f"异常：{str(error)}"}
            )

    else:
        existing_session = db.query(ChatSession).filter(
            ChatSession.user_id == user_id,
            ChatSession.session_time == session_time
        ).first()

        try:
            if existing_session:
                return {
                    "code": 200,
                    "messages": existing_session.messages,
                    "session_name": existing_session.session_name,
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail={"messages": None, "session_name": None}
                )
        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail={"code": 500, "msg": f"异常：{str(error)}"}
            )


# ==================== 找工作：简历 + 岗位推荐 ====================

class JobProfilePayload(BaseModel):
    name: str = ""
    gender: str = ""
    age: str = ""
    education: str = ""
    major: str = ""
    school: str = ""
    experience_years: str = ""
    target_city: str = ""
    target_role: str = ""
    skills: str = ""
    work_experience: str = ""
    project_experience: str = ""
    self_intro: str = ""
    preset_resume: str = ""


class JobProfileSaveRequest(BaseModel):
    profile: JobProfilePayload
    template_id: str = "classic"
    resume_content: Optional[str] = None


class JobGenerateResumeRequest(BaseModel):
    profile: JobProfilePayload
    template_id: str = "classic"
    lang: str = "zh"


class JobMatchRequest(BaseModel):
    profile: JobProfilePayload
    resume_content: str = ""


@app.get("/ai/job/templates", summary="简历模板列表")
def job_templates():
    return {"code": 200, "templates": RESUME_TEMPLATES}


@app.get("/ai/job/mock-jobs", summary="虚拟岗位列表（BOSS直聘风格）")
def job_mock_list():
    return {"code": 200, "jobs": MOCK_JOBS, "source": "mock"}


@app.get("/ai/job/profile", summary="获取用户求职画像")
def get_job_profile(
        db: Session = Depends(get_db),
        user_id: int = Depends(verify_token),
):
    record = db.query(JobProfile).filter(JobProfile.user_id == user_id).first()
    if not record:
        return {"code": 200, "profile": {}, "template_id": "classic", "resume_content": ""}
    return {
        "code": 200,
        "profile": record.profile_data or {},
        "template_id": record.template_id or "classic",
        "resume_content": record.resume_content or "",
    }


@app.post("/ai/job/profile", summary="保存用户求职画像")
def save_job_profile(
        request: JobProfileSaveRequest,
        db: Session = Depends(get_db),
        user_id: int = Depends(verify_token),
):
    record = db.query(JobProfile).filter(JobProfile.user_id == user_id).first()
    profile_dict = request.profile.model_dump()
    if record:
        record.profile_data = profile_dict
        record.template_id = request.template_id
        if request.resume_content is not None:
            record.resume_content = request.resume_content
    else:
        record = JobProfile(
            user_id=user_id,
            profile_data=profile_dict,
            template_id=request.template_id,
            resume_content=request.resume_content or "",
        )
        db.add(record)
    db.commit()
    return {"code": 200, "msg": "画像已保存"}


@app.post("/ai/job/generate-resume", summary="AI 完善简历")
def generate_job_resume(
        request: JobGenerateResumeRequest,
        http_request: Request,
        db: Session = Depends(get_db),
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    ensure_chat_access(http_request, user_id)

    template_name = next(
        (t["name"] for t in RESUME_TEMPLATES if t["id"] == request.template_id),
        "经典简约",
    )
    profile = request.profile.model_dump()
    preset = profile.get("preset_resume") or ""

    if (request.lang or "zh").lower().startswith("en"):
        prompt = f"""You are a professional resume consultant. Based on the profile and draft below, produce a complete, professional, ready-to-submit English resume in the "{template_name}" style.

Requirements:
1. Use Markdown format with a clear structure (Basic Info, Objective, Education, Work/Project Experience, Skills, Summary)
2. Polish, complete and quantify achievements based on the draft; do not fabricate experience that clearly contradicts the profile
3. Keep the language concise and professional, suitable for job platforms
4. Output only the resume body, no extra explanation

[Profile]
{json.dumps(profile, ensure_ascii=False, indent=2)}

[Resume Draft]
{preset or "(No draft, please generate from the profile)"}
"""
    else:
        prompt = f"""你是一名专业简历顾问。请根据以下个人画像和预设简历草稿，按「{template_name}」风格输出一份完整、专业、可直接投递的中文简历。

要求：
1. 使用 Markdown 格式，结构清晰（基本信息、求职意向、教育背景、工作/项目经历、技能、自我评价）
2. 在草稿基础上润色、补全、量化成果，不要编造与画像明显矛盾的经历
3. 语言简洁专业，适合 BOSS 直聘等平台
4. 只输出简历正文，不要额外解释

【个人画像】
{json.dumps(profile, ensure_ascii=False, indent=2)}

【预设简历草稿】
{preset or "（无草稿，请根据画像生成）"}
"""

    model = init_chat_model(
        model=MODEL,
        model_provider="openai",
        base_url=DASHSCOPE_URL,
        api_key=DASHSCOPE_API_KEY,
        temperature=0.7,
    )
    result = model.invoke([HumanMessage(content=prompt)])
    resume_text = result.content if hasattr(result, "content") else str(result)

    if user_id:
        record = db.query(JobProfile).filter(JobProfile.user_id == user_id).first()
        if record:
            record.resume_content = resume_text
            record.profile_data = profile
            record.template_id = request.template_id
        else:
            db.add(JobProfile(
                user_id=user_id,
                profile_data=profile,
                template_id=request.template_id,
                resume_content=resume_text,
            ))
        db.commit()

    return {"code": 200, "resume": resume_text}


@app.post("/ai/job/match", summary="匹配推荐岗位")
def match_job_recommendations(
        request: JobMatchRequest,
        http_request: Request,
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    ensure_chat_access(http_request, user_id)
    profile = request.profile.model_dump()
    jobs = match_jobs(profile, request.resume_content)
    return {"code": 200, "jobs": jobs, "source": "mock"}


# ==================== 推广拉新 / 钱包 ====================

class TrackDownloadRequest(BaseModel):
    ref: str = ""
    fingerprint: str = ""


class WithdrawSubmitRequest(BaseModel):
    paypal_email: str


@app.get("/ai/promo/config", summary="推广展示配置（公开）")
def promo_config(db: Session = Depends(get_db)):
    """返回前端展示所需的文案与开关，不含金额等敏感项。"""
    cfg = promo.get_config_map(db)
    return {
        "code": 200,
        "promo_enabled": promo._is_on(cfg.get("promo_enabled")),
        "input_promo_enabled": promo._is_on(cfg.get("input_promo_enabled")),
        "link_cache_days": promo._to_int(cfg.get("link_cache_days"), 30),
        "popup_intro": {"zh": cfg.get("popup_intro_zh", ""), "en": cfg.get("popup_intro_en", "")},
        "input_promo": {"zh": cfg.get("input_promo_zh", ""), "en": cfg.get("input_promo_en", "")},
        "banner_promo": {"zh": cfg.get("banner_promo_zh", ""), "en": cfg.get("banner_promo_en", "")},
    }


@app.get("/ai/promo/my-link", summary="获取我的专属推广链接")
def promo_my_link(
        db: Session = Depends(get_db),
        user_id: int = Depends(verify_token),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "用户不存在"})
    code = promo.get_or_create_referral_code(db, user)
    return {"code": 200, "referral_code": code, "link": promo.build_referral_link(db, code)}


@app.post("/ai/promo/track-download", summary="记录下载控件点击并给推广人发奖（公开）")
def promo_track_download(
        request: TrackDownloadRequest,
        http_request: Request,
        db: Session = Depends(get_db),
        user_id: Optional[int] = Depends(get_optional_user_id),
):
    ip = promo.client_ip(http_request)
    ref = (request.ref or "").strip()
    fingerprint = (request.fingerprint or "").strip()

    # 点击埋点（总点击量，可重复）——失败不影响发奖主流程
    try:
        promo.record_download_click(db, ip=ip, fingerprint=fingerprint, ref_code=ref)
    except Exception as e:
        logger.warning(f"[埋点] 下载点击记录失败：{e}")

    result = promo.track_download(
        db,
        ref_code=ref,
        fingerprint=fingerprint,
        ip=ip,
        visitor_user_id=user_id,
    )
    return {"code": 200, **result.to_dict()}


@app.get("/ai/promo/wallet", summary="我的钱包（余额 + 提现记录）")
def promo_wallet(
        db: Session = Depends(get_db),
        user_id: int = Depends(verify_token),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "用户不存在"})
    records = db.query(WithdrawRequest).filter(
        WithdrawRequest.user_id == user_id
    ).order_by(WithdrawRequest.created_at.desc()).all()
    return {
        "code": 200,
        "balance": round(user.balance_usd or 0.0, 2),
        "referral_count": user.referral_count or 0,
        "records": [
            {
                "id": r.id,
                "amount": round(r.amount, 2),
                "paypal_email": r.paypal_email,
                "status": r.status,
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            }
            for r in records
        ],
    }


@app.post("/ai/promo/withdraw", summary="提交提现申请（提现全部余额）")
def promo_withdraw(
        request: WithdrawSubmitRequest,
        db: Session = Depends(get_db),
        user_id: int = Depends(verify_token),
):
    email = (request.paypal_email or "").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail={"code": 400, "msg": "请输入有效的 PayPal 邮箱"})

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "用户不存在"})

    balance = round(user.balance_usd or 0.0, 2)
    if balance <= 0:
        raise HTTPException(status_code=400, detail={"code": 400, "msg": "余额不足，无法提现"})

    # 提现全部余额：建 pending 申请并从余额扣除转入待审核
    # 后台驳回时会自动把 amount 退回 balance（见 /admin/api/withdraws/{id}/reject）
    record = WithdrawRequest(user_id=user_id, amount=balance, paypal_email=email, status="pending")
    db.add(record)
    user.balance_usd = 0.0
    db.commit()
    return {"code": 200, "msg": "提现申请已提交，等待人工审核", "amount": balance}


# ==================== 后台管理 /admin ====================

class AdminLoginForm(BaseModel):
    username: str
    password: str


class AdminConfigUpdate(BaseModel):
    items: dict  # {key: value, ...}


class AdminBalanceAdjust(BaseModel):
    amount: float          # 正数加钱，负数扣钱
    reason: str = ""


@app.get("/admin", summary="后台管理页", description="返回后台单页，数据靠 /admin/api/* 异步拉取")
def admin_page(request: Request):
    return templates.TemplateResponse(name="admin.html", request=request)


@app.post("/admin/api/login", summary="后台登录")
def admin_login(form: AdminLoginForm):
    # 密码留空则一律拒绝，避免默认空密码被登入
    if not config.ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail={"code": 403, "msg": "后台未设置管理员密码，请在 .env 配置 ADMIN_PASSWORD"})
    if form.username == config.ADMIN_USERNAME and form.password == config.ADMIN_PASSWORD:
        return {"code": 200, "token": create_admin_token()}
    raise HTTPException(status_code=401, detail={"code": 401, "msg": "账号或密码错误"})


@app.get("/admin/api/stats", summary="后台数据看板")
def admin_stats(db: Session = Depends(get_db), _: bool = Depends(verify_admin_token)):
    return {"code": 200, **promo.get_admin_stats(db)}


@app.get("/admin/api/users", summary="用户列表")
def admin_users(
        q: str = Query("", description="按用户名搜索"),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        db: Session = Depends(get_db),
        _: bool = Depends(verify_admin_token),
):
    query = db.query(User)
    if q.strip():
        query = query.filter(User.username.like(f"%{q.strip()}%"))
    total = query.count()
    rows = query.order_by(User.id.desc()).offset(offset).limit(limit).all()
    return {
        "code": 200,
        "total": total,
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "balance": round(u.balance_usd or 0.0, 2),
                "referral_count": u.referral_count or 0,
                "referral_code": u.referral_code or "",
                "membership_expire_at": u.membership_expire_at.strftime("%Y-%m-%d") if u.membership_expire_at else "",
                "register_time": u.register_time.strftime("%Y-%m-%d %H:%M") if u.register_time else "",
            }
            for u in rows
        ],
    }


@app.post("/admin/api/users/{uid}/balance", summary="手动调整用户余额")
def admin_adjust_balance(
        uid: int,
        body: AdminBalanceAdjust,
        db: Session = Depends(get_db),
        _: bool = Depends(verify_admin_token),
):
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "用户不存在"})
    new_balance = round((user.balance_usd or 0.0) + body.amount, 2)
    if new_balance < 0:
        raise HTTPException(status_code=400, detail={"code": 400, "msg": "调整后余额不能为负"})
    user.balance_usd = new_balance
    db.commit()
    return {"code": 200, "msg": "已调整", "balance": new_balance}


@app.get("/admin/api/withdraws", summary="提现申请列表")
def admin_withdraws(
        status_filter: str = Query("", alias="status", description="pending/paid/rejected，空=全部"),
        db: Session = Depends(get_db),
        _: bool = Depends(verify_admin_token),
):
    query = db.query(WithdrawRequest)
    if status_filter in ("pending", "paid", "rejected"):
        query = query.filter(WithdrawRequest.status == status_filter)
    rows = query.order_by(WithdrawRequest.created_at.desc()).all()
    # 附带用户名
    user_map = {u.id: u.username for u in db.query(User).all()}
    return {
        "code": 200,
        "withdraws": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "username": user_map.get(r.user_id, f"#{r.user_id}"),
                "amount": round(r.amount, 2),
                "paypal_email": r.paypal_email,
                "status": r.status,
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
                "reviewed_at": r.reviewed_at.strftime("%Y-%m-%d %H:%M") if r.reviewed_at else "",
            }
            for r in rows
        ],
    }


@app.post("/admin/api/withdraws/{wid}/approve", summary="通过提现")
def admin_withdraw_approve(
        wid: int,
        db: Session = Depends(get_db),
        _: bool = Depends(verify_admin_token),
):
    record = db.query(WithdrawRequest).filter(WithdrawRequest.id == wid).first()
    if not record:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "提现记录不存在"})
    if record.status != "pending":
        raise HTTPException(status_code=400, detail={"code": 400, "msg": f"该申请已是 {record.status}，无法重复处理"})
    record.status = "paid"
    record.reviewed_at = datetime.now()
    db.commit()
    return {"code": 200, "msg": "已标记为已打款"}


@app.post("/admin/api/withdraws/{wid}/reject", summary="驳回提现（余额退回用户）")
def admin_withdraw_reject(
        wid: int,
        db: Session = Depends(get_db),
        _: bool = Depends(verify_admin_token),
):
    record = db.query(WithdrawRequest).filter(WithdrawRequest.id == wid).first()
    if not record:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "提现记录不存在"})
    if record.status != "pending":
        raise HTTPException(status_code=400, detail={"code": 400, "msg": f"该申请已是 {record.status}，无法重复处理"})
    record.status = "rejected"
    record.reviewed_at = datetime.now()
    # 把冻结的金额退回用户余额
    user = db.query(User).filter(User.id == record.user_id).first()
    if user:
        user.balance_usd = round((user.balance_usd or 0.0) + record.amount, 2)
    db.commit()
    return {"code": 200, "msg": "已驳回，金额已退回用户余额"}


@app.get("/admin/api/config", summary="获取全部推广配置")
def admin_get_config(db: Session = Depends(get_db), _: bool = Depends(verify_admin_token)):
    return {"code": 200, "config": promo.get_config_map(db)}


@app.post("/admin/api/config", summary="批量更新推广配置")
def admin_set_config(
        body: AdminConfigUpdate,
        db: Session = Depends(get_db),
        _: bool = Depends(verify_admin_token),
):
    allowed = set(PROMO_CONFIG_DEFAULTS.keys())
    updated = []
    for key, value in body.items.items():
        if key not in allowed:
            continue  # 只允许改已知配置项，忽略未知 key
        row = db.query(PromoConfig).filter(PromoConfig.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(PromoConfig(key=key, value=str(value)))
        updated.append(key)
    db.commit()
    return {"code": 200, "msg": "已保存", "updated": updated}


# ------------------- 接口：登录 ------------------
class LoginForm(BaseModel):
    username: str
    password: str


@app.post('/login', summary='登录')
def login(
        form: LoginForm,
        db: Session = Depends(get_db),

):
    existing_user = db.query(User).filter(
        User.username == form.username,
    ).first()
    if existing_user and verify_password(form.password, existing_user.password):
        if needs_rehash(existing_user.password):
            existing_user.password = hash_password(form.password)
            db.commit()
        token: str = create_access_token({'user_id': existing_user.id})
        return {
            "code": 200,
            "msg": "登录成功",
            "token": token,
            "user_id": existing_user.id,
        }
    else:
        return {
            "code": 401,
            "msg": "用户名或密码错误"
        }


class RegisterForm(BaseModel):
    username: str
    password: str


@app.post('/register', summary='注册')
def register(
        form: RegisterForm,
        db: Session = Depends(get_db)
):
    existed_user = db.query(User).filter(
        User.username == form.username,
    ).first()
    if existed_user:
        return {'code': 401, "msg": "已存在用户名"}
    else:
        new_user = User(
            username=form.username,
            password=hash_password(form.password),
        )
        db.add(new_user)
        db.commit()  # <-- 关键！提交后才有ID
        db.refresh(new_user)  # <-- 刷新对象，加载数据库生成的ID
        return {
            "code": 200,
            "msg": "注册成功",
        }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1)
    # uvicorn main:app --host 0.0.0.0 --port 8000 --reload
