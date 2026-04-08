import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

interface PrintData {
  title: string;
  version: string;
  targetLang: string;
  modules: { title: string; content: string }[];
}

const PrintPreview = () => {
  const [data, setData] = useState<PrintData | null>(null);
  const { i18n } = useTranslation();

  useEffect(() => {
    // 获取本地存储中的打印数据
    const printDataStr = localStorage.getItem('fp_print_data');
    if (printDataStr) {
      try {
        const parsed = JSON.parse(printDataStr);
        setData(parsed);
        if (parsed.targetLang && i18n.language !== parsed.targetLang) {
            i18n.changeLanguage(parsed.targetLang);
        }
      } catch (e) {
        console.error('Failed to parse print data', e);
      }
    }
  }, [i18n]);

  useEffect(() => {
    // 数据加载完毕后，稍微延迟一下，等待图片或字体渲染，然后调用打印
    if (data) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!data) {
    return <div className="p-8 text-center text-slate-500">正在加载打印数据...</div>;
  }

  const { title, version, modules } = data;

  return (
    <div className="print-preview-container bg-white min-h-screen text-black p-8 max-w-[210mm] mx-auto">
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              background: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-preview-container {
              box-shadow: none !important;
              padding: 0 !important;
              max-width: none !important;
            }
            .page-break-avoid {
              page-break-inside: avoid;
            }
            h1, h2, h3 {
              page-break-after: avoid;
            }
            table {
              page-break-inside: auto;
              width: 100%;
              border-collapse: collapse;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
          }
          
          /* Screen preview styles */
          .print-preview-container {
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin-top: 2rem;
            margin-bottom: 2rem;
          }
        `}
      </style>

      <div className="mb-8 text-center border-b-2 border-slate-800 pb-4">
        <h1 className="text-3xl font-black mb-2">{title || '备课包'}</h1>
        <p className="text-lg text-slate-600">{version === 'student' ? '【学生版】' : '【教师版】'}</p>
      </div>

      <div className="space-y-8">
        {modules.map((m: { title: string; content: string }, idx: number) => {
          // 对学生版进行简单的挖空处理
          let content = m.content;
          if (version === 'student') {
            content = content.replace(/\*\*(.*?)\*\*/g, '______');
            // 如果需要移除特定内容可以在这里加正则，比如：
            // content = content.replace(/教学建议：.*/g, '');
          }

          return (
            <div key={idx} className="module-section">
              <h2 className="text-2xl font-bold mb-4 border-b border-slate-200 pb-2">{m.title}</h2>
              <div className="prose prose-slate max-w-none prose-table:border prose-th:bg-slate-100 prose-td:border-t prose-th:border-b prose-th:p-2 prose-td:p-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrintPreview;