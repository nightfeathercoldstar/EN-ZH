// 全局变量
let currentUploadedFile = null;
let processingStatus = false;
let currentLanguage = 'zh'; // 默认语言为中文

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化拖放区域
    initDropArea();
    
    // 加载已上传的PDF文件列表
    loadPdfList();
    
    // 初始化语言选择器
    initLanguageSelector();
    
    // 初始化结果标签页
    initResultTabs();
    
    // 绑定表单提交事件
    document.getElementById('translation-form').addEventListener('submit', handleFormSubmit);
    
    // 初始化按钮事件
    initButtons();
});

// 初始化拖放区域
function initDropArea() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    
    // 阻止默认拖放事件
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    // 高亮拖放区域
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('highlight');
        }, false);
    });
    
    // 取消高亮拖放区域
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('highlight');
        }, false);
    });
    
    // 处理拖放的文件
    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length) {
            fileInput.files = files;
            handleFiles(files);
        }
    }, false);
    
    // 点击上传按钮
    document.getElementById('upload-btn').addEventListener('click', () => {
        fileInput.click();
    });
    
    // 处理选择的文件
    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });
}

// 阻止默认事件
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 处理文件
function handleFiles(files) {
    if (files.length) {
        const file = files[0];
        
        // 检查文件类型
        if (file.type !== 'application/pdf') {
            showNotification('错误', '请上传PDF文件', 'error');
            return;
        }
        
        // 显示文件信息
        displayFileInfo(file);
        
        // 上传文件
        uploadFile(file);
    }
}

// 显示文件信息
function displayFileInfo(file) {
    const fileInfoArea = document.getElementById('file-info-area');
    const fileSize = formatFileSize(file.size);
    
    fileInfoArea.innerHTML = `
        <div class="file-info">
            <i class="fas fa-file-pdf file-icon"></i>
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${fileSize}</div>
            </div>
            <i class="fas fa-times file-remove" onclick="removeFile()"></i>
        </div>
    `;
    
    fileInfoArea.style.display = 'block';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 移除文件
function removeFile() {
    document.getElementById('file-input').value = '';
    document.getElementById('file-info-area').style.display = 'none';
    currentUploadedFile = null;
    
    // 禁用翻译按钮
    document.getElementById('translate-btn').disabled = true;
}

// 上传文件
async function uploadFile(file) {
    try {
        const formData = new FormData();
        formData.append('pdf_file', file);
        
        showLoader('正在上传文件...');
        
        const response = await fetch('/upload-pdf/', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('文件上传失败');
        }
        
        const result = await response.json();
        hideLoader();
        
        // 保存上传的文件信息
        currentUploadedFile = result;
        
        // 启用翻译按钮
        document.getElementById('translate-btn').disabled = false;
        
        showNotification('成功', '文件上传成功', 'success');
    } catch (error) {
        hideLoader();
        showNotification('错误', error.message, 'error');
    }
}

// 初始化语言选择器
function initLanguageSelector() {
    const languageSelector = document.getElementById('language');
    languageSelector.addEventListener('change', function() {
        currentLanguage = this.value;
    });
}

// 处理表单提交
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!currentUploadedFile) {
        showNotification('错误', '请先上传PDF文件', 'error');
        return;
    }
    
    if (processingStatus) {
        showNotification('提示', 'PDF正在处理中，请稍候', 'info');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('file_path', currentUploadedFile.path);
        formData.append('target_language', currentLanguage);
        
        showLoader('正在处理PDF...');
        processingStatus = true;
        
        const response = await fetch('/translate-pdf/', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('PDF处理请求失败');
        }
        
        const result = await response.json();
        
        // 更新处理状态
        updateProcessingStatus(currentUploadedFile.filename, 'processing');
        
        // 显示状态区域
        const statusArea = document.getElementById('status-area');
        statusArea.innerHTML = `
            <div class="status status-processing">
                <i class="fas fa-spinner fa-spin"></i>
                <span>PDF处理中，请稍候...</span>
            </div>
        `;
        statusArea.style.display = 'block';
        
        // 启动轮询检查处理状态
        checkProcessingStatus(currentUploadedFile.filename);
        
        hideLoader();
        showNotification('提示', 'PDF处理已开始，请稍候查看结果', 'info');
    } catch (error) {
        hideLoader();
        processingStatus = false;
        showNotification('错误', error.message, 'error');
    }
}

