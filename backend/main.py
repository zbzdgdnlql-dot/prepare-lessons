from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import io
import fitz  # PyMuPDF
import docx
from openai import OpenAI
import json
from typing import Optional, List
from fastapi.responses import StreamingResponse, Response
import re
import tempfile
import os
import sqlite3
import datetime

# Database setup
DB_PATH = os.path.join(os.path.dirname(__file__), 'prompts.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Prompt_Templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language_code VARCHAR(10) UNIQUE,
        prompt_content TEXT,
        version VARCHAR(20),
        updated_at DATETIME
    )
    ''')
    
    base_dir = os.path.dirname(os.path.dirname(__file__))
    files_map = {
        'fr': 'Prompt_French_FLE.md',
        'de': 'Prompt_German_DaF.md',
        'es': 'Prompt_Spanish_ELE.md'
    }

    for lang_code, filename in files_map.items():
        file_path = os.path.join(base_dir, filename)
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute('''
            INSERT INTO Prompt_Templates (language_code, prompt_content, version, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(language_code) DO UPDATE SET
            prompt_content=excluded.prompt_content,
            updated_at=excluded.updated_at
            ''', (lang_code, content, 'v1.0', now))
            print(f"Loaded {filename} into database for language '{lang_code}'")

    conn.commit()
    conn.close()

init_db()

app = FastAPI(title="Français Pro AI Backend")

print("Initializing OCR (skipped EasyOCR import to prevent crash)...")
reader = None
# To avoid crashing the entire app, we will not import easyocr at the top level
# if it is broken in this environment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# DeepSeek API Configuration
# Initialize the client with the provided API key and base URL
client = OpenAI(
    api_key="sk-d7cba5459b1c4a379b1a6cacde344923",
    base_url="https://api.deepseek.com"
)

class OutlineRequest(BaseModel):
    text: str

class LessonPlanRequest(BaseModel):
    text: str
    outline: dict

class ModuleGenerateRequest(BaseModel):
    module_type: str
    source_text: str
    outline: dict
    cefr_level: str = "B1"
    custom_prompt: str = ""
    feedback: Optional[str] = None
    override_system_prompt: Optional[str] = None
    exercise_types: Optional[List[str]] = None

class ExportRequest(BaseModel):
    content: str
    version: str # "teacher" or "student"

class ModuleGenerateResponse(BaseModel):
    module_type: str
    content_md: str

def get_target_language_name(lang_code: str) -> str:
    lang_code = lang_code.split(',')[0].split('-')[0].lower()
    if lang_code == 'fr':
        return '法语'
    elif lang_code == 'es':
        return '西班牙语'
    elif lang_code == 'de':
        return '德语'
    return '法语' # default


import asyncio
import io

# Global cache for EasyOCR readers to avoid re-initializing
ocr_readers = {}

def get_ocr_text(contents: bytes, ocr_lang: str) -> str:
    import easyocr
    global ocr_readers
    if ocr_lang not in ocr_readers:
        print(f"Initializing EasyOCR reader for {ocr_lang} (this may take a while if downloading models)...")
        # Force gpu=False to prevent PyTorch deadlocks on Windows in threads
        ocr_readers[ocr_lang] = easyocr.Reader([ocr_lang, 'en'], gpu=False)
        print("EasyOCR reader initialized.")
    
    print("Reading text from image...")
    reader = ocr_readers[ocr_lang]
    # Pass contents as bytes, easyocr can handle it
    results = reader.readtext(contents)
    print("Text extraction finished.")
    
    return " ".join([text for (bbox, text, prob) in results])

@app.post("/api/parse-file")
async def parse_file(request: Request, file: UploadFile = File(...)):
    """
    Parse uploaded file (PDF, DOCX, or Image) and extract text.
    """
    lang_code = request.headers.get('accept-language', 'fr')
    try:
        contents = await file.read()
        filename = file.filename.lower()
        extracted_text = ""

        if filename.endswith('.pdf'):
            # Parse PDF
            pdf_document = fitz.open(stream=contents, filetype="pdf")
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                extracted_text += page.get_text() + "\n"
                
        elif filename.endswith('.docx'):
            # Parse Word Document
            doc = docx.Document(io.BytesIO(contents))
            for para in doc.paragraphs:
                extracted_text += para.text + "\n"
                
        elif filename.endswith(('.png', '.jpg', '.jpeg')):
            # Parse Image using EasyOCR (imported here to prevent global crash)
            try:
                # Determine OCR language based on accept-language
                ocr_lang = 'en'
                lang_prefix = lang_code.split(',')[0].split('-')[0].lower()
                if lang_prefix in ['fr', 'es', 'de']:
                    ocr_lang = lang_prefix
                
                print(f"Starting OCR processing for language: {ocr_lang}")
                # Run OCR in a separate thread to avoid blocking the FastAPI event loop
                text_from_image = await asyncio.to_thread(get_ocr_text, contents, ocr_lang)
                print("OCR processing completed successfully.")
                extracted_text += text_from_image
            except Exception as e:
                print(f"OCR Error: {e}")
                raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
                
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, Word, or Image files.")

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the file. It might be empty or unreadable.")

        return {"text": extracted_text.strip()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract-outline")
async def extract_outline(request_obj: Request, request: OutlineRequest):
    """
    Use DeepSeek to extract core grammar and vocabulary from the text.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty.")
        
    lang_code = request_obj.headers.get('accept-language', 'fr')
    target_lang = get_target_language_name(lang_code)

    system_prompt = f"""你是一个资深初高中{target_lang}教师。请从以下用户提供的教学素材中提取核心知识点。
请严格以 JSON 格式输出，不要包含任何额外的解释或 Markdown 标记。
JSON 结构必须完全符合以下格式：
{{
    "grammar": ["语法点1 (中文解释)", "语法点2 (中文解释)"],
    "vocabulary": [
        {{"word": "{target_lang}单词1", "translation": "中文翻译"}},
        {{"word": "{target_lang}单词2", "translation": "中文翻译"}}
    ]
}}"""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"请提取以下{target_lang}素材的知识点：\n\n{request.text[:4000]}"} # Limit text length to avoid token limits if necessary
            ],
            response_format={"type": "json_object"}
        )
        
        # Parse the JSON string returned by DeepSeek
        result_str = response.choices[0].message.content
        result_json = json.loads(result_str)
        return result_json
        
    except Exception as e:
        print(f"Error calling DeepSeek API: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract outline: {str(e)}")


@app.post("/api/generate-lesson")
async def generate_lesson(request_obj: Request, request: LessonPlanRequest):
    """
    Use DeepSeek to generate a complete lesson plan based on the original text and confirmed outline.
    """
    lang_code = request_obj.headers.get('accept-language', 'fr')
    target_lang = get_target_language_name(lang_code)

    system_prompt = f"""你是一个资深初高中{target_lang}教师。请基于用户提供的课文素材和已确认的知识大纲，生成一份详尽的高质量备课包。
备课包必须包含以下四个部分，请使用 Markdown 格式排版，条理清晰，语法严谨，绝不能出现史实或语法错误：
1. 📄 词汇与语法精讲（结合大纲中的词汇和语法，给出详细的变位规则、用法讲解和至少2个经典{target_lang}例句带中文翻译）
2. ✍️ 随堂测试与习题（设计5道单选题和1道完形填空，必须提供标准答案和解析）
3. 🌍 文化背景拓展（与课文主题相关的目标语国家历史、地理或风俗文化介绍）
4. 🎭 课堂互动设计（设计一个适合初高中生的互动小游戏或口语对话话题）"""

    user_prompt = f"""
【确认的知识大纲】
{json.dumps(request.outline, ensure_ascii=False, indent=2)}

【原始教学素材】
{request.text[:4000]}

请根据以上信息，生成完整的备课包。
"""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        lesson_plan = response.choices[0].message.content
        return {"lesson_plan": lesson_plan}
        
    except Exception as e:
        print(f"Error calling DeepSeek API: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson plan: {str(e)}")

@app.get("/api/get-prompt-template")
async def get_prompt_template(request: Request, module_type: str, cefr_level: str = "B1", custom_prompt: str = ""):
    lang_code = request.headers.get('accept-language', 'fr')
    lang_prefix = lang_code.split(',')[0].split('-')[0].lower()
    if lang_prefix not in ['fr', 'de', 'es']:
        lang_prefix = 'fr'

    # Load from DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT prompt_content FROM Prompt_Templates WHERE language_code = ?', (lang_prefix,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Prompt template not found for the selected language.")

    system_prompt = row[0]
    
    # Replace variables
    system_prompt = system_prompt.replace('{{目标级别}}', cefr_level)
    system_prompt = system_prompt.replace('{{课文内容}}', '[用户粘贴的原始教学素材]')

    module_names = {
        "vocabulary": "词汇精讲",
        "grammar": "语法精讲",
        "culture": "文化背景拓展",
        "exercise": "随堂测试与习题",
        "activity": "课堂互动活动"
    }
    module_name_zh = module_names.get(module_type, module_type)

    system_prompt += f"\n\n# Task\n请严格按照上述标准，仅生成【{module_name_zh}】部分的教学内容，使用简体中文输出。"

    if custom_prompt and custom_prompt.strip() != "":
        system_prompt += f"\n\n# User Specific Instructions (Highest Priority)\n用户提出了以下特殊要求，你在生成内容时必须优先满足这些要求，哪怕它与上述某些标准冲突：\n{custom_prompt}"

    return {"template": system_prompt}

@app.post("/api/generate-module", response_model=ModuleGenerateResponse)
async def generate_module(request_obj: Request, request: ModuleGenerateRequest):
    lang_code = request_obj.headers.get('accept-language', 'fr')
    lang_prefix = lang_code.split(',')[0].split('-')[0].lower()
    if lang_prefix not in ['fr', 'de', 'es']:
        lang_prefix = 'fr'

    module_type = request.module_type
    
    if request.override_system_prompt:
        system_prompt = request.override_system_prompt
    else:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT prompt_content FROM Prompt_Templates WHERE language_code = ?', (lang_prefix,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Prompt template not found for the selected language.")

        system_prompt = row[0]
        
        # Replace basic variables
        if request.cefr_level:
            system_prompt = system_prompt.replace('{{目标级别}}', request.cefr_level)
        if request.source_text:
            system_prompt = system_prompt.replace('{{课文内容}}', request.source_text[:4000])
            
        module_names = {
            "vocabulary": "词汇精讲",
            "grammar": "语法精讲",
            "culture": "文化背景拓展",
            "exercise": "随堂测试与习题",
            "activity": "课堂互动活动"
        }
        module_name_zh = module_names.get(module_type, module_type)

        system_prompt += f"\n\n# Task\n请严格按照上述标准，仅生成【{module_name_zh}】部分的教学内容，并且必须使用简体中文（配合目标语言的例句）输出，绝不能使用纯外语输出整个备课包。"

        if module_type == "exercise" and request.exercise_types and len(request.exercise_types) > 0:
            types_str = "、".join(request.exercise_types)
            system_prompt += f"\n注意：习题必须且仅包含以下题型：{types_str}。"

        if request.custom_prompt and request.custom_prompt.strip() != "":
            system_prompt += f"\n\n# User Specific Instructions (Highest Priority)\n用户提出了以下特殊要求，你在生成内容时必须优先满足这些要求，哪怕它与上述某些标准冲突：\n{request.custom_prompt}"

    if request.feedback:
        system_prompt += f"\n\n# User Feedback\n用户对上一次的生成结果不满意，提出了以下修改意见，请务必严格遵照执行：\n{request.feedback}"

    module_names = {
        "vocabulary": "词汇精讲",
        "grammar": "语法精讲",
        "culture": "文化背景拓展",
        "exercise": "随堂测试与习题",
        "activity": "课堂互动活动"
    }
    module_name_zh = module_names.get(module_type, module_type)

    user_prompt = f"""
【确认的知识大纲】
{json.dumps(request.outline, ensure_ascii=False, indent=2)}

【原始教学素材】
{request.source_text[:4000]}

请生成【{module_name_zh}】部分的详细内容。
"""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        content_md = response.choices[0].message.content
        return ModuleGenerateResponse(module_type=module_type, content_md=content_md)
        
    except Exception as e:
        print(f"Error calling DeepSeek API for module {module_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate module {module_type}: {str(e)}")






if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
