import React from 'react';

/**
 * Authentic Vingroup Emblem SVG
 * Circular red badge with golden soaring wing and 5 stars.
 */
export function VingroupEmblem({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="38 0 76 66"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {/* Red Circle Base */}
      <circle cx="76.6" cy="32.85" r="32.85" fill="#DA251D" />
      {/* Golden Wing Soaring Upward */}
      <path
        d="M93.74 4.8C93.74 4.8 79.31 6.18 81.07 19.35C82.83 32.52 87.57 36.16 87.33 41.93C87.09 47.7 81.07 48.45 74.42 46.57C67.77 44.69 63.76 42.05 63.76 42.05C63.76 42.05 75.3 41.8 67.27 35.28C59.24 28.76 52.22 27.5 52.22 27.5C52.22 27.5 63.62 25.04 74.55 35.53C74.55 35.53 69.16 30.13 70.54 19.59C71.92 9.05 85.47 5.66 93.74 4.8Z"
        fill="#FEE600"
      />
      {/* 5 Golden Stars */}
      <path
        d="M53.25 45.66L53.95 48.4L51.56 49.91L54.38 50.09L55.08 52.83L56.13 50.21L58.95 50.39L56.77 48.58L57.82 45.96L55.43 47.47L53.25 45.66Z"
        fill="#FEE600"
      />
      <path
        d="M99.97 45.66L97.8 47.47L95.41 45.96L96.46 48.58L94.28 50.39L97.1 50.21L98.15 52.83L98.85 50.09L101.67 49.91L99.28 48.4L99.97 45.66Z"
        fill="#FEE600"
      />
      <path
        d="M66 50.62L64.36 52.92L61.66 52.08L63.34 54.35L61.7 56.65L64.38 55.75L66.07 58.02L66.04 55.2L68.72 54.3L66.02 53.45L66 50.62Z"
        fill="#FEE600"
      />
      <path
        d="M87.22 50.88L87.19 53.71L84.49 54.56L87.17 55.46L87.14 58.28L88.83 56.01L91.51 56.91L89.87 54.61L91.55 52.34L88.85 53.18L87.22 50.88Z"
        fill="#FEE600"
      />
      <path
        d="M76.43 54L75.56 56.69H72.73L75.02 58.35L74.15 61.04L76.44 59.38L78.73 61.04L77.86 58.35L80.15 56.69H77.32L76.43 54Z"
        fill="#FEE600"
      />
    </svg>
  );
}

/**
 * Full Corporate Vingroup Brand Header Component
 * With Emblem, Vingroup title, and subsidiary name: 3D Vincons Window
 */
export default function VingroupLogo({ compact = false, showTagline = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10 }}>
      <VingroupEmblem size={compact ? 32 : 40} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 900,
              fontSize: compact ? 13 : 15,
              letterSpacing: '0.08em',
              color: '#DA251D',
              lineHeight: 1.1,
            }}
          >
            VINGROUP
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: '#FEF2F2',
              color: '#B91C1C',
              border: '1px solid #FECACA',
              padding: '1px 5px',
              borderRadius: 3,
              letterSpacing: '0.02em',
            }}
          >
            VINCONS
          </span>
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: compact ? 12 : 13,
            color: '#0F172A',
            letterSpacing: '0.01em',
            lineHeight: 1.2,
            marginTop: 1,
            whiteSpace: 'nowrap',
          }}
        >
          3D Vincons Window
        </div>
        {showTagline && !compact && (
          <div
            style={{
              fontSize: 10,
              color: '#64748B',
              fontWeight: 500,
              marginTop: 1,
              letterSpacing: '0.02em',
            }}
          >
            Hệ thống Quản trị Nông trại In 3D
          </div>
        )}
      </div>
    </div>
  );
}
