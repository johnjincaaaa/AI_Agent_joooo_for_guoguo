import os

from dotenv import load_dotenv

load_dotenv()

# ===================== JWT =====================
SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ===================== AI =====================
# 通用大模型配置（OpenAI 兼容协议）。
# 支持任何兼容 OpenAI 接口的服务：DeepSeek、阿里云百炼(通义)、Kimi、本地 Ollama 等，
# 只需在 .env 中填写对应的 LLM_BASE_URL / LLM_MODEL / LLM_API_KEY。
SYSTEM_PROMPT = "你是一个乐于助人的助手，全程中文回答"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")

# 新版中性变量名；为兼容旧 .env，仍回退读取 DASHSCOPE_* / MODEL。
MODEL = os.getenv("LLM_MODEL") or os.getenv("MODEL", "deepseek-chat")
LLM_MODEL = MODEL
LLM_BASE_URL = (
    os.getenv("LLM_BASE_URL")
    or os.getenv("DASHSCOPE_URL", "https://api.deepseek.com/v1")
)
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("DASHSCOPE_API_KEY", "")

# 兼容旧代码引用的别名
DASHSCOPE_URL = LLM_BASE_URL
DASHSCOPE_API_KEY = LLM_API_KEY

# ===================== 未登录限流 =====================
# 每个 IP 每天最多免费体验多少次（跨自然日自动重置）
ANONYMOUS_RATE_LIMIT_MAX = int(os.getenv("ANONYMOUS_RATE_LIMIT_MAX", "10"))

# ===================== tools =====================
TOOL_LIST = []

# ===================== 数据库 =====================
# 默认使用 SQLite，开箱即用、无需安装数据库服务。
# 如需 MySQL，可在 .env 中设置：
#   SQLALCHEMY_DATABASE_URL=mysql+pymysql://user:pass@host:3306/db
SQLALCHEMY_DATABASE_URL = os.getenv(
    "SQLALCHEMY_DATABASE_URL",
    "sqlite:///./app.db",
)
