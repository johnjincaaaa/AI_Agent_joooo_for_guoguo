"""
技能注册表：集中管理可被前端选择的 LLM 工具链（不含智能联网）。
新增技能时在此追加条目即可。
"""
from typing import List
import logging

logger = logging.getLogger(__name__)

# 技能展示目录（与工具加载解耦，确保前端始终能拿到完整列表）
SKILL_CATALOG = [
    {
        "id": "image_parsing",
        "name": "图片解析",
        "description": "分析图片内容、尺寸、格式等属性",
        "icon": "image",
    },
    {
        "id": "document_parsing",
        "name": "文档解析",
        "description": "读取 PDF、Word、TXT 文件内容",
        "icon": "document",
    },
]

SKILL_TOOLS = {}

try:
    from .tool_Image_parsing import image_analyze
    SKILL_TOOLS["image_parsing"] = [image_analyze]
except Exception as e:
    logger.warning("图片解析工具加载失败: %s", e)

try:
    from .tool_document_parsing import document_analyze
    SKILL_TOOLS["document_parsing"] = [document_analyze]
except Exception as e:
    logger.warning("文档解析工具加载失败: %s", e)


def get_skill_catalog():
    """返回前端展示用的技能列表（不含工具对象）。"""
    return list(SKILL_CATALOG)


def resolve_tools(enabled_skill_ids: List[str]):
    """根据前端选中的技能 id 解析 LangChain 工具列表。"""
    tools = []
    seen = set()
    for skill_id in enabled_skill_ids:
        for tool in SKILL_TOOLS.get(skill_id, []):
            tool_name = getattr(tool, "name", None) or str(tool)
            if tool_name not in seen:
                seen.add(tool_name)
                tools.append(tool)
    return tools
