import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const FAILURE_CATEGORIES = [
  { id: 'spaghetti',        label: 'Bung bàn / Rối sợi (Spaghetti)', icon: '🍝' },
  { id: 'layer_shift',      label: 'Lệch lớp (Layer Shift)',          icon: '↔️' },
  { id: 'nozzle_clog',      label: 'Nghẹt đầu phun (Nozzle Clog)',    icon: '🚫' },
  { id: 'filament_runout',  label: 'Hết / Kẹt nhựa (Filament Jam)',   icon: '🧵' },
  { id: 'warping',          label: 'Cong vênh (Warping / Adhesion)', icon: '📐' },
  { id: 'mechanical',       label: 'Lỗi phần cứng / Nhiệt độ',        icon: '⚙️' },
  { id: 'other',            label: 'Nguyên nhân khác (Other)',        icon: '❓' },
];

export default function FailModal({
  isOpen,
  printer,
  onClose,
  onSubmit,
  operatorName,
}) {
  const [category, setCategory] = useState('spaghetti');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen || !printer) return null;

  const handleFileChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh (JPG, PNG, WebP).');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert('Vui lòng nhập mô tả lỗi bản in.');
      return;
    }

    setUploading(true);
    let photoUrl = null;

    try {
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);

        const uploadRes = await fetch('/api/uploads/failure-photo', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Tải ảnh lỗi thất bại');
        }

        const uploadData = await uploadRes.json();
        photoUrl = uploadData.photo_url;
      }

      await onSubmit({
        printerId: printer.id,
        category,
        notes: notes.trim(),
        photoUrl,
        operatorName,
      });

      onClose();
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: '#181f2c',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: '24px 28px',
          maxWidth: 540,
          width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          color: '#e2e8f0',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#7f1d1d',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            ✗
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#f87171' }}>
              Báo cáo bản in lỗi — {printer.name}
            </h2>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Hệ thống sẽ hoàn số lượng sản phẩm, lưu ảnh lỗi và đưa máy về trạng thái kiểm tra.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Failure Category */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
              Phân loại nguyên nhân lỗi <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {FAILURE_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: category === cat.id ? '2px solid #ef4444' : '1px solid #334155',
                    background: category === cat.id ? '#3b1219' : '#0f172a',
                    color: category === cat.id ? '#fecaca' : '#94a3b8',
                    fontSize: 12,
                    fontWeight: category === cat.id ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Photo Upload */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Ảnh chụp thực tế bản in lỗi (Failure Photo)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files[0])}
            />

            {!photoPreview ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#ef4444' : '#334155'}`,
                  borderRadius: 8,
                  padding: '18px 14px',
                  textAlign: 'center',
                  background: dragOver ? '#2d1519' : '#0f172a',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>📸</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                  Kéo thả ảnh lỗi vào đây hoặc bấm để chọn tệp
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Hỗ trợ JPG, PNG, WebP (Tối đa 25MB). Chụp từ điện thoại hoặc máy tính.
                </div>
              </div>
            ) : (
              <div
                style={{
                  position: 'relative',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#090d16',
                }}
              >
                <img
                  src={photoPreview}
                  alt="Failure Preview"
                  style={{
                    width: '100%',
                    maxHeight: 180,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    display: 'flex',
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'rgba(30, 41, 59, 0.85)',
                      border: '1px solid #475569',
                      color: '#fff',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Đổi ảnh
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    style={{
                      background: 'rgba(127, 29, 29, 0.85)',
                      border: '1px solid #ef4444',
                      color: '#fca5a5',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notes / Reason */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Mô tả chi tiết lỗi & Nhận định nguyên nhân <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ví dụ: Lệch lớp trục Y tại layer 142 do vướng đầu phun; bung bàn góc trái do nhiệt độ bed..."
              rows={3}
              required
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#e2e8f0',
                fontSize: 13,
                padding: '8px 10px',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                background: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={uploading || !notes.trim()}
              style={{
                background: uploading || !notes.trim() ? '#451a1a' : '#b91c1c',
                color: '#fee2e2',
                border: 'none',
                borderRadius: 6,
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: uploading || !notes.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {uploading ? 'Đang tải lên…' : '✗ Xác nhận lỗi & Cách ly máy in'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
