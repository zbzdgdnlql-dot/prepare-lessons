import sqlite3
import os
import datetime

def init_db():
    db_path = os.path.join(os.path.dirname(__file__), 'prompts.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Prompt_Templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language_code VARCHAR(10) UNIQUE,
        prompt_content TEXT,
        version VARCHAR(20),
        updated_at DATETIME
    )
    ''')

    # Read markdown files
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
        else:
            print(f"Warning: {file_path} not found.")

    conn.commit()
    conn.close()
    print("Database initialization complete.")

if __name__ == '__main__':
    init_db()