// 检查处理状态
async function checkProcessingStatus(filename) {
    try {
        const response = await fetch(`/result-status/${filename}`);
        
        if (!response.ok) {
            throw new Error('获取处理状态失败');
        }
        
        const result = await response.json();
        
        if (result.status === 'completed') {
            // 更新处理状态
            updateProcessingStatus(filename, 'completed');
            
            // 更新状态区域
            const statusArea = document.getElementById('status-area');
            statusArea.innerHTML = `
                <div class="status status-completed">
                    <i class="fas fa-check-circle"></i>
                    <span>PDF处理完成</span>
                </div>
            `;
            
            // 加载结果
            loadResults(result.results);
            
            processingStatus = false;
            showNotification('成功', 'PDF处理完成', 'success');
        } else {
            // 继续轮询
            setTimeout(() => {
                checkProcessingStatus(filename);
            }, 5000); // 每5秒检查一次
        }
    } catch (error) {
        processingStatus = false;
        showNotification('错误', error.message, 'error');
    }
}

// 更新处理状态
function updateProcessingStatus(filename, status) {
    const pdfList = document.getElementById('pdf-list');
    const items = pdfList.getElementsByClassName('pdf-item');
    
    for (let i = 0; i < items.length; i++) {
        const titleElement = items[i].querySelector('.pdf-title');
        if (titleElement && titleElement.textContent === filename) {
            const statusBadge = items[i].querySelector('.status-badge');
            
            if (statusBadge) {
                if (status === 'processing') {
                    statusBadge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中';
                    statusBadge.className = 'status-badge status-processing';
                } else if (status === 'completed') {
                    statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> 已完成';
                    statusBadge.className = 'status-badge status-completed';
                }
            }
            
            break;
        }
    }
}

// 加载结果
function loadResults(results) {
    // 显示结果区域
    const resultArea = document.getElementById('result-area');
    resultArea.classList.add('active');
    
    // 加载文本结果
    if (results.text) {
        loadTextResult(results.text);
    }
    
    // 加载公式结果
    if (results.formulas) {
        loadFormulasResult(results.formulas);
    }
    
    // 加载表格结果
    if (results.table) {
        document.getElementById('download-table-btn').href = results.table;
        document.getElementById('download-table-btn').style.display = 'inline-block';
    }
    
    // 加载图片结果
    if (results.images && results.images.length) {
        loadImageResults(results.images, results.images_dir);
    }
    
    // 启用下载所有结果按钮
    document.getElementById('download-all-btn').style.display = 'inline-block';
    document.getElementById('download-all-btn').href = `/download-results/${currentUploadedFile.filename}`;
}

// 加载文本结果
async function loadTextResult(textPath) {
    try {
        const response = await fetch(textPath);
        
        if (!response.ok) {
            throw new Error('获取文本结果失败');
        }
        
        const text = await response.text();
        
        // 显示文本结果
        const textContent = document.getElementById('text-content');
        textContent.textContent = text;
        
        // 启用下载文本结果按钮
        document.getElementById('download-text-btn').href = textPath;
        document.getElementById('download-text-btn').style.display = 'inline-block';
    } catch (error) {
        console.error('加载文本结果失败:', error);
    }
}

// 加载公式结果
async function loadFormulasResult(formulasPath) {
    try {
        const response = await fetch(formulasPath);
        
        if (!response.ok) {
            throw new Error('获取公式结果失败');
        }
        
        const text = await response.text();
        
        // 显示公式结果
        const formulasContent = document.getElementById('formulas-content');
        formulasContent.textContent = text;
        
        // 启用下载公式结果按钮
        document.getElementById('download-formulas-btn').href = formulasPath;
        document.getElementById('download-formulas-btn').style.display = 'inline-block';
    } catch (error) {
        console.error('加载公式结果失败:', error);
    }
}

