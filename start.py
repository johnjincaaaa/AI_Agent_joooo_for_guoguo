# -*- coding: utf-8 -*-
"""
有料 AI 一键启动脚本（跨编码安全，逻辑集中在此，start.bat 仅做包装）。

流程：
  1. 首次运行若无 .env，则从 .env.example 复制并用记事本打开，提示填写 API Key
  2. 无虚拟环境则创建 .venv
  3. 依赖未装则安装（用标记文件避免重复安装）
  4. 启动 uvicorn，并在几秒后自动打开浏览器
"""
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

VENV_DIR = os.path.join(ROOT, ".venv")
DEPS_MARKER = os.path.join(VENV_DIR, ".deps_installed")
URL = "http://127.0.0.1:8000/chat"

IS_WIN = os.name == "nt"


def _p(msg=""):
    """安全打印，避免个别终端编码异常中断脚本。"""
    try:
        print(msg)
    except Exception:
        print(msg.encode("utf-8", "replace").decode("ascii", "replace"))


def venv_python():
    if IS_WIN:
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def ensure_env_file():
    """首次运行准备 .env；返回 True 表示需要用户先填写、暂不启动。"""
    if os.path.exists(os.path.join(ROOT, ".env")):
        return False
    example = os.path.join(ROOT, ".env.example")
    if not os.path.exists(example):
        _p("[警告] 未找到 .env.example，跳过生成 .env。")
        return False
    _p("[提示] 未找到 .env 配置文件，正在从模板生成...")
    shutil.copyfile(example, os.path.join(ROOT, ".env"))
    _p("[完成] 已生成 .env。")
    _p("")
    _p("  请在打开的记事本中填入你的 AI 大模型 API Key，保存后重新运行本程序。")
    _p("  不知道怎么填？启动后点击网页右上角「接入教程」。")
    _p("")
    if IS_WIN:
        try:
            subprocess.Popen(["notepad", os.path.join(ROOT, ".env")])
        except Exception:
            pass
    return True


def ensure_venv():
    if os.path.exists(venv_python()):
        return
    _p("[步骤 1/3] 首次运行，正在创建虚拟环境...")
    subprocess.check_call([sys.executable, "-m", "venv", VENV_DIR])


def ensure_deps():
    if os.path.exists(DEPS_MARKER):
        _p("[步骤 2/3] 依赖已安装，跳过。")
        return
    _p("[步骤 2/3] 正在安装依赖，第一次会稍慢，请耐心等待...")
    py = venv_python()
    subprocess.call([py, "-m", "pip", "install", "--upgrade", "pip"])
    ret = subprocess.call([py, "-m", "pip", "install", "-r", "requirements.txt"])
    if ret != 0:
        _p("")
        _p("[错误] 依赖安装失败，请检查网络后重试。")
        _p("可尝试使用国内镜像：")
        _p("  .venv\\Scripts\\python -m pip install -r requirements.txt "
           "-i https://pypi.tuna.tsinghua.edu.cn/simple")
        sys.exit(1)
    with open(DEPS_MARKER, "w") as f:
        f.write("installed")


def open_browser_later():
    time.sleep(4)
    try:
        webbrowser.open(URL)
    except Exception:
        pass


def run_server():
    _p("[步骤 3/3] 正在启动服务...")
    _p("")
    _p("  服务地址： " + URL)
    _p("  关闭本窗口即可停止服务。")
    _p("")
    threading.Thread(target=open_browser_later, daemon=True).start()
    py = venv_python()
    # 用虚拟环境的 python 运行 uvicorn，阻塞直到用户关闭窗口
    try:
        subprocess.call([py, "-m", "uvicorn", "main:app",
                         "--host", "127.0.0.1", "--port", "8000"])
    except KeyboardInterrupt:
        pass


def main():
    _p("============================================================")
    _p("                 有料 AI  一键启动")
    _p("============================================================")
    _p("")
    if ensure_env_file():
        return
    ensure_venv()
    ensure_deps()
    run_server()


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        _p("[错误] 命令执行失败：%s" % e)
        sys.exit(1)
