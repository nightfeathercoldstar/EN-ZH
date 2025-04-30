import re

def extract_non_chinese_with_equal(text, new_formulas):
    # 定义正则表达式模式，匹配非中文字符且包含等号的部分
    pattern = r'[^\u4e00-\u9fff，。：]+?(?=\s*[=])[^\u4e00-\u9fff，。：]*'

    # 用于存储包含 "=" 的部分
    results = []
    formula_index = 0
    last_end = 0
    new_text = ""

    # 使用 re.finditer 遍历所有匹配项
    for match in re.finditer(pattern, text):
        if formula_index >= len(new_formulas):
            break
            
        matched_text = match.group().strip()
        if '=' in matched_text:
            results.append(matched_text)
            # 构建新文本，保持原文中未匹配的部分不变
            new_text += text[last_end:match.start()] + new_formulas[formula_index]
            last_end = match.end()
            formula_index += 1

    # 添加剩余的文本
    new_text += text[last_end:]

    return results,new_text


# text = "这是一个测试字符串。1 + 2 = 3。另一个公式是 x = y + z。还有中文。"
# new_formulas = ["$1 + 2 = 3$", "$x = y + z$"]
# results, updated_text = extract_non_chinese_with_equal(text, new_formulas)
# print("找到的公式:", results)
# print("更新后的文本:", updated_text)