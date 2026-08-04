"""Meta Conversions API（服务端事件回传）。

职责：用某条像素凭证的 pixel_id + capi_token，把转化事件（PageView / 下载转化）
从服务器直接回传给 Meta，实现不依赖浏览器的转化追踪。

设计原则：
  - 回传是「尽力而为」：短超时，任何异常都吞掉只 log，绝不影响访客主流程
  - 前提：运行服务器能访问 graph.facebook.com（本项目部署在海外，可直连）
  - event_id 由调用方生成并同时给前端 fbq，供 Meta 自动去重（前端+CAPI 双发不重复计）
"""
import logging
import time

import requests

logger = logging.getLogger(__name__)

GRAPH_VERSION = "v21.0"
GRAPH_BASE = "https://graph.facebook.com"
TIMEOUT = 5  # 秒，短超时避免拖慢主流程


def send_event(pixel_id: str, token: str, event_name: str, event_id: str,
               client_ip: str = "", user_agent: str = "",
               event_source_url: str = "", test_event_code: str = "") -> dict:
    """向 Meta 回传一个转化事件。

    返回 {"ok": bool, "received": int} 或 {"ok": False, "error": str}。
    失败不抛异常（调用方无需 try），只记 log。
    """
    if not pixel_id or not token:
        return {"ok": False, "error": "missing pixel_id or token"}

    user_data = {}
    if client_ip:
        user_data["client_ip_address"] = client_ip
    if user_agent:
        user_data["client_user_agent"] = user_agent

    event = {
        "event_name": event_name or "PageView",
        "event_time": int(time.time()),
        "action_source": "website",
        "user_data": user_data,
    }
    if event_id:
        event["event_id"] = event_id
    if event_source_url:
        event["event_source_url"] = event_source_url

    payload = {"data": [event]}
    if test_event_code:
        payload["test_event_code"] = test_event_code

    url = f"{GRAPH_BASE}/{GRAPH_VERSION}/{pixel_id}/events"
    try:
        resp = requests.post(
            url,
            params={"access_token": token},
            json=payload,
            timeout=TIMEOUT,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code == 200:
            return {"ok": True, "received": data.get("events_received", 0)}
        # Meta 返回了错误（token 失效、权限不足等）
        err = (data.get("error") or {}).get("message", f"HTTP {resp.status_code}")
        logger.warning(f"[CAPI] 回传失败 pixel={pixel_id} event={event_name}: {err}")
        return {"ok": False, "error": err}
    except Exception as e:
        # 网络不通 / 超时 —— 不影响主流程
        logger.warning(f"[CAPI] 回传异常 pixel={pixel_id} event={event_name}: {e}")
        return {"ok": False, "error": str(e)}
