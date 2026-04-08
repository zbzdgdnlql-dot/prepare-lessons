import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css'

type ModuleType = 'vocabulary' | 'grammar' | 'culture' | 'exercise' | 'activity';

interface ModuleState {
  type: ModuleType;
  title: string;
  content: string;
  isLoading: boolean;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode, fallback?: React.ReactNode}, {hasError: boolean, error?: Error}> {
  constructor(props: {children: React.ReactNode, fallback?: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div className="text-red-500 p-4 border border-red-200 rounded bg-red-50">编辑器加载失败，请刷新重试。({this.state.error?.message})</div>;
    }
    return this.props.children;
  }
}

const getTitleByType = (type: ModuleType, t: (key: string) => string) => {
  switch (type) {
    case 'vocabulary': return t('module_vocabulary');
    case 'grammar': return t('module_grammar');
    case 'culture': return t('module_culture');
    case 'exercise': return t('module_exercise');
    case 'activity': return t('module_activity');
    default: return t('unknown_module');
  }
};

const VditorEditor = ({ id, value, onChange }: { id: string, value: string, onChange: (val: string) => void }) => {
  const [vd, setVd] = useState<Vditor>();
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const el = document.getElementById(id);
    if (!el) return;
    
    let vditor: Vditor | undefined;
    try {
      vditor = new Vditor(id, {
        value: value,
        mode: 'wysiwyg',
        cache: { enable: false },
        outline: { enable: false, position: 'left' },
        input: (v) => {
          if (isMounted) {
            isUpdatingRef.current = true;
            onChange(v);
          }
        },
        after: () => {
          if (isMounted && vditor) {
            setVd(vditor);
          }
        }
      });
    } catch (e) {
      console.error('Vditor init error:', e);
    }

    return () => {
      isMounted = false;
      if (vditor) {
        try {
          vditor.destroy();
        } catch (e) {
          console.warn('Vditor destroy error', e);
        }
      }
      setVd(undefined);
      const currentEl = document.getElementById(id);
      if (currentEl) {
        currentEl.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (vd) {
      try {
        const currentValue = vd.getValue();
        if (value !== currentValue) {
          if (isUpdatingRef.current) {
            isUpdatingRef.current = false;
            return;
          }
          vd.setValue(value);
        } else {
          isUpdatingRef.current = false;
        }
      } catch (e) {
        console.warn('Vditor sync error', e);
      }
    }
  }, [value, vd]);

  return <div id={id} className="vditor-wrapper" />;
};

