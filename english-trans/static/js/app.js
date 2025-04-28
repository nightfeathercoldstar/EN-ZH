// 全局变量
let currentUploadedFile = null;
let processingStatus = false;
let currentLanguage = 'zh'; // 默认语言为中文
let validatedLocalPath = null; // 存储验证过的本地PDF路径

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
    
    // 初始化本地路径验证
    initPathValidation();
    
    // 检查是否已有结果可显示
    loadAllResults();
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
    
    // 禁用翻译按钮 (如果本地路径也未验证)
    document.getElementById('translate-btn').disabled = !validatedLocalPath;
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

// 初始化本地路径验证
function initPathValidation() {
    const validatePathBtn = document.getElementById('validate-path-btn');
    const localPdfPath = document.getElementById('local-pdf-path');
    const pathValidationInfo = document.getElementById('path-validation-info');
    
    validatePathBtn.addEventListener('click', async function() {
        const path = localPdfPath.value.trim();
        
        if (!path) {
            showPathValidationInfo('请输入文件路径', false);
            return;
        }
        
        // 使用正则表达式验证路径格式
        const pattern = /^[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+\.pdf$/i;
        
        if (!pattern.test(path)) {
            showPathValidationInfo('路径格式不正确，请确保是有效的PDF文件路径', false);
            validatedLocalPath = null;
            document.getElementById('translate-btn').disabled = !currentUploadedFile;
            return;
        }
        
        try {
            showLoader('正在验证文件路径...');
            
            // 发送请求验证路径
            const response = await fetch('/validate-pdf-path/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: path })
            });
            
            const result = await response.json();
            hideLoader();
            
            if (result.valid) {
                showPathValidationInfo(`文件有效: ${result.filename}`, true);
                validatedLocalPath = path;
                document.getElementById('translate-btn').disabled = false;
            } else {
                showPathValidationInfo(result.message || '文件路径无效或无法访问', false);
                validatedLocalPath = null;
                document.getElementById('translate-btn').disabled = !currentUploadedFile;
            }
        } catch (error) {
            hideLoader();
            showPathValidationInfo('验证路径时出错', false);
            validatedLocalPath = null;
            document.getElementById('translate-btn').disabled = !currentUploadedFile;
        }
    });
    
    // 当输入新路径时，清除验证结果
    localPdfPath.addEventListener('input', function() {
        pathValidationInfo.style.display = 'none';
        validatedLocalPath = null;
        document.getElementById('translate-btn').disabled = !currentUploadedFile;
    });
}

// 显示路径验证信息
function showPathValidationInfo(message, isValid) {
    const pathValidationInfo = document.getElementById('path-validation-info');
    pathValidationInfo.textContent = message;
    pathValidationInfo.classList.remove('valid', 'invalid');
    pathValidationInfo.classList.add(isValid ? 'valid' : 'invalid');
    pathValidationInfo.style.display = 'block';
}

// 处理表单提交
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!currentUploadedFile && !validatedLocalPath) {
        showNotification('错误', '请先上传PDF文件或输入有效的本地PDF路径', 'error');
        return;
    }
    
    if (processingStatus) {
        showNotification('提示', 'PDF正在处理中，请稍候', 'info');
        return;
    }
    
    try {
        const formData = new FormData();
        
        // 使用上传的文件或本地路径
        if (currentUploadedFile) {
            formData.append('file_path', currentUploadedFile.path);
            formData.append('use_local_path', 'false');
        } else {
            formData.append('file_path', validatedLocalPath);
            formData.append('use_local_path', 'true');
        }
        
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
        
        // 显示处理状态
        updateProcessingStatus(currentUploadedFile ? currentUploadedFile.filename : '本地PDF文件', result);
        
        // 开始检查处理状态
        const statusCheckInterval = setInterval(() => {
            if (!processingStatus) {
                clearInterval(statusCheckInterval);
                return;
            }
            
            checkProcessingStatus(currentUploadedFile ? currentUploadedFile.filename : '本地PDF文件');
        }, 5000); // 每5秒检查一次
        
        hideLoader();
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
            
            // 显示结果区域
            const resultArea = document.getElementById('result-area');
            resultArea.classList.add('active');
            
            // 加载所有可用的结果
            loadAllResults();
            
            // 更新下载所有结果按钮
            if (currentUploadedFile) {
                document.getElementById('download-all-btn').style.display = 'inline-block';
                document.getElementById('download-all-btn').href = `/download-results/${currentUploadedFile.filename}`;
            } else {
                // 如果是本地PDF文件，使用一个通用名称
                document.getElementById('download-all-btn').style.display = 'inline-block';
                document.getElementById('download-all-btn').href = `/download-results/local_pdf_results`;
            }
            
            // 如果有表格结果，确保表格内容已加载
            if (result.results && result.results.table) {
                loadTableResult(result.results.table);
            }
            
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
    if (currentUploadedFile) {
        document.getElementById('download-all-btn').style.display = 'inline-block';
        document.getElementById('download-all-btn').href = `/download-results/${currentUploadedFile.filename}`;
    } else {
        // 如果是本地PDF文件，使用一个通用名称
        document.getElementById('download-all-btn').style.display = 'inline-block';
        document.getElementById('download-all-btn').href = `/download-results/local_pdf_results`;
    }

    // 加载所有可用的结果文件详情
    loadAllResults();
}

