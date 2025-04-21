# PDF 翻译服务 API

这是一个基于 FastAPI 开发的 PDF 文档翻译服务，支持 PDF 文件上传、翻译处理和结果获取。

## 功能特点

- 支持 PDF 文件上传
- 支持多语言翻译（默认中文）
- 提取并翻译 PDF 中的文本内容
- 提取并处理 PDF 中的表格
- 提取并识别 PDF 中的数学公式
- 提取 PDF 中的图片
- 提供多种格式的翻译结果下载

## 系统要求

- Python 3.8+
- 相关依赖库（见 requirements.txt）
- Poppler（用于 PDF 处理）

## 安装与配置

1. 安装所需的 Python 库：

```bash
pip install -r requirements.txt
```

2. 确保已安装 Poppler 并在环境变量中配置好路径或在代码中指定 Poppler 路径。

3. 配置 OpenAI API 密钥或其他必要的环境变量。

## 启动服务

```bash
python interface.py
```

服务将在 http://localhost:8000 启动。

## API 接口说明

### 1. 获取 API 状态

**请求**：

```
GET /
```

**响应**：

```json
{
  "message": "PDF Translation API is running",
  "version": "1.0"
}
```

### 2. 上传 PDF 文件

**请求**：

```
POST /upload-pdf/
Content-Type: multipart/form-data
```

**表单参数**：

- `pdf_file`: PDF 文件

**响应**：

```json
{
  "filename": "example.pdf",
  "size": 123456,
  "path": "pdf_store/example.pdf"
}
```

### 3. 翻译 PDF 文件

**请求**：

```
POST /translate-pdf/
Content-Type: multipart/form-data
```

**表单参数**：

- `file_path`: PDF 文件路径
- `target_language`: 目标语言代码（如"en"表示英文，"zh"表示中文）

**响应**：

```json
{
  "status": "processing",
  "message": "PDF处理已开始，请稍后查询结果",
  "results": {
    "text": "/result/translated_result.md",
    "formulas": "/result/formula_result.md",
    "table": "/result/table_result.xlsx",
    "images_dir": "/result/img_result"
  }
}
```

### 4. 获取 PDF 文件列表

**请求**：

```
GET /pdf-list/
```

**响应**：

```json
[
  {
    "filename": "example1.pdf",
    "size": 123456,
    "path": "pdf_store/example1.pdf"
  },
  {
    "filename": "example2.pdf",
    "size": 654321,
    "path": "pdf_store/example2.pdf"
  }
]
```

### 5. 获取处理结果状态

**请求**：

```
GET /result-status/{filename}
```

**响应**：

```json
{
  "status": "completed",
  "results": {
    "text": "/result/translated_result.md",
    "formulas": "/result/formula_result.md",
    "table": "/result/table_result.xlsx",
    "images": ["Image_1-1.png", "Image_2-1.png"]
  }
}
```

### 6. 下载处理结果

**请求**：

```
GET /download-results/{filename}
```

**响应**：
一个包含所有结果的 ZIP 文件。

### 7. 获取特定类型的结果文件

**请求**：

```
GET /get-file/{file_type}
```

**路径参数**：

- `file_type`: 文件类型，可选值为"text"、"formulas"或"table"

**响应**：
请求的结果文件。

## 文件夹结构

- `pdf_store/`: 存储上传的 PDF 文件
- `result/`: 存储处理结果
  - `img_result/`: 存储从 PDF 中提取的图片
- `temp_images/`: 存储处理过程中的临时图片

## 开发说明

- `interface.py`: API 接口定义
- `pdfprocessor.py`: PDF 处理核心逻辑
- `pdfinput.py`: 用户输入处理
- `pdfformulaget.py`: 公式提取和处理
- `pdffindformula.py`: 公式查找和替换
