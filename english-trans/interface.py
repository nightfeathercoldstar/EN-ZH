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
from typing import List, Dict, Optional
from pydantic import BaseModel
import io
import zipfile
from pdfprocessor import main

# 定义响应模型
class ProcessStatus(BaseModel):
    status: str
    message: str
    results: Dict[str, str]

class FileInfo(BaseModel):
    filename: str
    size: int
    path: str

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

def process_pdf_task(file_path: str, target_language: str):
    """在后台任务中处理PDF"""
    try:
        main(file_path, target_language)
    except Exception as e:
        print(f"处理PDF失败: {str(e)}")

@app.post("/translate-pdf/", response_model=ProcessStatus)
async def translate_pdf(
    background_tasks: BackgroundTasks,
    file_path: str = Form(...), 
    target_language: str = Form(...)
):
    """翻译PDF文件到目标语言"""
    try:
        # 验证文件路径
        if not os.path.exists(file_path) or not file_path.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="无效的PDF文件路径")
        
        # 在后台处理PDF以避免API超时
        background_tasks.add_task(process_pdf_task, file_path, target_language)
        
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

@app.get("/result-status/{filename}")
async def get_result_status(filename: str):
    """获取PDF处理状态和结果"""
    base_filename = os.path.splitext(os.path.basename(filename))[0]
    
    # 检查各种结果文件是否存在
    text_result = os.path.exists("result/translated_result.md")
    formula_result = os.path.exists("result/formula_result.md")
    table_result = os.path.exists("result/table_result.xlsx")
    
    # 检查图片结果
    image_files = glob.glob("result/img_result/*.*")
    
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
        
        # 添加图片结果
        for img_file in glob.glob("result/img_result/*.*"):
            img_name = os.path.basename(img_file)
            zip_file.write(img_file, f"images/{img_name}")
    
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
    
    return FileResponse(
        file_path, 
        filename=os.path.basename(file_path)
    )

def start_server(host="0.0.0.0", port=1234):
    """启动FastAPI服务器"""
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    start_server() 