// 加载图片结果
function loadImageResults(images, imagesDir) {
    const imagesContent = document.getElementById('images-content');
    imagesContent.innerHTML = '';
    
    images.forEach(image => {
        const imgPath = `${imagesDir}/${image}`;
        const imgElement = document.createElement('img');
        imgElement.src = imgPath;
        imgElement.alt = image;
        imgElement.className = 'result-image';
        
        // 点击放大图片
        imgElement.addEventListener('click', () => {
            window.open(imgPath, '_blank');
        });
        
        imagesContent.appendChild(imgElement);
    });
}

// 初始化结果标签页
function initResultTabs() {
    const tabs = document.getElementsByClassName('result-tab');
    const contents = document.getElementsByClassName('result-content');
    
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function() {
            // 移除所有标签页的active类
            for (let j = 0; j < tabs.length; j++) {
                tabs[j].classList.remove('active');
                contents[j].classList.remove('active');
            }
            
            // 添加当前标签页的active类
            this.classList.add('active');
            contents[i].classList.add('active');
        });
    }
}

// 初始化按钮事件
function initButtons() {
    // 刷新PDF列表按钮
    document.getElementById('refresh-pdf-list-btn').addEventListener('click', loadPdfList);
}

// 加载PDF列表
async function loadPdfList() {
    try {
        const response = await fetch('/pdf-list/');
        
        if (!response.ok) {
            throw new Error('获取PDF列表失败');
        }
        
        const pdfs = await response.json();
        
        const pdfList = document.getElementById('pdf-list');
        pdfList.innerHTML = '';
        
        if (pdfs.length === 0) {
            pdfList.innerHTML = '<p>暂无PDF文件</p>';
            return;
        }
        
        pdfs.forEach(pdf => {
            const listItem = document.createElement('li');
            listItem.className = 'pdf-item';
            
            listItem.innerHTML = `
                <i class="fas fa-file-pdf pdf-icon"></i>
                <div class="pdf-info">
                    <div class="pdf-title">${pdf.filename}</div>
                    <div class="pdf-path">${pdf.path}</div>
                </div>
                <div class="pdf-actions">
                    <span class="status-badge">未处理</span>
                    <button class="btn btn-secondary btn-sm" onclick="selectPdf('${pdf.path}', '${pdf.filename}')">
                        <i class="fas fa-check"></i> 选择
                    </button>
                </div>
            `;
            
            pdfList.appendChild(listItem);
        });
    } catch (error) {
        showNotification('错误', error.message, 'error');
    }
}

// 选择PDF
function selectPdf(path, filename) {
    currentUploadedFile = {
        path: path,
        filename: filename
    };
    
    // 显示文件信息
    const fileInfoArea = document.getElementById('file-info-area');
    
    fileInfoArea.innerHTML = `
        <div class="file-info">
            <i class="fas fa-file-pdf file-icon"></i>
            <div class="file-details">
                <div class="file-name">${filename}</div>
                <div class="file-size">已选择</div>
            </div>
            <i class="fas fa-times file-remove" onclick="removeFile()"></i>
        </div>
    `;
    
    fileInfoArea.style.display = 'block';
    
    // 启用翻译按钮
    document.getElementById('translate-btn').disabled = false;
    
    showNotification('提示', `已选择 ${filename}`, 'info');
}

// 显示加载器
function showLoader(message) {
    const loader = document.getElementById('loader');
    document.getElementById('loader-message').textContent = message || '加载中...';
    loader.style.display = 'flex';
}

// 隐藏加载器
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// 显示通知
function showNotification(title, message, type) {
    const notifications = document.getElementById('notifications');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = '<i class="fas fa-check-circle notification-icon"></i>';
    } else if (type === 'error') {
        icon = '<i class="fas fa-exclamation-circle notification-icon"></i>';
    } else {
        icon = '<i class="fas fa-info-circle notification-icon"></i>';
    }
    
    notification.innerHTML = `
        ${icon}
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <div class="notification-close" onclick="closeNotification(this)">
            <i class="fas fa-times"></i>
        </div>
    `;
    
    notifications.appendChild(notification);
    
    // 自动关闭通知
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

// 关闭通知
function closeNotification(element) {
    const notification = element.parentNode;
    notification.style.opacity = '0';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
} 