import os
from pdf2image import convert_from_path
import base64
from langchain.chat_models import ChatOpenAI
import os

# 设置代理
os.environ['http_proxy'] = '127.0.0.1:7890'
os.environ['https_proxy'] = '127.0.0.1:7890'

# 设置 LangChain 环境变量
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "LangchainDemo"
os.environ["LANGCHAIN_API_KEY"] = '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'

os.environ["OPENAI_API_BASE"] = "https://api.openai-proxy.org/v1"
os.environ["OPENAI_API_KEY"] = "sk-iz7CD1AUkrAUpSDHf02pvQTOeJRirQE0I10Y8IvshJp10NMX"

def extract_formulas_from_pdf(pdf_path):
    """
    从 PDF 文件中提取公式
    """
    # 实例化 ChatOpenAI 模型
    llm = ChatOpenAI(
        model="gpt-4-vision-preview",  # 使用支持图片识别的模型
        temperature=0.7,  # 设置温度参数
        max_tokens=150,  # 设置最大生成令牌数
        timeout=10,  # 设置超时时间
        max_retries=3,  # 设置最大重试次数
    )


    # 确保临时图片目录存在
    temp_image_dir = "temp_images"
    os.makedirs(temp_image_dir, exist_ok=True)

    # 将 PDF 转换为图片
    poppler_path = r"D:\poppler\poppler-24.08.0\Library\bin"  # 替换为你的 poppler 路径
    images = convert_from_path(pdf_path, poppler_path=poppler_path)

    formula_content = []  # 用于存储识别到的公式内容

    for page_num, image in enumerate(images):
        # 保存每页图片到临时目录
        image_path = os.path.join(temp_image_dir, f"page_{page_num + 1}.png")
        image.save(image_path, "PNG")

        try:
            # 打开图片并转换为 base64 编码
            with open(image_path, "rb") as image_file:
                encoded_image = base64.b64encode(image_file.read()).decode("utf-8")

            # 构造消息
            messages = [
                {
                    "role": "system",
                    "content": "你是一个专业的数学公式识别助手。只需要公式不需要表格，去掉所有的换行符，同时在每个公式前后加上$,每个公式单独成行"
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请识别以下图片中的公式内容："},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded_image}"}}
                    ]
                }
            ]

            # 调用大模型进行公式识别
            response = llm.invoke(messages)

            # 提取公式内容
            formula_text = response.content.strip()
            formula_content.append(formula_text)

        except Exception as e:
            print(f"处理图片 {image_path} 时出错: {e}")

    # 清理临时图片目录
    for file_name in os.listdir(temp_image_dir):
        os.remove(os.path.join(temp_image_dir, file_name))
    os.rmdir(temp_image_dir)

    return formula_content

