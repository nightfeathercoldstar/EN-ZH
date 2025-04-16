import re

def get_target_language():
    """
    获取用户输入的目标语言代码。
    """
    print("请输入目标语言代码（例如：en 表示英文，fr 表示法文，zh 表示中文）：")
    target_language = input().strip()
    return target_language

def get_pdf_path():
    """
    获取用户输入的pdf本地路径
    """
    print("请复制粘贴要翻译的pdf本地路径（例如F:\english-trans\pdf_store\test1.pdf）：")
    pdf_path = input().strip('"')

    # 定义正则表达式来匹配有效的文件路径
    # 假设路径必须以盘符开头，例如 F:\，并且可以包含文件夹和文件名
    pattern = re.compile(r'^[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+\.[a-zA-Z]{1,4}$')

    if not pattern.match(pdf_path):
        print("错误：输入的路径格式不正确。")
        return None

    # 将路径中的单反斜杠替换为双反斜杠
    pdf_path = pdf_path.replace("\\", "\\\\")
    return pdf_path