from datetime import date

from fastapi import HTTPException, Request, status

import config

# 每个 IP 一条记录：{ip: (当天日期, 已用次数)}
# 跨自然日会自动重置为 0。进程重启后清零（免登录体验，无需持久化）。
_ip_daily_usage: dict[str, tuple[str, int]] = {}


def _client_ip(request: Request) -> str:
    # 优先取反向代理透传的真实 IP（宝塔/Nginx 部署时常见）
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_anonymous_remaining(request: Request) -> int:
    """只读查询：当前 IP 今日还剩多少次免费体验（不消耗次数）。"""
    max_requests = config.ANONYMOUS_RATE_LIMIT_MAX
    today = date.today().isoformat()
    day, used = _ip_daily_usage.get(_client_ip(request), (today, 0))
    if day != today:
        used = 0
    return max(max_requests - used, 0)


def check_anonymous_rate_limit(request: Request) -> int:
    """校验并消耗一次免费体验次数，返回剩余次数；超限抛 429。"""
    client_ip = _client_ip(request)
    max_requests = config.ANONYMOUS_RATE_LIMIT_MAX
    today = date.today().isoformat()

    day, used = _ip_daily_usage.get(client_ip, (today, 0))
    if day != today:
        used = 0

    if used >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": 429,
                "msg": "未登录用户今日免费体验次数已用完，请注册或登录后继续使用",
            },
        )

    used += 1
    _ip_daily_usage[client_ip] = (today, used)
    return max(max_requests - used, 0)
