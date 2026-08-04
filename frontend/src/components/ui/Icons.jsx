import React from 'react';

const iconBase = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': 'true',
};

export const LogoutIcon = (props) => (
  <svg {...iconBase} className="h-5 w-5" {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

export const StoreIcon = (props) => (
  <svg {...iconBase} className="h-5 w-5" {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 21h18M4 21V8m16 13V8M2 8h20l-1.5-5h-17L2 8zm3 4h3m-3 4h3m8-4h3m-3 4h3"
    />
  </svg>
);
