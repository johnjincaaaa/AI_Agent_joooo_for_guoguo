from langchain.tools import tool
from urllib.parse import quote
import requests
from bs4 import BeautifulSoup

# 全局请求头（模拟浏览器，防反爬）
HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Pragma": "no-cache",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "sec-ch-ua": "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\""
}

# 必应Cookie（维持登录态，提升搜索稳定性）
COOKIES = {
    "SRCHD": "AF=CHROMN",
    "SRCHUID": "V=2&GUID=CFF6DDBD3FEE43F692E2FDC1467D42FB&dmnchg=1",
    "MUID": "0233976C68D769E90E7B8122698D6834",
    "_EDGE_S": "SID=0D5F4B787CE363A73BE35C177DCD62E7&ui=zh-cn",
    "SRCHHPGUSR": "SRCHLANG=zh-Hans&PV=19.0.0&PREFCOL=1",
    "_SS": "SID=0D5F4B787CE363A73BE35C177DCD62E7&R=11085"
}


@tool(
    description="""
    实时联网搜索工具，仅在需要最新/实时/今日数据时调用
    适用场景：新闻、价格、政策、实时信息、未知知识
    参数 keyword：搜索关键词，必须简短精准，不要长句子
    返回：多条搜索结果（标题+摘要+来源链接）文本，供LLM参考
    """
)
def online(keyword: str) -> str:
    """bing全网搜索，返回结构化搜索结果摘要（纯接口请求版）"""
    try:
        # 构造搜索URL
        q = quote(keyword)
        search_url = f'https://cn.bing.com/search?q={q}'

        # 发送接口请求
        response = requests.get(
            url=search_url,
            headers=HEADERS,
            cookies=COOKIES,
            timeout=10
        )
        response.raise_for_status()  # 抛出HTTP异常

        # 解析HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        res_list = []

        # 提取必应搜索结果（前10条）
        items = soup.select('li.b_algo')[:10]
        for idx, item in enumerate(items, 1):
            try:
                # 提取标题+链接
                title_elem = item.select_one('h2 a')
                title = title_elem.get_text(strip=True)
                link = title_elem.get('href', '')

                # 提取摘要
                summary_elem = item.select_one('div.b_caption')
                summary = summary_elem.get_text(strip=True) if summary_elem else "无摘要"

                res_list.append(f"【{idx}】标题：{title}\n摘要：{summary}\n来源：{link}\n")
            except Exception:
                continue

        if not res_list:
            return "未检索到相关搜索结果"
        return "\n=====搜索结果=====\n" + "".join(res_list)

    except Exception as e:
        return f"联网搜索异常：{str(e)}"


@tool(
    description="""
    网页深度精读工具，传入具体网页URL，获取页面完整正文内容
    适用场景：需要详细阅读新闻全文、文章详情、文档内容时调用
    参数 url：需要精读的网页完整链接（https/https开头）
    返回：页面纯净正文文本，供LLM详细分析
    """
)
def online_intensive(url: str) -> str:
    """深度爬取指定URL的网页纯净正文（纯接口请求版）"""
    try:
        # 发送请求
        response = requests.get(
            url=url,
            headers=HEADERS,
            timeout=15
        )
        response.raise_for_status()
        # 自动处理编码
        response.encoding = response.apparent_encoding

        # 解析HTML
        soup = BeautifulSoup(response.text, 'html.parser')

        # 提取标题+正文
        title = soup.title.get_text(strip=True) if soup.title else "无标题"
        # 提取页面所有纯净文本
        content = soup.body.get_text(strip=True) if soup.body else "无正文内容"

        # 控制正文长度，避免LLM超限
        if len(content) > 8000:
            content = content[:8000] + "……（内容已截断）"

        return f"=====网页精读结果=====\n标题：{title}\n链接：{url}\n正文：\n{content}"

    except Exception as e:
        return f"网页精读异常：{str(e)}"


# 测试运行
if __name__ == "__main__":
    # 测试搜索
    print(online.invoke('今日新闻'))

    # 测试网页精读
    # print(online_intensive("https://www.baidu.com"))