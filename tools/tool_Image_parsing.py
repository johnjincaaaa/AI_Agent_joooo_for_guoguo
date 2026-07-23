from langchain.tools import tool
from PIL import Image
import os
import base64
from dashscope import MultiModalConversation
import config


@tool(
    description="""
    图片解析工具，分析用户上传的图片信息
    提取：图片格式、尺寸、颜色模式、主色调、文件大小
    识别：图片内容（人物/动物/场景/文字/物体等）
    参数：image_path 本地图片路径
    返回：结构化图片信息 + 内容描述
    """
)
def image_analyze(image_path: str) -> str:
    """通义千问qwen3.7-plus 图片解析+基础信息提取"""
    try:
        # 1. 校验图片
        if not os.path.exists(image_path):
            return "错误：图片文件不存在"

        # 2. 提取图片基础参数（无第三方依赖，纯PIL）
        img = Image.open(image_path)
        width, height = img.size
        img_format = img.format
        mode = img.mode
        channels = len(mode)
        has_alpha = img.mode in ("RGBA", "LA")
        file_size = os.path.getsize(image_path) // 1024

        # 主色调提取
        small_img = img.copy().resize((1, 1))
        main_color = small_img.getpixel((0, 0))
        color_hex = "#{:02x}{:02x}{:02x}".format(*main_color[:3])

        # 3. 图片转base64（通义千问要求）
        with open(image_path, "rb") as f:
            img_base64 = base64.b64encode(f.read()).decode("utf-8")

        # 4. 调用通义千问 qwen3.7-plus 多模态理解
        response = MultiModalConversation.call(
            model=config.MODEL,  # 复用你的 qwen3.7-plus
            api_key=config.DASHSCOPE_API_KEY,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"image": f"data:image/jpeg;base64,{img_base64}"},
                        {"text": "详细描述这张图片：场景、物体、人物、文字、氛围"}
                    ]
                }
            ]
        )

        # 5. 解析AI返回结果
        if response.status_code == 200:
            content = response.output.choices[0].message.content[0]["text"]
        else:
            content = f"图片识别失败：{response.code}"

        # 6. 拼接最终结果（LLM友好格式）
        result = (
            f"===== 图片基础信息 =====\n"
            f"格式：{img_format} | 尺寸：{width}x{height}\n"
            f"模式：{mode}({channels}通道) | 透明：{'是' if has_alpha else '否'}\n"
            f"大小：{file_size}KB | 主色调：{color_hex} {main_color[:3]}\n\n"
            f"===== 图片内容识别 =====\n"
            f"{content}"
        )
        return result

    except Exception as e:
        return f"图片解析异常：{str(e)}"