import base64
import os
import logging
from sqlite3 import Date
import time
from webbrowser import get
# 通过 pip install 'volcengine-python-sdk[ark]' 安装方舟SDK
from volcenginesdkarkruntime import Ark
# 导入所需的参数类型
from volcenginesdkarkruntime.types.content_generation.create_task_content_param import (
    CreateTaskContentTextParam,
    CreateTaskContentImageParam,
    CreateTaskContentImageDataParam,
)

# from volcenginesdkarkruntime.models import (
#     CreateTaskContentTextParam,
#     CreateTaskContentImageURLParam,
# )
from volcenginesdkarkruntime.types import shared
import requests


# 配置日志
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

# 请确保您已将 API Key 存储在环境变量 ARK_API_KEY 中
# 初始化Ark客户端，从环境变量中读取您的API Key
api_key = os.environ.get("ARK_API_KEY")
if not api_key:
    logging.error("Environment variable ARK_API_KEY is not set.")
    raise ValueError("Environment variable ARK_API_KEY is not set.")

client = Ark(
    # 此为默认路径，您可根据业务所在地域进行配置
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    # 从环境变量中获取您的 API Key。此为默认方式，您可根据需要进行修改
    api_key=api_key,
)


def get_image_base64(image_path) -> str | None:
    """将图片转换为base64格式，供视频生成使用"""
    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        base64_str = base64.b64encode(image_bytes).decode('utf-8')

        # 根据文件扩展名确定MIME类型
        ext = os.path.splitext(image_path)[1].lower()
        mime_type = 'jpeg' if ext in ['.jpg', '.jpeg'] else 'png'

        # image类型要小写
        return f"data:image/{mime_type};base64,{base64_str}"
    except FileNotFoundError:
        logging.error(f"Error: File not found at {image_path}")
        return None
    except Exception as e:
        logging.error(f"Error reading file: {e}")
        return None


def download_file(url: str, output_path: str, timeout: int = 300) -> bool:
    """
    下载文件到指定路径

    Args:
        url: 文件URL
        output_path: 输出路径
        timeout: 超时时间（秒）

    Returns:
        bool: 是否下载成功
    """
    try:
        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # 下载文件
        response = requests.get(url, stream=True, timeout=timeout)
        response.raise_for_status()

        # 写入文件
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        return True
    except Exception as e:
        logging.error(f"下载失败: {e}")
        return False


if __name__ == "__main__":
    print("----- create request -----")

    img_url = "https://ark-project.tos-cn-beijing.volces.com/doc_image/seepro_i2v.png"

    img_file_path = "/Users/klein/Downloads/seed.jpg"

    img_base64 = get_image_base64(img_file_path)
    if img_base64 is None:
        logging.error("Failed to read image file, exiting.")
        raise ValueError("Failed to read image file")
    # print(img_base64)
    prompt = '''
# 导演阐述

主题: 战争与生存的突然冲突，展现人类在自然与科技对抗中的脆弱性

风格: 现实主义 cinematic 风格，高对比度灯光，紧张快速的节奏

情感: 初始的宁静与后来的惊恐、混乱，形成强烈情感反差

核心意象: 月光下的火把队伍与突然的飞机袭击形成视觉和情感上的强烈对比

# 剧本

在宁静的月夜，一支队伍在山间举着火把蜿蜒前进，氛围神秘而坚定；突然，天空中传来飞机的轰鸣声，袭击瞬间发生，爆炸和混乱打破宁静，人们惊慌奔跑。

分镜序列与详细描述

分镜1: 时间: 0-3秒

镜头类型: 广角镜头，缓慢平移

描述: 月光洒在崎岖的山峦上，一支约20人的队伍举着火把，成纵队前进，火光照亮路径，阴影摇曳，环境宁静，强调自然与人类的和谐；摄影机从山腰俯视，捕捉整体场景。

分镜2: 时间: 3-6秒

镜头类型: 中景镜头，轻微手持抖动

描述: 聚焦队伍中的几个人物，面部特写显示坚定或疲惫的表情，火把火焰跳动，强调氛围的亲密感和紧张预兆；背景可见月光和山影，音效包括风声和轻微的脚步声。

分镜3: 时间: 6-9秒

镜头类型: 仰角镜头，快速变焦

描述: 天空中出现飞机的阴影，引擎轰鸣声突然响起，人们抬头望向天空，表情从困惑变为惊恐；镜头从地面向上拍摄，突出飞机的威胁性和天空的广阔。

分镜4: 时间: 9-12秒

镜头类型: 快速剪辑多角度，包括特写和广角

描述: 飞机投下炸弹或进行扫射，爆炸火光四溅，火把掉落，人们惊慌奔跑，混乱中烟雾弥漫；镜头切换频繁，强调动作和混乱，最终以一片火光和黑暗结束。

# 场景分解表

环境: 月夜山间，崎岖地形，月光照明

人物: 20人左右队伍，穿着朴素服装，举火把

道具: 火把、简单背包

特效元素: CGI飞机模型、爆炸火光、烟雾效果

音效元素: 风声、脚步声、飞机引擎声、爆炸声、尖叫声

# 技术与后期细节

摄影: 使用Arri Alexa相机，广角和中焦镜头，手持拍摄增加真实感，慢速平移开场，快速剪辑结尾

灯光: 自然月光模拟（冷色调），火把光（暖色调），高对比度设置，突出阴影和亮点

音效: 多层次音轨，包括环境音、突然的飞机声和爆炸声，音效同步时间点（如6秒飞机声出现）

特效: CGI飞机集成，爆炸使用粒子特效，后期颜色分级增强对比度和饱和度

后期: 快速剪辑节奏，音效混合以强调紧张感，最终输出为4K分辨率
'''

    create_result = client.content_generation.tasks.create(
        model="doubao-seedance-1-0-pro-250528",  # 模型 Model ID 已为您填入
        content=[
            CreateTaskContentTextParam(
                type="text",
                text=f"{prompt} --resolution 480p -ratio 16:9 --duration 12 --camerafixed false --watermark false"
            ),
            CreateTaskContentImageParam(
                type="image_url",
                image_url=CreateTaskContentImageDataParam(url=img_base64),
                # image_url=CreateTaskContentImageDataParam(url=img_url),
                role="first_frame"  # seedance-1-0-pro-250528 模型支持 first_frame, 不支持last_frame
            )
        ],
        # return_last_frame=True  # 是否返回视频最后一帧的图片URL，默认值为 False
    )
    print(create_result)

    # 轮询查询部分
    print("----- polling task status -----")
    task_id = create_result.id
    while True:
        get_result = client.content_generation.tasks.get(task_id=task_id)
        status = get_result.status
        if status == "succeeded":
            print("----- task succeeded -----")
            print(get_result)
            video_url = get_result.content.video_url
            # 使用当前时间戳作为文件名，避免重复
            download_dir = os.environ.get(
                "DOWNLOAD_DIR", os.path.expanduser("~/Downloads"))
            video_file_path = os.path.join(
                download_dir, f"video_{int(time.time())}.mp4")
            download_file(video_url, video_file_path)
            print(f"----- download video to {video_file_path} -----")
            break
        elif status == "failed":
            print("----- task failed -----")
            print(f"Error: {get_result.error}")
            break
        else:
            print(f"Current status: {status}, Retrying after 3 seconds...")
            time.sleep(3)

# 更多操作请参考下述网址
# 查询视频生成任务列表：https://www.volcengine.com/docs/82379/1521675
# 取消或删除视频生成任务：https://www.volcengine.com/docs/82379/1521720
