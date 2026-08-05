import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ page, totalPages, onChange, className = '' }) => {
  const pages = Math.max(1, totalPages);

  const pageNumbers = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
      pageNumbers.push('...');
    }
  }

  const baseBtn =
    'inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav className={`flex items-center gap-1 ${className}`} aria-label="Paginación">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
        className={`${baseBtn} text-opticolor-gray-600 hover:bg-opticolor-gray-100`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      {pageNumbers.map((num, idx) =>
        num === '...' ? (
          <span key={`dots-${idx}`} className="px-2 text-opticolor-gray-400">
            …
          </span>
        ) : (
          <button
            key={num}
            onClick={() => onChange(num)}
            aria-current={num === page ? 'page' : undefined}
            className={`${baseBtn} ${
              num === page
                ? 'bg-opticolor-red text-white shadow-sm'
                : 'text-opticolor-gray-600 hover:bg-opticolor-gray-100'
            }`}
          >
            {num}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Página siguiente"
        className={`${baseBtn} text-opticolor-gray-600 hover:bg-opticolor-gray-100`}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
};

export default Pagination;