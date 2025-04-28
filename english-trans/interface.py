#!/usr/bin/env python
# -*- coding: utf-8 -*-

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import os
import shutil
import glob
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import io
import zipfile
from pdfprocessor import main
import re
from pdfinput import validate_pdf_path

# 定义响应模型
class ProcessStatus(BaseModel):
    status: str
    message: str
    results: Dict[str, Any]

class FileInfo(BaseModel):
    filename: str
    size: int
    path: str

class ResultInfo(BaseModel):
    type: str
    filename: str
    path: str
    size: int

class ResultsResponse(BaseModel):
    text: Optional[ResultInfo] = None
    formulas: Optional[ResultInfo] = None
    table: Optional[ResultInfo] = None
    images: List[ResultInfo] = []

class PathValidation(BaseModel):
    path: str

class PathValidationResult(BaseModel):
    valid: bool
    message: Optional[str] = None
    filename: Optional[str] = None

app = FastAPI(title="PDF Translation API", description="API for translating PDF documents")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (you may want to restrict this in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# 确保必要的目录存在
os.makedirs("pdf_store", exist_ok=True)
os.makedirs("result", exist_ok=True)
os.makedirs("result/img_result", exist_ok=True)
os.makedirs("temp_images", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)
os.makedirs("templates", exist_ok=True)

# 设置模板引擎
templates = Jinja2Templates(directory="templates")

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/pdf_store", StaticFiles(directory="pdf_store"), name="pdf_store")
app.mount("/result", StaticFiles(directory="result"), name="result")
app.mount("/temp_images", StaticFiles(directory="temp_images"), name="temp_images")

@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    """提供主页HTML"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api")
async def get_api_info():
    """API根端点"""
    return {"message": "PDF Translation API is running", "version": "1.0"}

@app.post("/upload-pdf/", response_model=FileInfo)
async def upload_pdf(pdf_file: UploadFile = File(...)):
    """上传PDF文件到服务器"""
    try:
        # 保存上传的文件
        file_path = f"pdf_store/{pdf_file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(pdf_file.file, buffer)
        
        # 获取文件大小
        file_size = os.path.getsize(file_path)
        
        return FileInfo(
            filename=pdf_file.filename,
            size=file_size,
            path=file_path
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传文件失败: {str(e)}")

@app.post("/validate-pdf-path/", response_model=PathValidationResult)
async def validate_pdf_path_endpoint(path_data: PathValidation):
    """验证本地PDF文件路径是否有效"""
    try:
        # 使用pdfinput中的验证函数
        result = validate_pdf_path(path_data.path)
        
        return PathValidationResult(
            valid=result["valid"],
            message=result.get("message"),
            filename=result.get("filename")
        )
    except Exception as e:
        return PathValidationResult(
            valid=False,
            message=f"验证路径时出错: {str(e)}"
        )

def process_pdf_task(file_path: str, target_language: str, use_local_path: bool = False):
    """在后台任务中处理PDF"""
    try:
        print(f"开始处理PDF: {file_path}, 目标语言: {target_language}, 本地路径: {use_local_path}")
        
        # 如果是本地路径，处理Windows路径格式
        if use_local_path:
            # 确保路径使用双反斜杠，以符合Python路径要求
            processed_path = file_path.replace("\\", "\\\\")
            print(f"处理后的本地路径: {processed_path}")
        else:
            # 上传的文件路径保持不变
            processed_path = file_path
            print(f"使用上传的文件路径: {processed_path}")
        
        # 确保处理过程中的环境变量设置
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
        
        # 调用main函数进行处理
        print(f"调用pdfprocessor.main处理文件")
        main(processed_path, target_language)
        print(f"PDF处理完成")
    except Exception as e:
        import traceback
        import datetime
        error_details = traceback.format_exc()
        print(f"处理PDF失败: {str(e)}")
        print(f"错误详情: {error_details}")
        
        # 保存错误日志到文件
        with open("pdf_processing_error.log", "a", encoding="utf-8") as log_file:
            log_file.write(f"\n\n时间: {datetime.datetime.now()}\n")
            log_file.write(f"文件路径: {file_path}\n")
            log_file.write(f"目标语言: {target_language}\n")
            log_file.write(f"错误信息: {str(e)}\n")
            log_file.write(f"错误详情:\n{error_details}\n")

@app.post("/translate-pdf/", response_model=ProcessStatus)
async def translate_pdf(
    background_tasks: BackgroundTasks,
    file_path: str = Form(...), 
    target_language: str = Form(...),
    use_local_path: str = Form("false")
):
    """翻译PDF文件到目标语言"""
    try:
        # 判断是否使用本地路径
        is_local_path = use_local_path.lower() == "true"
        
        # 验证文件路径
        if is_local_path:
            # 验证本地路径
            validation_result = validate_pdf_path(file_path)
            if not validation_result["valid"]:
                raise HTTPException(status_code=400, detail=f"无效的本地PDF文件路径: {validation_result.get('message', '')}")
        else:
            # 验证上传的文件路径
            if not os.path.exists(file_path) or not file_path.endswith(".pdf"):
                raise HTTPException(status_code=400, detail="无效的PDF文件路径")
        
        # 在后台处理PDF以避免API超时
        background_tasks.add_task(process_pdf_task, file_path, target_language, is_local_path)
        
        # 返回响应，包括结果文件的路径
        return ProcessStatus(
            status="processing",
            message="PDF处理已开始，请稍后查询结果",
            results={
                "text": "/result/translated_result.md",
                "formulas": "/result/formula_result.md",
                "table": "/result/table_result.xlsx",
                "images_dir": "/result/img_result"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理PDF失败: {str(e)}")

@app.get("/pdf-list/", response_model=List[FileInfo])
async def list_pdfs():
    """列出所有可用的PDF文件"""
    try:
        pdf_files = []
        for file_path in glob.glob("pdf_store/*.pdf"):
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            pdf_files.append(FileInfo(
                filename=filename,
                size=file_size,
                path=file_path
            ))
        return pdf_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取PDF列表失败: {str(e)}")

@app.get("/results/", response_model=ResultsResponse)
async def list_result_files():
    """列出所有可用的结果文件"""
    try:
        results = ResultsResponse(images=[])
        
        # 检查文本结果
        text_path = "result/translated_result.md"
        if os.path.exists(text_path):
            results.text = ResultInfo(
                type="text",
                filename=os.path.basename(text_path),
                path="/result/translated_result.md",
                size=os.path.getsize(text_path)
            )
        
        # 检查公式结果
        formulas_path = "result/formula_result.md"
        if os.path.exists(formulas_path):
            results.formulas = ResultInfo(
                type="formulas",
                filename=os.path.basename(formulas_path),
                path="/result/formula_result.md",
                size=os.path.getsize(formulas_path)
            )
        
        # 检查表格结果
        table_path = "result/table_result.xlsx"
        if os.path.exists(table_path):
            results.table = ResultInfo(
                type="table",
                filename=os.path.basename(table_path),
                path="/result/table_result.xlsx",
                size=os.path.getsize(table_path)
            )
        
        # 检查图片结果
        for img_path in glob.glob("result/img_result/*.*"):
            results.images.append(ResultInfo(
                type="image",
                filename=os.path.basename(img_path),
                path=f"/result/img_result/{os.path.basename(img_path)}",
                size=os.path.getsize(img_path)
            ))
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取结果文件列表失败: {str(e)}")

@app.get("/result-status/{filename}")
async def get_result_status(filename: str):
    """获取PDF处理状态和结果"""
    base_filename = os.path.splitext(os.path.basename(filename))[0]
    
    # 检查各种结果文件是否存在
    text_result = os.path.exists("result/translated_result.md")
    formula_result = os.path.exists("result/formula_result.md")
    table_result = os.path.exists("result/table_result.xlsx")
    
    # 检查图片结果目录
    image_dir_exists = os.path.exists("result/img_result") and os.path.isdir("result/img_result")
    
    # 检查图片结果文件
    image_files = []
    if image_dir_exists:
        # 支持多种图片格式
        for ext in ["*.jpg", "*.jpeg", "*.png", "*.gif", "*.bmp", "*.tiff", "*.webp"]:
            image_files.extend(glob.glob(f"result/img_result/{ext}"))
    
    if text_result or formula_result or table_result or image_files:
        return {
            "status": "completed",
            "results": {
                "text": "/result/translated_result.md" if text_result else None,
                "formulas": "/result/formula_result.md" if formula_result else None,
                "table": "/result/table_result.xlsx" if table_result else None,
                "images": [os.path.basename(img) for img in image_files] if image_files else [],
                "images_dir": "/result/img_result"
            }
        }
    else:
        return {
            "status": "pending",
            "message": "处理尚未完成或尚未开始"
        }

@app.get("/download-results/{filename}")
async def download_results(filename: str):
    """将所有结果打包下载"""
    base_filename = os.path.splitext(os.path.basename(filename))[0]
    
    # 创建内存中的ZIP文件
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # 添加文本结果
        if os.path.exists("result/translated_result.md"):
            zip_file.write("result/translated_result.md", f"{base_filename}_translated.md")
        
        # 添加公式结果
        if os.path.exists("result/formula_result.md"):
            zip_file.write("result/formula_result.md", f"{base_filename}_formulas.md")
        
        # 添加表格结果
        if os.path.exists("result/table_result.xlsx"):
            zip_file.write("result/table_result.xlsx", f"{base_filename}_table.xlsx")
        
        # 添加图片结果 - 支持多种图片格式
        img_count = 0
        for ext in ["*.jpg", "*.jpeg", "*.png", "*.gif", "*.bmp", "*.tiff", "*.webp"]:
            for img_file in glob.glob(f"result/img_result/{ext}"):
                img_name = os.path.basename(img_file)
                zip_file.write(img_file, f"images/{img_name}")
                img_count += 1
        
        # 如果没有找到任何结果文件，返回错误
        if not (os.path.exists("result/translated_result.md") or 
                os.path.exists("result/formula_result.md") or 
                os.path.exists("result/table_result.xlsx") or 
                img_count > 0):
            raise HTTPException(status_code=404, detail="没有找到任何结果文件")
    
    # 将指针移回到文件开头
    zip_buffer.seek(0)
    
    # 返回ZIP文件
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={base_filename}_results.zip"}
    )

@app.get("/get-file/{file_type}")
async def get_file(file_type: str):
    """获取特定类型的结果文件"""
    file_paths = {
        "text": "result/translated_result.md",
        "formulas": "result/formula_result.md",
        "table": "result/table_result.xlsx"
    }
    
    if file_type not in file_paths:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file_type}")
    
    file_path = file_paths[file_type]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")
    
    # 设置正确的 content-type
    media_types = {
        "text": "text/markdown",
        "formulas": "text/markdown", 
        "table": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    
    return FileResponse(
        file_path, 
        filename=os.path.basename(file_path),
        media_type=media_types[file_type]
    )

@app.get("/get-image/{image_name}")
async def get_image(image_name: str):
    """获取特定的图片文件"""
    image_path = f"result/img_result/{image_name}"
    
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail=f"图片不存在: {image_name}")
    
    return FileResponse(
        image_path, 
        filename=image_name
    )

def start_server(host="localhost", port=1234):
    """启动FastAPI服务器"""
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    start_server() 