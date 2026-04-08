import json
import os

keys = {
    "app_title": {"zh": "Lang Pro AI", "fr": "Lang Pro AI", "es": "Lang Pro AI", "de": "Lang Pro AI"},
    "app_subtitle": {"zh": "智能{lang}备课系统 v2.2", "fr": "Système intelligent de préparation de cours de {lang} v2.2", "es": "Sistema inteligente de preparación de clases de {lang} v2.2", "de": "Intelligentes System zur Vorbereitung des {lang}unterrichts v2.2"},
    "my_bookmarks": {"zh": "我的收藏", "fr": "Mes favoris", "es": "Mis favoritos", "de": "Meine Lesezeichen"},
    "bookmarks_library": {"zh": "我的收藏库", "fr": "Ma bibliothèque de favoris", "es": "Mi biblioteca de favoritos", "de": "Meine Lesezeichen-Bibliothek"},
    "no_bookmarks": {"zh": "暂无收藏内容，快去生成并收藏优质教案吧！", "fr": "Aucun favori pour le moment, allez générer et sauvegarder d'excellents plans de cours !", "es": "No hay favoritos todavía, ¡ve a generar y guardar excelentes planes de lecciones!", "de": "Noch keine Lesezeichen, gehen Sie und erstellen Sie hervorragende Unterrichtspläne!"},
    "bookmark_time": {"zh": "收藏时间:", "fr": "Date d'ajout:", "es": "Fecha de adición:", "de": "Hinzugefügt am:"},
    "copy_content": {"zh": "复制内容", "fr": "Copier le contenu", "es": "Copiar contenido", "de": "Inhalt kopieren"},
    "delete": {"zh": "删除", "fr": "Supprimer", "es": "Eliminar", "de": "Löschen"},
    "step1_name": {"zh": "输入教学素材", "fr": "Saisir le matériel", "es": "Ingresar material", "de": "Lehrmaterial eingeben"},
    "step2_name": {"zh": "确认知识大纲", "fr": "Confirmer le plan", "es": "Confirmar plan", "de": "Wissensstruktur bestätigen"},
    "step3_name": {"zh": "生成完整教案", "fr": "Générer le cours", "es": "Generar clase", "de": "Vollständigen Unterrichtsplan erstellen"},
    "upload_title": {"zh": "上传课文或粘贴内容", "fr": "Télécharger un texte ou coller du contenu", "es": "Subir texto o pegar contenido", "de": "Text hochladen oder Inhalt einfügen"},
    "upload_desc": {"zh": "支持 PDF, Word 或图片格式，系统将自动识别{lang}文本。", "fr": "Prend en charge les formats PDF, Word ou image, le système reconnaîtra automatiquement le texte en {lang}.", "es": "Soporta formatos PDF, Word o imagen, el sistema reconocerá automáticamente el texto en {lang}.", "de": "Unterstützt PDF-, Word- oder Bildformate, das System erkennt automatisch {lang}en Text."},
    "drag_drop": {"zh": "点击或拖拽上传文件", "fr": "Cliquez ou glissez-déposez pour télécharger", "es": "Haz clic o arrastra para subir el archivo", "de": "Klicken oder ziehen Sie, um eine Datei hochzuladen"},
    "support_formats": {"zh": "支持 .pdf, .docx, .png, .jpg 格式自动进行高质量 OCR 识别", "fr": "Prend en charge .pdf, .docx, .png, .jpg pour une reconnaissance OCR de haute qualité", "es": "Soporta .pdf, .docx, .png, .jpg para reconocimiento OCR de alta calidad", "de": "Unterstützt .pdf, .docx, .png, .jpg für hochwertige OCR-Erkennung"},
    "paste_direct": {"zh": "直接粘贴文本", "fr": "Coller directement le texte", "es": "Pegar texto directamente", "de": "Text direkt einfügen"},
    "clear_content": {"zh": "清空内容", "fr": "Effacer le contenu", "es": "Borrar contenido", "de": "Inhalt löschen"},
    "placeholder_text": {"zh": "请在此粘贴{lang}课文、生词表或相关教学要求...", "fr": "Veuillez coller ici le texte en {lang}, la liste de vocabulaire...", "es": "Por favor, pegue aquí el texto en {lang}, la lista de vocabulario...", "de": "Bitte fügen Sie hier den {lang}en Text, die Vokabelliste... ein."},
    "extract_wait": {"zh": "提取大纲可能需要 10-30 秒，请耐心等待", "fr": "L'extraction du plan peut prendre 10 à 30 secondes...", "es": "La extracción del plan puede tardar entre 10 y 30 segundos...", "de": "Das Extrahieren der Struktur kann 10-30 Sekunden dauern..."},
    "processing": {"zh": "正在处理中...", "fr": "Traitement en cours...", "es": "Procesando...", "de": "Wird bearbeitet..."},
    "extract_btn": {"zh": "提取核心知识大纲", "fr": "Extraire le plan de connaissances", "es": "Extraer el plan de conocimientos", "de": "Kernwissensstruktur extrahieren"},
    "confirm_outline": {"zh": "确认与微调大纲", "fr": "Confirmer et ajuster le plan", "es": "Confirmar y ajustar el plan", "de": "Struktur bestätigen und anpassen"},
    "outline_desc": {"zh": "AI已提取以下核心词汇与语法点。请审核确保无史实或语法错误。", "fr": "L'IA a extrait le vocabulaire et la grammaire. Veuillez vérifier.", "es": "La IA ha extraído el vocabulario y la gramática. Por favor verifique.", "de": "Die KI hat Vokabeln und Grammatik extrahiert. Bitte überprüfen."},
    "core_grammar": {"zh": "提取到的核心语法", "fr": "Grammaire principale extraite", "es": "Gramática principal extraída", "de": "Extrahierte Kerngrammatik"},
    "add_grammar": {"zh": "+ 添加语法", "fr": "+ Ajouter grammaire", "es": "+ Añadir gramática", "de": "+ Grammatik hinzufügen"},
    "input_grammar": {"zh": "输入语法点...", "fr": "Saisir un point de grammaire...", "es": "Ingresar punto de gramática...", "de": "Grammatikpunkt eingeben..."},
    "no_grammar": {"zh": "未提取到语法点，请手动添加", "fr": "Aucun point de grammaire extrait, veuillez ajouter manuellement", "es": "No se extrajo gramática, agregue manualmente", "de": "Keine Grammatik extrahiert, bitte manuell hinzufügen"},
    "core_vocab": {"zh": "核心词汇", "fr": "Vocabulaire principal", "es": "Vocabulario principal", "de": "Kernvokabular"},
    "add_vocab": {"zh": "+ 添加词汇", "fr": "+ Ajouter vocabulaire", "es": "+ Añadir vocabulario", "de": "+ Vokabular hinzufügen"},
    "vocab_word": {"zh": "{lang}单词", "fr": "Mot en {lang}", "es": "Palabra en {lang}", "de": "{lang}es Wort"},
    "vocab_trans": {"zh": "中文翻译", "fr": "Traduction", "es": "Traducción", "de": "Übersetzung"},
    "no_vocab": {"zh": "未提取到词汇，请手动添加", "fr": "Aucun vocabulaire extrait, veuillez ajouter manuellement", "es": "No se extrajo vocabulario, agregue manualmente", "de": "Kein Vokabular extrahiert, bitte manuell hinzufügen"},
    "gen_options": {"zh": "配置生成选项", "fr": "Options de génération", "es": "Opciones de generación", "de": "Generierungsoptionen konfigurieren"},
    "sel_modules": {"zh": "1. 选择生成模块", "fr": "1. Sélectionner les modules", "es": "1. Seleccionar módulos", "de": "1. Module auswählen"},
    "config_exercises": {"zh": "配置习题类型", "fr": "Configurer les types d'exercices", "es": "Configurar tipos de ejercicios", "de": "Übungstypen konfigurieren"},
    "target_level": {"zh": "2. 目标学生水平 (CEFR)", "fr": "2. Niveau cible (CECR)", "es": "2. Nivel objetivo (MCER)", "de": "2. Zielniveau (GER)"},
    "custom_prompt_label": {"zh": "3. 附加自定义指令 (选填)", "fr": "3. Instructions personnalisées (Optionnel)", "es": "3. Instrucciones personalizadas (Opcional)", "de": "3. Zusätzliche benutzerdefinierte Anweisungen (Optional)"},
    "custom_prompt_placeholder": {"zh": "例如：请在习题中多出一些关于动词变位的填空题...", "fr": "Ex : Ajoutez plus d'exercices de conjugaison...", "es": "Ej: Agregue más ejercicios de conjugación...", "de": "Z.B.: Fügen Sie mehr Konjugationsübungen hinzu..."},
    "adv_settings": {"zh": "高级设置：透明化提示词", "fr": "Paramètres avancés : Prompts transparents", "es": "Configuración avanzada: Prompts transparentes", "de": "Erweiterte Einstellungen: Transparente Prompts"},
    "adv_desc": {"zh": "您可以直接查看并修改AI的系统提示词（System Prompt）。", "fr": "Vous pouvez voir et modifier le System Prompt de l'IA.", "es": "Puede ver y modificar el System Prompt de la IA.", "de": "Sie können den System-Prompt der KI anzeigen und ändern."},
    "back_edit": {"zh": "返回修改素材", "fr": "Retour pour modifier", "es": "Volver para modificar", "de": "Zurück zur Bearbeitung"},
    "generating": {"zh": "正在生成教案...", "fr": "Génération en cours...", "es": "Generando plan...", "de": "Unterrichtsplan wird generiert..."},
    "confirm_gen": {"zh": "确认无误，生成所选模块", "fr": "Confirmer et générer", "es": "Confirmar y generar", "de": "Bestätigen und Module generieren"},
    "pack_generated": {"zh": "备课包已生成", "fr": "Plan de cours généré", "es": "Plan de clase generado", "de": "Unterrichtsplan generiert"},
    "preview_export": {"zh": "您可以直接预览或导出为 Word 文档", "fr": "Vous pouvez prévisualiser ou exporter en Word", "es": "Puede previsualizar o exportar a Word", "de": "Sie können in der Vorschau anzeigen oder als Word exportieren"},
    "copy_all": {"zh": "复制全部", "fr": "Tout copier", "es": "Copiar todo", "de": "Alles kopieren"},
    "export_student": {"zh": "导出学生版", "fr": "Exporter version étudiant", "es": "Exportar versión estudiante", "de": "Studentenversion exportieren"},
    "export_teacher": {"zh": "导出教师版", "fr": "Exporter version professeur", "es": "Exportar versión profesor", "de": "Lehrerversion exportieren"},
    "generating_module": {"zh": "生成中...", "fr": "Génération...", "es": "Generando...", "de": "Wird generiert..."},
    "regenerate": {"zh": "重新生成", "fr": "Régénérer", "es": "Regenerar", "de": "Neu generieren"},
    "restart": {"zh": "重新开始新备课", "fr": "Recommencer", "es": "Empezar de nuevo", "de": "Neu starten"},
    "module_vocabulary": {"zh": "词汇精讲", "fr": "Explication du vocabulaire", "es": "Explicación de vocabulario", "de": "Vokabelerklärung"},
    "module_grammar": {"zh": "语法精讲", "fr": "Explication de la grammaire", "es": "Explicación de gramática", "de": "Grammatikerklärung"},
    "module_culture": {"zh": "文化背景拓展", "fr": "Culture et contexte", "es": "Cultura y contexto", "de": "Kultur und Hintergrund"},
    "module_exercise": {"zh": "随堂测试与习题", "fr": "Exercices et tests", "es": "Ejercicios y pruebas", "de": "Übungen und Tests"},
    "module_activity": {"zh": "课堂互动活动", "fr": "Activités interactives", "es": "Actividades interactivas", "de": "Interaktive Aktivitäten"},
    "lang_fr": {"zh": "法语", "fr": "français", "es": "francés", "de": "Französisch"},
    "lang_es": {"zh": "西班牙语", "fr": "espagnol", "es": "español", "de": "Spanisch"},
    "lang_de": {"zh": "德语", "fr": "allemand", "es": "alemán", "de": "Deutsch"},
    "ui_lang": {"zh": "界面语言", "fr": "Langue de l'interface", "es": "Idioma de la interfaz", "de": "Schnittstellensprache"},
    "teach_lang": {"zh": "教学语言", "fr": "Langue d'enseignement", "es": "Idioma de enseñanza", "de": "Unterrichtssprache"},
}

langs = ['zh', 'fr', 'es', 'de']

for lang in langs:
    out = {}
    for k, v in keys.items():
        out[k] = v[lang]
    
    os.makedirs(f'e:/prepare lessons/frontend/src/locales/{lang}', exist_ok=True)
    with open(f'e:/prepare lessons/frontend/src/locales/{lang}/translation.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

print("i18n files generated!")