// 加载所有结果文件详情
async function loadAllResults() {
    try {
        const response = await fetch('/results/');
        
        if (!response.ok) {
            throw new Error('获取结果文件列表失败');
        }
        
        const allResults = await response.json();
        
        // 更新文本结果
        if (allResults.text) {
            loadTextResult(allResults.text.path);
        }
        
        // 更新公式结果
        if (allResults.formulas) {
            loadFormulasResult(allResults.formulas.path);
        }
        
        // 更新表格结果
        if (allResults.table) {
            loadTableResult(allResults.table.path);
        }
        
        // 更新图片结果
        if (allResults.images && allResults.images.length) {
            const imagesContent = document.getElementById('images-content');
            imagesContent.innerHTML = '';
            
            allResults.images.forEach(image => {
                const imgElement = document.createElement('img');
                imgElement.src = image.path;
                imgElement.alt = image.filename;
                imgElement.className = 'result-image';
                
                // 点击放大图片
                imgElement.addEventListener('click', () => {
                    window.open(image.path, '_blank');
                });
                
                imagesContent.appendChild(imgElement);
            });
        }
        
        // 更新所有文件列表
        updateAllFilesList(allResults);
    } catch (error) {
        console.error('加载所有结果文件失败:', error);
    }
}

// 更新所有文件列表
function updateAllFilesList(results) {
    const filesList = document.getElementById('all-files-list');
    
    // 清空列表
    filesList.innerHTML = '';
    
    let hasFiles = false;
    
    // 添加文本结果
    if (results.text) {
        hasFiles = true;
        addFileListItem(filesList, {
            type: 'text',
            icon: 'fa-file-alt',
            name: results.text.filename,
            path: results.text.path,
            size: formatFileSize(results.text.size)
        });
    }
    
    // 添加公式结果
    if (results.formulas) {
        hasFiles = true;
        addFileListItem(filesList, {
            type: 'formula',
            icon: 'fa-square-root-alt',
            name: results.formulas.filename,
            path: results.formulas.path,
            size: formatFileSize(results.formulas.size)
        });
    }
    
    // 添加表格结果
    if (results.table) {
        hasFiles = true;
        addFileListItem(filesList, {
            type: 'table',
            icon: 'fa-table',
            name: results.table.filename,
            path: results.table.path,
            size: formatFileSize(results.table.size)
        });
    }
    
    // 添加图片结果
    if (results.images && results.images.length) {
        hasFiles = true;
        results.images.forEach(image => {
            addFileListItem(filesList, {
                type: 'image',
                icon: 'fa-image',
                name: image.filename,
                path: image.path,
                size: formatFileSize(image.size)
            });
        });
    }
    
    // 如果没有文件，显示提示
    if (!hasFiles) {
        filesList.innerHTML = '<div class="empty-message">暂无结果文件</div>';
    } else {
        // 显示结果区域
        document.getElementById('result-area').classList.add('active');
    }
}

