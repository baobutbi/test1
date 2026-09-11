import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ImageModal({ src, title, details, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!src) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(5px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: '#131720',
          border: '1px solid #2d3748',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: '100%',
            padding: '12px 18px',
            background: '#1a202c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #2d3748',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>📷</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>
                {title || 'Ảnh bản in lỗi (Failure Photo)'}
              </div>
              {details && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{details}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: 6,
              color: '#cbd5e1',
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✕ Đóng
          </button>
        </div>

        <div
          style={{
            padding: 16,
            maxHeight: 'calc(80vh - 60px)',
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#090d16',
          }}
        >
          <img
            src={src}
            alt="Print failure record"
            style={{
              maxWidth: '100%',
              maxHeight: '72vh',
              objectFit: 'contain',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
