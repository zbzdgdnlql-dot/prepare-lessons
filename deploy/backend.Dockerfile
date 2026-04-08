FROM python:3.10-slim

WORKDIR /app

# EasyOCR / OpenCV 运行时常见依赖（不一定全用到，但能避免很多 "libGL.so" 之类的错误）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
  && rm -rf /var/lib/apt/lists/*

# 先拷贝依赖文件以利用 Docker 缓存
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 拷贝后端代码
COPY backend /app/backend

# init_db() 会读取仓库根目录下的 Prompt_*.md，因此也需要拷贝这些文件
COPY Prompt_*.md /app/

WORKDIR /app/backend

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

