import pandas as pd
from openai import OpenAI
import os
import fitz  # PyMuPDF
import pdfplumber
from pdfinput import get_target_language,get_pdf_path
from pdfformulaget import extract_formulas_from_pdf, process_formula_images
from pdffindformula import extract_non_chinese_with_equal

# 设置代理
os.environ['http_proxy'] = '127.0.0.1:7890'
os.environ['https_proxy'] = '127.0.0.1:7890'

# 设置 LangChain 环境变量
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "LangchainDemo"
os.environ["LANGCHAIN_API_KEY"] = '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'

os.environ["OPENAI_API_BASE"] = "https://api.openai-proxy.org/v1"
os.environ["OPENAI_API_KEY"] = "sk-iz7CD1AUkrAUpSDHf02pvQTOeJRirQE0I10Y8IvshJp10NMX"

# 初始化 OpenAI 客户端
client = OpenAI(
    base_url=os.environ["OPENAI_API_BASE"],
    api_key=os.environ["OPENAI_API_KEY"],
)


# 处理 PDF 文件
def processpdf(pdf_path):
    doc = fitz.open(pdf_path)
    pdf = pdfplumber.open(pdf_path)
    text_content = []
    media_content = []

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pdf_page = pdf.pages[page_num]

        # 提取文本
        text = page.get_text()
        text_content.append(text)

        # 提取图片
        image_list = page.get_images(full=True)
        # 确保保存图片的目录存在
        output_dir = "result/img_result"
        os.makedirs(output_dir, exist_ok=True)
        for image_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            # 生成图片文件名
            image_filename = f"Image_{page_num + 1}-{image_index + 1}.{image_ext}"
            image_path = os.path.join(output_dir, image_filename)  # 完整的保存路径

            # 保存图片到指定目录
            with open(image_path, "wb") as img_file:
                img_file.write(image_bytes)
            media_content.append(f"Image {page_num + 1}-{image_index + 1}.{image_ext}")

    # 关闭 PDF 文件
    doc.close()
    pdf.close()

    return "\n".join(text_content), "\n".join(media_content)

def process_table(pdf_path):
    pdf = pdfplumber.open(pdf_path)
    media_content = []

    # 创建一个空的列表，用于存储所有页面的表格数据
    all_tables = []

    # 遍历PDF的每一页
    for page in pdf.pages:
        # 提取当前页面的表格
        table = page.extract_table()
        if table:
            # 将表格数据转换为DataFrame
            df = pd.DataFrame(table[1:], columns=table[0])  # 假设第一行是表头
            # 将当前页面的表格数据添加到列表中
            all_tables.append(df)

    # 关闭PDF文件
    pdf.close()

    # 如果有多个表格，可以将它们合并为一个DataFrame
    if all_tables:
        combined_df = pd.concat(all_tables, ignore_index=True)
        # 保存合并后的表格到Excel文件
        combined_df.to_excel("D:\\EN-ZH\\english-trans\\result\\table_result.xlsx", index=False)





# 主函数
def main(pdf_path, target_language="zh"):  # 默认目标语言为中文
    extract_formulas_from_pdf(pdf_path)
    text_content, media_content = processpdf(pdf_path)
    process_table(pdf_path)

    # 定义最大文本长度
    MAX_TEXT_LENGTH = 2000  # 根据实际API限制调整

    # 分割文本内容
    def split_text(text, max_length):
        return [text[i:i + max_length] for i in range(0, len(text), max_length)]

    # 将文本内容分割成多个部分
    text_parts = split_text(text_content, MAX_TEXT_LENGTH)

    # 初始化翻译后的文本
    translated_text = ""

    # 对每个部分进行翻译
    for part in text_parts:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": f"你是一个乐于助人的助手。将以下内容翻译成{target_language}。"},
                {"role": "user", "content": part}
            ]
        )
        translated_part = response.choices[0].message.content
        translated_text += translated_part  # 将翻译结果拼接起来

    # results = extract_non_chinese_with_equal(translated_text)
    # print(results)

    # 处理 formula_img 文件夹中的图片并提取公式
    formula_img_folder = "temp_images"
    formula_content1 = process_formula_images(formula_img_folder)
    formula_content1 = [
        item.strip("对不起，我无法提取图片中的数学公式内容。").replace("\n", "")
        for item in formula_content1 if item
    ]
    # formula_content1提取有瑕疵，得改
    # print(formula_content1)

    translated_text = extract_non_chinese_with_equal(translated_text, formula_content1)

    # 将提取的公式内容写入 result.md 文件
    with open("result\\formula_result.md", "w", encoding="utf-8") as f:
        f.write("\n".join(formula_content1))

    # 保存结果
    with open("result\\translated_result.md", "w", encoding="utf-8") as f:
        f.write(translated_text)

    print("处理完成！")


# 接口函数
def run_translation():
    """
    获取用户输入的目标语言并调用 main 函数。
    """
    pdf_path = r"D:\EN-ZH\english-trans\pdf_store\test1.pdf"  # 假设 PDF 文件路径固定，也可以通过 input 获取
    pdf_path = get_pdf_path()
    target_language = get_target_language()
    main(pdf_path, target_language)

# 调用接口函数
if __name__ == "__main__":
    run_translation()


