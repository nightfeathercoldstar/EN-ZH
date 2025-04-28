import re
import os

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
    print("请复制粘贴要翻译的pdf本地路径（例如F:\\english-trans\\pdf_store\\test1.pdf）：")
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

def validate_pdf_path(pdf_path):
    """
    验证PDF路径是否有效
    
    参数:
        pdf_path (str): 待验证的PDF文件路径
        
    返回:
        dict: 包含验证结果的字典，含有以下键:
            - valid (bool): 路径是否有效
            - message (str, 可选): 如果无效，包含错误信息
            - filename (str, 可选): 如果有效，包含文件名
    """
    # 移除可能的引号
    pdf_path = pdf_path.strip('"')
    
    # 定义正则表达式来匹配有效的文件路径
    pattern = re.compile(r'^[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+\.pdf$', re.IGNORECASE)
    
    if not pattern.match(pdf_path):
        return {
            "valid": False,
            "message": "路径格式不正确，请确保是有效的PDF文件路径"
        }
    
    # 检查文件是否存在
    if not os.path.exists(pdf_path):
        return {
            "valid": False,
            "message": "文件不存在"
        }
    
    # 检查文件扩展名
    if not pdf_path.lower().endswith('.pdf'):
        return {
            "valid": False,
            "message": "文件不是PDF格式"
        }
    
    # 获取文件名
    filename = os.path.basename(pdf_path)
    
    return {
        "valid": True,
        "filename": filename
    }