// 添加文件列表项
function addFileListItem(container, file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-list-item';
    
    fileItem.innerHTML = `
        <i class="fas ${file.icon} file-icon file-${file.type}"></i>
        <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${file.size}</div>
        </div>
        <div class="file-actions">
            <a href="${file.path}" target="_blank">
                <i class="fas fa-eye"></i> 查看
            </a>
            <a href="${file.path}" download>
                <i class="fas fa-download"></i> 下载
            </a>
        </div>
    `;
    
    container.appendChild(fileItem);
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

// 加载表格结果
async function loadTableResult(tablePath) {
    try {
        // 设置下载按钮
        document.getElementById('download-table-btn').href = tablePath;
        document.getElementById('download-table-btn').style.display = 'inline-block';
        
        // 获取表格容器元素
        const tableContent = document.getElementById('table-content');
        const tableLoading = tableContent.querySelector('.table-loading');
        const tableDisplay = tableContent.querySelector('.table-display');
        
        // 显示加载状态
        if (tableLoading) {
            tableLoading.style.display = 'block';
        }
        
        // 隐藏表格显示
        if (tableDisplay) {
            tableDisplay.style.display = 'none';
        }
        
        // 发起请求获取Excel文件
        const response = await fetch(tablePath);
        if (!response.ok) {
            throw new Error('无法加载表格文件');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // 使用SheetJS解析Excel文件
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 获取工作表名称列表
        const sheetNames = workbook.SheetNames;
        
        // 如果有多个工作表，则设置工作表选择器
        const sheetSelector = document.getElementById('sheet-selector');
        sheetSelector.innerHTML = '';
        
        if (sheetNames.length > 1) {
            sheetNames.forEach(sheetName => {
                const option = document.createElement('option');
                option.value = sheetName;
                option.textContent = sheetName;
                sheetSelector.appendChild(option);
            });
            sheetSelector.style.display = 'block';
            
            // 添加工作表切换事件
            sheetSelector.addEventListener('change', function() {
                const selectedSheet = this.value;
                displaySheetData(workbook, selectedSheet);
            });
        } else {
            sheetSelector.style.display = 'none';
        }
        
        // 显示第一个工作表的数据
        displaySheetData(workbook, sheetNames[0]);
        
        // 隐藏加载状态，显示表格
        if (tableLoading) {
            tableLoading.style.display = 'none';
        }
        
        if (tableDisplay) {
            tableDisplay.style.display = 'block';
        }
    } catch (error) {
        console.error('加载表格失败:', error);
        const tableContent = document.getElementById('table-content');
        tableContent.innerHTML = `
            <div class="table-placeholder">
                <i class="fas fa-exclamation-circle"></i>
                <p>加载表格失败: ${error.message}</p>
                <a href="${tablePath}" class="btn btn-primary" download>
                    <i class="fas fa-download"></i> 下载表格文件查看
                </a>
            </div>
        `;
    }
}

// 显示工作表数据
function displaySheetData(workbook, sheetName) {
    // 获取指定工作表
    const worksheet = workbook.Sheets[sheetName];
    
    // 将工作表转换为HTML表格
    const excelTable = document.getElementById('excel-table');
    
    // 获取表格范围
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const startRow = range.s.r;
    const endRow = range.e.r;
    const startCol = range.s.c;
    const endCol = range.e.c;
    
    // 创建表格头部和内容
    let tableHTML = '<thead><tr>';
    
    // 生成表头（使用第一行作为表头）
    for (let c = startCol; c <= endCol; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: startRow, c: c });
        const cellData = worksheet[cellAddress];
        const cellValue = cellData ? cellData.v : '';
        tableHTML += `<th style="color: #000000;">${cellValue}</th>`;
    }
    
    tableHTML += '</tr></thead><tbody>';
    
    // 生成表格内容（从第二行开始）
    for (let r = startRow + 1; r <= endRow; r++) {
        tableHTML += '<tr>';
        
        for (let c = startCol; c <= endCol; c++) {
            const cellAddress = XLSX.utils.encode_cell({ r: r, c: c });
            const cellData = worksheet[cellAddress];
            const cellValue = cellData ? cellData.v : '';
            
            // 处理不同类型的单元格
            if (cellData && cellData.t === 'n') {
                // 数字类型
                tableHTML += `<td class="text-end" style="color: #000000;">${cellValue}</td>`;
            } else if (cellData && cellData.t === 'd') {
                // 日期类型
                tableHTML += `<td style="color: #000000;">${new Date(cellValue).toLocaleDateString()}</td>`;
            } else {
                // 其他类型
                tableHTML += `<td style="color: #000000;">${cellValue}</td>`;
            }
        }
        
        tableHTML += '</tr>';
    }
    
    tableHTML += '</tbody>';
    
    // 更新表格
    excelTable.innerHTML = tableHTML;
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
    
    // 刷新结果按钮
    document.getElementById('refresh-results-btn').addEventListener('click', loadAllResults);
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