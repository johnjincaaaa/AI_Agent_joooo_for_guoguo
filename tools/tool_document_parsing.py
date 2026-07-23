from langchain.tools import tool
import os
from pathlib import Path

MAX_EXTRACT_CHARS = 15000


def _read_txt(file_path: str) -> str:
    for encoding in ("utf-8", "utf-8-sig", "gbk", "gb2312"):
        try:
            return Path(file_path).read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return Path(file_path).read_text(encoding="utf-8", errors="ignore")


def _read_pdf(file_path: str) -> str:
    from pypdf import PdfReader

    reader = PdfReader(file_path)
    parts = []
    for i, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        if text.strip():
            parts.append(f"--- 第{i}页 ---\n{text.strip()}")
    return "\n\n".join(parts)


def _read_docx(file_path: str) -> str:
    from docx import Document

    doc = Document(file_path)
    parts = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            parts.append(text)
    return "\n".join(parts)


def _extract_document_text(file_path: str) -> str:
    suffix = Path(file_path).suffix.lower()
    if suffix == ".txt":
        return _read_txt(file_path)
    if suffix == ".pdf":
        return _read_pdf(file_path)
    if suffix == ".docx":
        return _read_docx(file_path)
    if suffix == ".doc":
        return "暂不支持 .doc 格式，请将文件另存为 .docx 后重试"
    return f"不支持的文件格式：{suffix}"


@tool(
    description="""
    文档解析工具，读取 PDF、Word(docx)、TXT 文件并提取文本内容
    适用场景：总结文档、问答、提取关键信息
    参数 file_path：本地文档路径
    返回：文件基础信息 + 文本内容（过长时自动截断）
    """
)
def document_analyze(file_path: str) -> str:
    try:
        if not os.path.exists(file_path):
            return "错误：文档文件不存在"

        path = Path(file_path)
        file_size_kb = path.stat().st_size // 1024
        suffix = path.suffix.lower()

        content = _extract_document_text(file_path)
        if not content.strip():
            return f"文档 {path.name} 未提取到有效文本内容"

        truncated = len(content) > MAX_EXTRACT_CHARS
        if truncated:
            content = content[:MAX_EXTRACT_CHARS] + "\n\n...(内容过长，已截断)"

        return (
            f"===== 文档基础信息 =====\n"
            f"文件名：{path.name}\n"
            f"格式：{suffix.lstrip('.') or '未知'} | 大小：{file_size_kb}KB\n"
            f"是否截断：{'是' if truncated else '否'}\n\n"
            f"===== 文档内容 =====\n"
            f"{content}"
        )
    except Exception as e:
        return f"文档解析异常：{str(e)}"