function App() {
  const { t, i18n } = useTranslation();
  
  const [step, setStep] = useState(1);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [outline, setOutline] = useState<{grammar: string[], vocabulary: {word: string, translation: string}[]} | null>(null);
  
  const [targetLang, setTargetLang] = useState('fr');
  
  // v2.0 State
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [selectedModules, setSelectedModules] = useState<ModuleType[]>(['vocabulary', 'grammar', 'culture', 'exercise']);
  const [cefrLevel, setCefrLevel] = useState('B1');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // v2.1 State
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});

  // v2.2 State
  const [exerciseTypes, setExerciseTypes] = useState<string[]>(['阅读理解', '词汇与语法']);
  const availableExerciseTypes = ['听写 (Dictée)', '听力理解 (Compréhension orale)', '词汇与语法 (Exercices grammaticaux et lexicaux)', '完形填空 (Texte à trous)', '阅读理解 (Compréhension écrite)', '写作 (Production écrite)'];
  
  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<{id: string, title: string, content: string, date: string}[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('fp_bookmarks');
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch(e) {
        console.error(e);
      }
    }
  }, []);

  // Force display language to zh
  useEffect(() => {
    if (i18n.language !== 'zh') {
      i18n.changeLanguage('zh');
    }
  }, [i18n]);

  const currentLang = 'zh';

  const handleBookmark = (title: string, content: string) => {
    const newBookmark = {
      id: Date.now().toString(),
      title: title,
      content: content,
      date: new Date().toLocaleString()
    };
    const updatedBookmarks = [newBookmark, ...bookmarks];
    setBookmarks(updatedBookmarks);
    localStorage.setItem('fp_bookmarks', JSON.stringify(updatedBookmarks));
    alert(`${t('alert_bookmark')}${title}`);
  };

  const handleDeleteBookmark = (id: string) => {
    const updatedBookmarks = bookmarks.filter(b => b.id !== id);
    setBookmarks(updatedBookmarks);
    localStorage.setItem('fp_bookmarks', JSON.stringify(updatedBookmarks));
  };

  const handleTargetLangChange = (lang: string) => {
    setTargetLang(lang);
    setModules([]);
    if (step === 3) {
      setStep(2);
    }
  };

  // Outline editing functions
  const handleUpdateGrammar = (index: number, value: string) => {
    if (!outline) return;
    const newGrammar = [...outline.grammar];
    newGrammar[index] = value;
    setOutline({ ...outline, grammar: newGrammar });
  };

  const handleRemoveGrammar = (index: number) => {
    if (!outline) return;
    const newGrammar = outline.grammar.filter((_, i) => i !== index);
    setOutline({ ...outline, grammar: newGrammar });
  };

  const handleAddGrammar = () => {
    if (!outline) return;
    setOutline({ ...outline, grammar: [...outline.grammar, ""] });
  };

  const handleUpdateVocabulary = (index: number, field: 'word' | 'translation', value: string) => {
    if (!outline) return;
    const newVocab = [...outline.vocabulary];
    newVocab[index] = { ...newVocab[index], [field]: value };
    setOutline({ ...outline, vocabulary: newVocab });
  };

  const handleRemoveVocabulary = (index: number) => {
    if (!outline) return;
    const newVocab = outline.vocabulary.filter((_, i) => i !== index);
    setOutline({ ...outline, vocabulary: newVocab });
  };

  const handleAddVocabulary = () => {
    if (!outline) return;
    setOutline({ ...outline, vocabulary: [...outline.vocabulary, { word: "", translation: "" }] });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8000/api/parse-file', {
        method: 'POST',
        headers: {
          'Accept-Language': targetLang
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setInputText(data.text);
      } else {
        alert(t('alert_parse_fail') + data.detail);
      }
    } catch (err) {
      console.error(err);
      alert(t('alert_network_err'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractOutline = async () => {
    if (!inputText.trim()) {
      alert(t('alert_input'));
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/extract-outline', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept-Language': targetLang
        },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutline(data);
        setStep(2);
      } else {
        alert(t('alert_extract_fail') + data.detail);
      }
    } catch (err) {
      console.error(err);
      alert(t('alert_network_err'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateModules = async () => {
    if (selectedModules.length === 0) {
      alert(t('alert_select_module'));
      return;
    }
    
    setStep(3);
    
    const initialModules = selectedModules.map(type => ({ 
      type, 
      title: getTitleByType(type, t), 
      content: '', 
      isLoading: true 
    }));
    setModules(initialModules);

    await Promise.all(selectedModules.map(async (type) => {
      try {
        const res = await fetch('http://localhost:8000/api/generate-module', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept-Language': targetLang
          },
          body: JSON.stringify({
            module_type: type,
            source_text: inputText,
            outline: outline,
            cefr_level: cefrLevel,
            custom_prompt: customPrompt,
            exercise_types: type === 'exercise' ? exerciseTypes : undefined
          })
        });
        const data = await res.json();
        
        if (res.ok) {
          setModules(prev => prev.map(m => m.type === type ? { ...m, content: data.content_md, isLoading: false } : m));
        } else {
          setModules(prev => prev.map(m => m.type === type ? { ...m, content: `**${t('alert_gen_fail')}**: ${data.detail}`, isLoading: false } : m));
        }
      } catch(e) {
        console.error(e);
        setModules(prev => prev.map(m => m.type === type ? { ...m, content: `**${t('alert_network_err')}**`, isLoading: false } : m));
      }
    }));
  };

  const handleRegenerateModule = async (type: ModuleType, feedback?: string) => {
    setModules(prev => prev.map(m => m.type === type ? { ...m, content: '', isLoading: true } : m));
    
    try {
      const res = await fetch('http://localhost:8000/api/generate-module', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept-Language': targetLang
        },
        body: JSON.stringify({
          module_type: type,
          source_text: inputText,
          outline: outline,
          cefr_level: cefrLevel,
          custom_prompt: customPrompt,
          feedback: feedback || undefined,
          exercise_types: type === 'exercise' ? exerciseTypes : undefined
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        setModules(prev => prev.map(m => m.type === type ? { ...m, content: data.content_md, isLoading: false } : m));
      } else {
        setModules(prev => prev.map(m => m.type === type ? { ...m, content: `**${t('alert_gen_fail')}**: ${data.detail}`, isLoading: false } : m));
      }
    } catch(e) {
      console.error(e);
      setModules(prev => prev.map(m => m.type === type ? { ...m, content: `**${t('alert_network_err')}**`, isLoading: false } : m));
    }
  };

  const handleExport = async (version: "teacher" | "student") => {
    try {
      // 准备打印数据
      const printData = {
        title: "智能备课包",
        version: version,
        targetLang: i18n.language,
        modules: modules.map(m => ({
          title: m.title,
          content: m.content
        }))
      };
      
      // 存入 localStorage 供打印页面读取
      localStorage.setItem('fp_print_data', JSON.stringify(printData));
      
      // 在新标签页打开打印路由
      window.open('/print', '_blank');
      
    } catch (err) {
      console.error(err);
      alert(t('alert_export_fail'));
    }
  };



  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">{t('app_title')}</h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('app_subtitle', { lang: t(`lang_${currentLang}`) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button onClick={() => handleTargetLangChange('fr')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${targetLang === 'fr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Fr</button>
              <button onClick={() => handleTargetLangChange('es')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${targetLang === 'es' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Es</button>
              <button onClick={() => handleTargetLangChange('de')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${targetLang === 'de' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>De</button>
            </div>
            <button 
              onClick={() => setShowBookmarks(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {t('my_bookmarks')} ({bookmarks.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Bookmarks Modal */}
      {showBookmarks && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {t('bookmarks_library')}
              </h2>
              <button onClick={() => setShowBookmarks(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
              {bookmarks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <p>{t('no_bookmarks')}</p>
                </div>
              ) : (
                bookmarks.map(b => (
                  <div key={b.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-bold text-slate-800">{b.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">{t('bookmark_time')} {b.date}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => navigator.clipboard.writeText(b.content)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                          {t('copy_content')}
                        </button>
                        <button 
                          onClick={() => handleDeleteBookmark(b.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-slate-600 line-clamp-6 hover:line-clamp-none transition-all">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.content}</ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
        
        {/* Stepper */}
        <div className="mb-12 max-w-4xl mx-auto">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full -z-10"></div>
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full -z-10 transition-all duration-500`} style={{ width: `${(step - 1) * 50}%` }}></div>
            
            {[
              { id: 1, name: t('step1_name'), icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
              { id: 2, name: t('step2_name'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
              { id: 3, name: t('step3_name'), icon: 'M5 13l4 4L19 7' }
            ].map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-3 bg-slate-50 px-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-slate-50 transition-colors duration-300 ${
                  step > s.id ? 'bg-indigo-600 text-white shadow-md' : 
                  step === s.id ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md' : 
                  'bg-white text-slate-400 border-slate-200 shadow-sm'
                }`}>
                  {step > s.id ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                    </svg>
                  )}
                </div>
                <div className={`text-sm font-semibold tracking-wide ${step >= s.id ? 'text-indigo-900' : 'text-slate-400'}`}>
                  {s.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 Content */}
        {step === 1 && (
          <div className="animate-fade-in bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 lg:p-10 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-800">{t('upload_title')}</h2>
              <p className="text-slate-500 mt-2">{t('upload_desc', { lang: t(`lang_${currentLang}`) })}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              {/* Upload Area */}
              <div className="p-8 lg:p-10 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-center">
                <div className="relative border-2 border-dashed border-indigo-200 rounded-2xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group">
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                  />
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">{t('drag_drop')}</h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    {t('support_formats')}
                  </p>
                </div>
              </div>
              
              {/* Text Area */}
              <div className="p-8 lg:p-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t('paste_direct')}</label>
                  <button 
                    onClick={() => setInputText('')} 
                    className="text-xs text-slate-400 hover:text-red-500 transition"
                  >
                    {t('clear_content')}
                  </button>
                </div>
                <textarea 
                  className="w-full flex-1 min-h-[300px] border border-slate-200 rounded-2xl p-6 text-slate-700 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-400 leading-relaxed"
                  placeholder={t('placeholder_text', { lang: t(`lang_${currentLang}`) })}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                ></textarea>
              </div>
            </div>

            <div className="p-6 lg:p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('extract_wait')}
              </div>
              <button 
                onClick={handleExtractOutline}
                disabled={isLoading}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-200 whitespace-nowrap ${isLoading ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-0.5 text-white'}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('processing')}
                  </>
                ) : (
                  <>
                    {t('extract_btn')}
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && outline && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="p-8 lg:p-10 border-b border-slate-100 bg-indigo-50/30">
                <h2 className="text-2xl font-bold text-slate-800">{t('confirm_outline')}</h2>
                <p className="text-slate-500 mt-2">{t('outline_desc')}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                {/* Grammar */}
                <div className="p-8 lg:p-10 bg-white">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">{t('core_grammar')}</h3>
                    </div>
                    <button onClick={handleAddGrammar} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">{t('add_grammar')}</button>
                  </div>
                  <ul className="space-y-3">
                    {outline.grammar.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 focus-within:border-amber-200 transition-colors group">
                        <span className="flex-shrink-0 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 mt-0.5">{idx + 1}</span>
                        <input
                          type="text"
                          value={g}
                          onChange={(e) => handleUpdateGrammar(idx, e.target.value)}
                          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 outline-none w-full"
                          placeholder={t('input_grammar')}
                        />
                        <button onClick={() => handleRemoveGrammar(idx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    ))}
                    {outline.grammar.length === 0 && (
                      <div className="text-slate-400 italic p-4 text-center">{t('no_grammar')}</div>
                    )}
                  </ul>
                </div>
                
                {/* Vocabulary */}
                <div className="p-8 lg:p-10 bg-white">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">{t('core_vocab')}</h3>
                    </div>
                    <button onClick={handleAddVocabulary} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">{t('add_vocab')}</button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {outline.vocabulary.map((v, idx) => (
                      <div key={idx} className="group flex items-center bg-white border border-slate-200 focus-within:border-emerald-300 shadow-sm rounded-xl overflow-hidden transition-all">
                        <input
                          type="text"
                          value={v.word}
                          onChange={(e) => handleUpdateVocabulary(idx, 'word', e.target.value)}
                          className="w-1/3 px-4 py-2.5 bg-slate-50 focus:bg-white border-r border-slate-200 font-bold text-slate-800 outline-none"
                          placeholder={t('vocab_word', { lang: t(`lang_${currentLang}`) })}
                        />
                        <input
                          type="text"
                          value={v.translation}
                          onChange={(e) => handleUpdateVocabulary(idx, 'translation', e.target.value)}
                          className="flex-1 px-4 py-2.5 text-slate-600 outline-none"
                          placeholder={t('vocab_trans')}
                        />
                        <button onClick={() => handleRemoveVocabulary(idx)} className="px-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {outline.vocabulary.length === 0 && (
                      <div className="text-slate-400 italic w-full p-4 text-center">{t('no_vocab')}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Generation Options (v2.0) */}
              <div className="p-8 lg:p-10 border-t border-slate-100 bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800 mb-6">{t('gen_options')}</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('sel_modules')}</label>
                    <div className="flex flex-wrap gap-3">
                      {(['vocabulary', 'grammar', 'culture', 'exercise', 'activity'] as ModuleType[]).map(type => (
                        <label key={type} className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-indigo-50 transition-colors">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            checked={selectedModules.includes(type)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedModules([...selectedModules, type]);
                              } else {
                                setSelectedModules(selectedModules.filter(m => m !== type));
                              }
                            }}
                          />
                          <span className="text-slate-700">{getTitleByType(type, t)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {selectedModules.includes('exercise') && (
                    <div className="pl-4 border-l-2 border-indigo-200 ml-2 animate-fade-in">
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t('config_exercises')}</label>
                      <div className="flex flex-wrap gap-3">
                        {availableExerciseTypes.map(type => (
                          <label key={type} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded border border-slate-200 cursor-pointer hover:bg-indigo-50 transition-colors text-sm">
                            <input 
                              type="checkbox" 
                              className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                              checked={exerciseTypes.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setExerciseTypes([...exerciseTypes, type]);
                                } else {
                                  setExerciseTypes(exerciseTypes.filter(t => t !== type));
                                }
                              }}
                            />
                            <span className="text-slate-600">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('target_level')}</label>
                    <select 
                      className="w-full md:w-64 bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={cefrLevel}
                      onChange={(e) => setCefrLevel(e.target.value)}
                    >
                      <option value="A1">A1 (入门级)</option>
                      <option value="A2">A2 (初级)</option>
                      <option value="B1">B1 (中级)</option>
                      <option value="B2">B2 (中高级)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('custom_prompt_label')}</label>
                    <textarea 
                      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-24"
                      placeholder={t('custom_prompt_placeholder')}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                    />
                  </div>


                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button 
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t('back_edit')}
              </button>
              <button 
                onClick={handleGenerateModules}
                disabled={isLoading}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-200 whitespace-nowrap ${isLoading ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-0.5 text-white'}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('generating')}
                  </>
                ) : (
                  <>
                    {t('confirm_gen')}
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="animate-fade-in max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              {/* Toolbar */}
              <div className="bg-slate-50 border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {modules.some(m => m.isLoading) ? t('pack_generating') : t('pack_generated')}
                    </h2>
                    <p className="text-xs text-slate-500">{t('preview_export')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => navigator.clipboard.writeText(modules.map(m => m.content).join('\n\n'))}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {t('copy_all')}
                  </button>
                  <button 
                    onClick={() => handleExport("student")}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    打印学生版 (PDF)
                  </button>
                  <button 
                    onClick={() => handleExport("teacher")}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    打印教师版 (PDF)
                  </button>
                </div>
              </div>

              {/* Modules Content */}
              <div className="p-8 lg:p-12 max-h-[70vh] overflow-y-auto bg-slate-50 space-y-8">
                {modules.map(module => (
                  <div key={module.type} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-slate-800 whitespace-nowrap">{module.title}</h3>
                      <div className="flex flex-1 max-w-md items-center gap-2">
                        <input
                          type="text"
                          value={feedbackText[module.type] || ''}
                          onChange={(e) => setFeedbackText({...feedbackText, [module.type]: e.target.value})}
                          placeholder="例如：将习题难度降低..."
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          disabled={module.isLoading}
                        />
                        <button 
                          onClick={() => handleRegenerateModule(module.type, feedbackText[module.type])}
                          disabled={module.isLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${module.isLoading ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                        >
                          <svg className={`w-4 h-4 ${module.isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {module.isLoading ? t('generating_module') : t('regenerate')}
                        </button>
                        <button 
                          onClick={() => handleBookmark(module.title, module.content)}
                          disabled={module.isLoading || !module.content}
                          title="收藏此模块内容"
                          className={`flex items-center justify-center p-1.5 rounded-lg transition-colors ${module.isLoading || !module.content ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-amber-500 bg-amber-50 hover:bg-amber-100'}`}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      {module.isLoading ? (
                        <div className="animate-pulse space-y-4">
                          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                          <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                        </div>
                      ) : (
                        <div className="vditor-container w-full" style={{ overflowWrap: 'anywhere' }}>
                          <ErrorBoundary>
                            <VditorEditor
                              id={`vditor-${module.type}`}
                              value={module.content}
                              onChange={(v) => {
                                setModules(prev => prev.map(m => m.type === module.type ? { ...m, content: v } : m));
                              }}
                            />
                          </ErrorBoundary>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button 
                onClick={() => {
                  setStep(1);
                  setInputText('');
                  setOutline(null);
                  setModules([]);
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('restart')}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default App