import React from 'react';

const Pagination = ({ page, totalPages, onChange, className = '' }) => {
  if (totalPages <= 1) return null;

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      Math.abs(i - page) <= 1
    ) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
      pageNumbers.push('...');
    }
  }

  const baseBtn =
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav className={`flex items-center justify-center gap-1 ${className}`} aria-label="Paginación">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${baseBtn} text-opticolor-gray-600 hover:bg-opticolor-gray-100`}
      >
        ←
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
        disabled={page >= totalPages}
        className={`${baseBtn} text-opticolor-gray-600 hover:bg-opticolor-gray-100`}
      >
        →
      </button>
    </nav>
  );
};

export default Pagination;
