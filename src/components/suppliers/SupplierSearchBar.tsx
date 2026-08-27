import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

interface SupplierSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  uploadedReports: any[];
  removeUploadedReport: (id: string) => void;
}

export function SupplierSearchBar({ searchQuery, setSearchQuery, uploadedReports, removeUploadedReport }: SupplierSearchBarProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Search Bar */}
      <div className="relative group">
        <input 
          type="search" 
          name="supplier_search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('search')} 
          className="w-full rounded-lg border border-zinc-100 bg-white py-3 pr-12 pl-4 outline-none focus:ring-2 focus:ring-brand-500 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
          dir="rtl"
        />
        <div className="absolute inset-y-0 right-4 flex items-center pr-3 pointer-events-none text-zinc-400 group-focus-within:text-brand-500 transition-colors">
          <Search size={20} className="opacity-50" />
        </div>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 left-4 flex items-center pl-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Uploaded Reports Tags */}
      {uploadedReports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedReports.map((report, idx) => {
            const match = report.name.match(/\((\d+)\)/);
            const shortName = match ? match[0] : `(${idx + 1})`;
            return (
              <div key={report.id} className="flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-800 dark:text-brand-300 px-3 py-1.5 rounded-lg text-sm font-bold">
                <span>{report.name} <span className="text-xs opacity-70 ml-1">{shortName}</span></span>
                <button 
                  onClick={() => removeUploadedReport(report.id)}
                  className="hover:text-red-500 transition-colors bg-white/50 dark:bg-black/20 rounded-md p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
