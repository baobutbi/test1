import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PollTimer from '../components/PollTimer';
import EmptyState from '../components/EmptyState';
import { useConfirm } from '../useConfirm';
import { useToast } from '../useToast';
import { useAuth } from '../AuthContext';
import FailModal from '../components/FailModal';

const STATUS_COLORS = {
  PRINTING:   { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', label: 'Đang in' },
  UPLOADING:  { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff', label: 'Đang tải file' },
  IDLE:       { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', label: 'Sẵn sàng' },
  READY:      { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: 'Sẵn sàng' },
  FINISHED:   { bg: '#ecfdf5', text: '#15803d', border: '#a7f3d0', label: 'Đã xong' },
  STOPPED:    { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', label: 'Tạm dừng' },
  PAUSED:     { bg: '#fffbeb', text: '#b45309', border: '#fde68a', label: 'Tạm ngưng' },
  ATTENTION:  { bg: '#fffbeb', text: '#b45309', border: '#fde68a', label: 'Chú ý' },
  ERROR:      { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'Lỗi' },
  OFFLINE:    { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', label: 'Mất kết nối' },
  UNKNOWN:    { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', label: 'Chưa rõ' },
};

const KNOWN_STATUSES = new Set(Object.keys(STATUS_COLORS));

function statusStyle(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.UNKNOWN;
}

// What the card should say. The hardware still reports IDLE/FINISHED while the
// scheduler transfers a file, so a healthy in-flight upload displays as UPLOADING.
// Held + uploading is a FAILED upload — that keeps its hardware status so the
// existing confirmation flow renders unchanged. This is display-only; it never
// feeds back into printers.status.
function displayStatus(p) {
  if (p.has_uploading_job === 1 && p.is_held === 0 && p.status !== 'PRINTING') return 'UPLOADING';
  return p.status;
}

function formatTimeRemaining(secs) {
  if (secs == null || secs < 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return '< 1m left';
}

// Wall-clock finish time — "done 3:45 PM", with a day marker if it rolls past midnight
function formatEta(secs) {
  if (secs == null || secs < 0) return null;
  const eta = new Date(Date.now() + secs * 1000);
  const time = eta.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const days = Math.floor((eta - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
  if (days === 1) return `done ${time} tomorrow`;
  if (days > 1) return `done ${eta.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
  return `done ${time}`;
}

function PrinterCard({ printer, selected, onToggleSelect, onSetReady, onBadPrint, onUploadFailed, onDecommission, onLinkJob, onOpenDetail, canOperate, canReportFailure, canManagePrinters }) {
  const shownStatus = displayStatus(printer);
  const style = statusStyle(shownStatus);
  const isUploading = shownStatus === 'UPLOADING';

  // Confirmed-qty input — pre-filled from the last finished job's parts_per_plate.
  // Only shown when is_held and we know how many parts were on the plate.
  // STOPPED means the operator deliberately stopped the print mid-way, so the safe
  // default is 0 good parts — crediting a stopped plate must be an explicit choice.
  const [confirmedQty, setConfirmedQty] = useState(
    printer.status === 'STOPPED' ? '0'
      : printer.last_parts_per_plate != null ? String(printer.last_parts_per_plate) : ''
  );
  useEffect(() => {
    if (printer.status === 'STOPPED') {
      setConfirmedQty('0');
    } else if (printer.last_parts_per_plate != null) {
      setConfirmedQty(String(printer.last_parts_per_plate));
    }
  }, [printer.last_parts_per_plate, printer.status]);

  // Partial failure — operator has reduced the good-qty below the full plate count.
  // Batch set-ready credits full parts_per_plate, so this printer must be confirmed
  // individually. Auto-remove from the batch selection if it was already checked.
  const isPartial = printer.last_parts_per_plate != null
    && !isNaN(parseInt(confirmedQty, 10))
    && parseInt(confirmedQty, 10) < printer.last_parts_per_plate;
  useEffect(() => {
    if (isPartial && selected) onToggleSelect(printer.id);
  }, [isPartial]); // eslint-disable-line react-hooks/exhaustive-deps
  // Show confirmation buttons only when there's something to inspect.
  // A printer that is actively printing is held-in-advance — it will need sign-off
  // when it finishes, but there is nothing to confirm right now.
  // STOPPED is included: some printers (Bambu) latch the stopped state until the next
  // print starts, with nothing to acknowledge on the printer screen — the only way out
  // is confirming here so the farm dispatches a new job.
  const needsConfirmation = printer.is_held === 1
    && (printer.status === 'FINISHED' || printer.status === 'IDLE' || printer.status === 'STOPPED');
  // OFFLINE with an active job: printer dropped off network but job may still be running.
  // Operator can confirm the job is OK (green = resume) or declare it failed (red).
  // If the printer comes back PRINTING on its own, the hold is released automatically.
  const needsOfflineConfirmation = printer.is_held === 1 && printer.status === 'OFFLINE' && printer.has_active_job === 1;
  // Upload stalled: all retries exhausted but printer is not confirmed printing or idle.
  // Operator must check the machine and confirm whether the print is running or not.
  const needsUploadConfirmation = printer.is_held === 1 && printer.has_uploading_job === 1 && printer.status !== 'OFFLINE';
  const isPrinting = printer.status === 'PRINTING';
  const pct = isPrinting && printer.job_progress != null ? Math.round(printer.job_progress) : null;
  const timeLeft = isPrinting ? formatTimeRemaining(printer.job_time_remaining) : null;
  const eta      = isPrinting ? formatEta(printer.job_time_remaining) : null;

  function cardBorder() {
    if (selected) return '#da251d';
    if (needsOfflineConfirmation || needsUploadConfirmation) return '#fde68a';
    if (needsConfirmation) return '#bbf7d0';
    return '#e2e8f0';
  }

  return (
    <div
      onClick={(needsConfirmation && !needsUploadConfirmation) ? () => onToggleSelect(printer.id) : () => onOpenDetail(printer.id)}
      title={(needsConfirmation && !needsUploadConfirmation) ? (selected ? 'Click để bỏ chọn' : 'Click để chọn xác nhận Set Ready hàng loạt') : 'Click để xem chi tiết máy in'}
      style={{
        background: (needsOfflineConfirmation || needsUploadConfirmation) ? '#fffbeb' : needsConfirmation ? '#f0fdf4' : '#ffffff',
        border: `${selected ? '2px' : '1px'} solid ${cardBorder()}`,
        borderRadius: 8,
        padding: selected ? '11px 13px' : '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 2px rgba(218, 37, 29, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Name + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {printer.name}
        </span>
        <span style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {style.label}
        </span>
      </div>

      {/* Model + group */}
      <div style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 3, padding: '1px 6px', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
          {printer.model}
        </span>
        {printer.group_name && <span style={{ color: '#64748b' }}>{printer.group_name}</span>}
        {(printer.loaded_material || printer.loaded_color) && (
          <span style={{ color: '#0284c7', fontSize: 11, fontWeight: 600 }}>
            {[printer.loaded_material, printer.loaded_color].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>

      {/* Upload in progress — file is being transferred to the printer */}
      {isUploading && (
        <div style={{ marginTop: 2 }}>
          {printer.uploading_job_name && (
            <div style={{
              fontSize: 11, color: '#64748b', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 5,
            }}>
              {printer.uploading_job_name}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#7e22ce', fontWeight: 600 }}>
            Đang nạp file gcode xuống máy in…
          </div>
        </div>
      )}

      {/* Print job info — only when printing */}
      {isPrinting && (
        <div style={{ marginTop: 2 }}>
          {printer.job_name && (
            <div style={{
              fontSize: 11, color: '#475569', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 5,
            }}>
              {printer.job_name}
            </div>
          )}
          <div style={{ background: '#e2e8f0', borderRadius: 3, height: 8, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{
              background: '#2563eb',
              height: '100%',
              width: `${pct ?? 0}%`,
              borderRadius: 3,
              transition: 'width 0.5s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
            <span style={{ fontWeight: 700, color: '#2563eb' }}>{pct != null ? `${pct}%` : '—'}</span>
            {timeLeft && (
              <span>
                {timeLeft}
                {eta && <span style={{ color: '#94a3b8' }}> · {eta}</span>}
              </span>
            )}
          </div>
        </div>
      )}

      {printer.status === 'STOPPED' && (
        <div style={{ fontSize: 11, color: '#c2410c', marginTop: 4 }}>
          {needsConfirmation
            ? 'Máy in bị dừng giữa chừng — xác nhận nghiệm thu bên dưới để tiếp tục'
            : 'Máy in dừng — sẽ tự phục hồi khi có lệnh in tiếp theo'}
        </div>
      )}

      {needsConfirmation && !needsUploadConfirmation && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {printer.last_parts_per_plate != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Đạt:</span>
              <input
                type="number"
                min={0}
                max={printer.last_parts_per_plate}
                value={confirmedQty}
                onChange={e => setConfirmedQty(e.target.value)}
                style={{
                  width: 46, background: '#ffffff', border: '1px solid #cbd5e1',
                  borderRadius: 3, padding: '2px 5px', color: '#0f172a', fontSize: 12,
                  textAlign: 'center', fontWeight: 700,
                }}
              />
              <span style={{ fontSize: 11, color: '#64748b' }}>/ {printer.last_parts_per_plate} cái</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onSetReady(printer.id, printer.last_parts_per_plate != null ? parseInt(confirmedQty, 10) : null)}
              disabled={!canOperate}
              title={canOperate ? "Xác nhận bản in tốt — cộng sản lượng và giải phóng máy in" : "Bạn không có quyền Set Ready (Cần quyền Vận hành trở lên)"}
              style={{
                flex: 1,
                background: canOperate ? '#16a34a' : '#f1f5f9',
                color: canOperate ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 12,
                fontWeight: 700,
                cursor: canOperate ? 'pointer' : 'not-allowed'
              }}
            >
              ✓ Set Ready
            </button>
            <button
              onClick={() => onBadPrint(printer.id)}
              disabled={!canReportFailure}
              title={canReportFailure ? "Báo lỗi bản in & chụp/upload ảnh lỗi thực tế" : "Bạn không có quyền báo lỗi bản in"}
              style={{
                flex: 1,
                background: canReportFailure ? '#da251d' : '#f1f5f9',
                color: canReportFailure ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 12,
                fontWeight: 700,
                cursor: canReportFailure ? 'pointer' : 'not-allowed'
              }}
            >
              ✗ Báo lỗi in
            </button>
          </div>
        </div>
      )}

      {needsOfflineConfirmation && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#b45309', marginBottom: 6 }}>
            Mất kết nối khi đang in dở. Nếu máy kết nối lại và in, cảnh báo này sẽ tự tắt.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onSetReady(printer.id, null)}
              disabled={!canOperate}
              style={{
                flex: 1,
                background: canOperate ? '#16a34a' : '#f1f5f9',
                color: canOperate ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 12,
                fontWeight: 700,
                cursor: canOperate ? 'pointer' : 'not-allowed'
              }}
            >
              ✓ In thành công
            </button>
            <button
              onClick={() => onBadPrint(printer.id)}
              disabled={!canReportFailure}
              style={{
                flex: 1,
                background: canReportFailure ? '#da251d' : '#f1f5f9',
                color: canReportFailure ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 12,
                fontWeight: 700,
                cursor: canReportFailure ? 'pointer' : 'not-allowed'
              }}
            >
              ✗ Báo lỗi in
            </button>
          </div>
        </div>
      )}

      {needsUploadConfirmation && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#b45309', marginBottom: 6 }}>
            {(printer.status === 'FINISHED' || printer.status === 'IDLE')
              ? 'Tải file lỗi — máy báo đã xong. Bản in có thành công không?'
              : 'Tải file lỗi sau nhiều lần thử — kiểm tra máy xem có đang in không?'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => (printer.status === 'FINISHED' || printer.status === 'IDLE')
                ? onSetReady(printer.id, null)
                : onLinkJob(printer.id, true)}
              disabled={!canOperate}
              style={{
                flex: 1,
                background: canOperate ? '#16a34a' : '#f1f5f9',
                color: canOperate ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 12,
                fontWeight: 700,
                cursor: canOperate ? 'pointer' : 'not-allowed'
              }}
            >
              {(printer.status === 'FINISHED' || printer.status === 'IDLE') ? '✓ Set Ready' : '✓ Máy đang in'}
            </button>
            <button
              onClick={() => onUploadFailed(printer.id)}
              disabled={!canReportFailure}
              style={{
                flex: 1,
                background: canReportFailure ? '#da251d' : '#f1f5f9',
                color: canReportFailure ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '5px 0',
                fontSize: 12,
                fontWeight: 700,
                cursor: canReportFailure ? 'pointer' : 'not-allowed'
              }}
            >
              ✗ Tải thất bại
            </button>
          </div>
        </div>
      )}

      {isPrinting && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4, display: 'flex', gap: 6 }}>
          {canReportFailure && (
            <button
              onClick={() => onBadPrint(printer.id)}
              title="Phát hiện bản in lỗi trong lúc in (rối sợi, lệch lớp, bung bàn) — Báo lỗi & Chụp ảnh lỗi"
              style={{
                flex: 1,
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <span>📸</span> Báo lỗi in
            </button>
          )}
          {printer.has_printing_job === 0 && (
            <button
              onClick={() => onLinkJob(printer.id, false)}
              title="Stalled upload? Gán lệnh in đã có cho máy"
              style={{ background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
            >
              Link Job
            </button>
          )}
        </div>
      )}

      {!isPrinting && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
          {!needsConfirmation && canReportFailure && (
            <button
              onClick={() => onBadPrint(printer.id)}
              title="Báo lỗi bản in gần nhất trên máy này & Tải ảnh lỗi KCS"
              style={{
                background: '#ffffff',
                color: '#da251d',
                border: '1px solid #fecaca',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>📸</span> Báo lỗi
            </button>
          )}
          {canManagePrinters && (
            <button
              onClick={() => onDecommission(printer.id, (needsConfirmation && printer.last_parts_per_plate != null) ? parseInt(confirmedQty, 10) : null)}
              style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', marginLeft: 'auto', fontWeight: 600 }}
            >
              Bảo trì
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Fleet() {
  const navigate                              = useNavigate();
  const { user, canOperate, canReportFailure, canManagePrinters, isDirector, isQC, isPostProcessing } = useAuth();
  const [confirm, confirmModal]               = useConfirm();
  const [showToast, toastEl]                  = useToast();
  const [printers, setPrinters]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [filter, setFilter]                   = useState('ALL');
  const [search, setSearch]                   = useState('');
  const [selectedForReady, setSelectedForReady] = useState(new Set());
  const [lastPolled, setLastPolled]           = useState(null);
  const [allModels, setAllModels]             = useState([]);
  // { printerId, printerName, jobs, selectedJobId, isHeld }
  const [linkJobModal, setLinkJobModal]       = useState(null);
  // Printer currently being reported for bad print / failure photo upload
  const [failModalPrinter, setFailModalPrinter] = useState(null);

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(setAllModels).catch(() => {});
  }, []);

  const fetchPrinters = useCallback(async () => {
    try {
      const res = await fetch('/api/printers');
      if (!res.ok) throw new Error('Failed to fetch printers');
      const data = await res.json();
      setPrinters(data);
      setLastPolled(Date.now());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrinters();
    const interval = setInterval(fetchPrinters, 15000);
    return () => clearInterval(interval);
  }, [fetchPrinters]);

  // Printers awaiting operator confirmation — excludes those currently printing (hold is pre-set for when they finish)
  const awaitingConfirmation = printers.filter(p => p.is_held === 1 && (p.status === 'FINISHED' || p.status === 'IDLE') && p.has_uploading_job === 0);
  const awaitingOfflineReview = printers.filter(p => p.is_held === 1 && p.status === 'OFFLINE' && p.has_active_job === 1);
  const awaitingUploadReview = printers.filter(p => p.is_held === 1 && p.has_uploading_job === 1 && p.status !== 'OFFLINE');

  function toggleSelect(printerId) {
    setSelectedForReady(prev => {
      const next = new Set(prev);
      next.has(printerId) ? next.delete(printerId) : next.add(printerId);
      return next;
    });
  }

  function selectAll() {
    setSelectedForReady(new Set(awaitingConfirmation.map(p => p.id)));
  }

  function deselectAll() {
    setSelectedForReady(new Set());
  }

  async function setReady(printerId, confirmedQty) {
    const res = await fetch(`/api/printers/${printerId}/set-ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirmedQty != null ? { confirmed_qty: confirmedQty } : {}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(`Set Ready failed: ${body.error || res.status}`, 'error');
      return;
    }
    setSelectedForReady(prev => { const next = new Set(prev); next.delete(printerId); return next; });
    fetchPrinters();
  }

  async function setReadyForSelected() {
    const res = await fetch('/api/printers/set-ready-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedForReady] }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(`Batch Set Ready failed: ${body.error || res.status}`, 'error');
      return;
    }
    setSelectedForReady(new Set());
    fetchPrinters();
  }

  async function openLinkJobModal(printerId, isHeld) {
    const printer = printers.find(p => p.id === printerId);
    const res = await fetch(`/api/printers/${printerId}/linkable-jobs`);
    const jobs = await res.json();

    // Pre-select this printer's own stalled uploading job if present, otherwise
    // fall back to the only candidate if there's just one.
    const ownStalled = jobs.find(j => j.original_printer_id === printerId && j.status === 'uploading');
    const preselect = ownStalled ? ownStalled.id : (jobs.length === 1 ? jobs[0].id : null);

    setLinkJobModal({
      printerId,
      printerName: printer?.name ?? `Printer ${printerId}`,
      jobs,
      selectedJobId: preselect,
      isHeld,
    });
  }

  async function submitLinkJob() {
    const { printerId, selectedJobId, isHeld } = linkJobModal;
    setLinkJobModal(null);

    if (selectedJobId) {
      const res = await fetch(`/api/printers/${printerId}/link-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: selectedJobId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`Failed to link job: ${body.error || res.status}`, 'error');
      }
    } else if (isHeld) {
      // No job selected — just release the hold
      await fetch(`/api/printers/${printerId}/set-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }

    fetchPrinters();
  }

  async function decommission(printerId, confirmedQty = null) {
    const printer = printers.find(p => p.id === printerId);

    // A held printer has a print outcome pending sign-off (the green/red "Set Ready /
    // Bad Print" buttons), and a printer with an uploading/printing job has work in
    // flight. Either way the outcome must be resolved before the machine leaves the
    // fleet — a normally-FINISHED printer awaiting confirmation has has_active_job=false
    // (its job is already 'finished'), so the hold is what flags the pending sign-off.
    const awaitingSignoff = printer?.has_active_job || printer?.is_held === 1;

    if (!awaitingSignoff) {
      // No outcome to resolve — just collect a note and decommission directly
      const result = await confirm({
        title: `Decommission ${printer?.name}`,
        message: 'This machine will be removed from the active fleet and will require a manual recommission before running again.',
        cancelLabel: 'Cancel',
        prompt: 'Reason for decommissioning',
        promptRequired: true,
        actions: [
          { label: 'Decommission', value: 'decommission', variant: 'danger' },
        ],
      });
      if (!result) return;
      const { text: reason } = result;
      const res = await fetch(`/api/printers/${printerId}/decommission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`Decommission failed: ${body.error || res.status}`, 'error');
      }
      fetchPrinters();
      return;
    }

    // Print outcome pending (active job or held for sign-off) — resolve it first
    const result = await confirm({
      title: `Decommission ${printer?.name}`,
      message: 'Was the last print successful?\n\nThis machine will be removed from the active fleet and will require a manual recommission before running again.',
      cancelLabel: 'Cancel',
      prompt: 'Reason for decommissioning',
      promptRequired: true,
      actions: [
        { label: 'Print succeeded — credit & decommission', value: 'success', variant: 'success' },
        { label: 'Print failed — discard & decommission',   value: 'failure', variant: 'danger'  },
      ],
    });
    if (!result) return;
    const { value: choice, text: reason } = result;

    if (choice === 'failure') {
      const printer = printers.find(p => p.id === printerId);
      if (printer) {
        setFailModalPrinter(printer);
      }
      return;
    }

    // choice === 'success' — forward the operator's good-part count (if adjusted) so the
    // credit matches what Set Ready would have applied, then decommission instead of re-queue.
    const res = await fetch(`/api/printers/${printerId}/complete-and-decommission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: reason, confirmed_qty: (confirmedQty != null && !isNaN(confirmedQty)) ? confirmedQty : null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(`Decommission failed: ${body.error || res.status}`, 'error');
    }
    fetchPrinters();
  }

  function badPrint(printerId) {
    if (!canReportFailure) {
      showToast('Tài khoản của bạn không có quyền báo lỗi bản in.', 'error');
      return;
    }
    const printer = printers.find(p => p.id === printerId);
    if (printer) {
      setFailModalPrinter(printer);
    }
  }

  function uploadFailed(printerId) {
    if (!canReportFailure) {
      showToast('Tài khoản của bạn không có quyền báo lỗi bản in.', 'error');
      return;
    }
    const printer = printers.find(p => p.id === printerId);
    if (printer) {
      setFailModalPrinter(printer);
    }
  }

  async function handleFailModalSubmit({ printerId, category, notes, photoUrl, operatorName }) {
    const res = await fetch(`/api/printers/${printerId}/mark-job-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: notes,
        failure_category: category,
        photo_url: photoUrl,
        operator_name: operatorName || user?.display_name || user?.username,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(`Báo lỗi thất bại: ${body.error || res.status}`, 'error');
    } else {
      showToast('Đã lưu ảnh lỗi, hoàn sản lượng và đưa máy về trạng thái kiểm tra!', 'success');
      setSelectedForReady(prev => { const next = new Set(prev); next.delete(printerId); return next; });
    }
    fetchPrinters();
  }

  const counts = printers.reduce((acc, p) => {
    const s = displayStatus(p);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const hasUnknown = printers.some(p => !KNOWN_STATUSES.has(p.status));

  const filtered = printers.filter((p) => {
    if (filter === 'UNKNOWN') return !KNOWN_STATUSES.has(p.status);
    if (filter !== 'ALL' && displayStatus(p) !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.ip.includes(search) && !(p.group_name || '').toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Group by model — order and labels come from the DB via /api/models
  const modelOrder  = allModels.map(m => m.model_id);
  const MODEL_LABELS = Object.fromEntries(allModels.map(m => [m.model_id, m.label]));
  MODEL_LABELS.other = 'Other';

  const grouped = modelOrder.reduce((acc, model) => {
    const group = filtered.filter((p) => p.model === model);
    if (group.length > 0) acc[model] = group;
    return acc;
  }, {});
  const otherModels = filtered.filter((p) => !modelOrder.includes(p.model));
  if (otherModels.length > 0) grouped['other'] = otherModels;

  async function sweep() {
    await fetch('/api/scheduler/dispatch', { method: 'POST' });
    fetchPrinters();
  }

  return (
    <div>
      {confirmModal}
      {toastEl}

      {linkJobModal && (
        <div
          onClick={() => setLinkJobModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#0f172a' }}>Liên kết lệnh in — {linkJobModal.printerName}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Chọn lệnh in thực tế đang chạy trên máy này.
            </div>

            {linkJobModal.jobs.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0' }}>
                Không tìm thấy lệnh in nào bị lỗi hoặc dừng cho dòng máy này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {linkJobModal.jobs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => setLinkJobModal(m => ({ ...m, selectedJobId: job.id }))}
                    style={{
                      background: linkJobModal.selectedJobId === job.id ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${linkJobModal.selectedJobId === job.id ? '#3b82f6' : '#e2e8f0'}`,
                      borderRadius: 6,
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: '#0f172a' }}>{job.part_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 4 }}>{job.gcode_filename}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      Job #{job.id} · {job.status}
                      {job.original_printer_name ? ` · máy cũ ${job.original_printer_name}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setLinkJobModal(null)}
                style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >
                Hủy bỏ
              </button>
              {linkJobModal.isHeld && !linkJobModal.selectedJobId && (
                <button
                  onClick={submitLinkJob}
                  style={{ background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Giải phóng máy
                </button>
              )}
              {linkJobModal.selectedJobId && (
                <button
                  onClick={submitLinkJob}
                  style={{ background: '#da251d', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Liên kết lệnh in
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#0f172a' }}>Giám sát Dàn máy in (Fleet)</h1>
          <PollTimer lastPolled={lastPolled} intervalMs={15000} />
        </div>
        <button
          onClick={sweep}
          title="Kích hoạt phân bổ lệnh in ngay lập tức"
          style={{ background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          🔄 Quét & Điều phối lệnh in
        </button>
      </div>

      {/* Offline-with-job banner */}
      {awaitingOfflineReview.length > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ color: '#b45309', fontWeight: 700, fontSize: 14 }}>
            ⚠️ {awaitingOfflineReview.length} máy in mất kết nối khi đang in dở
          </span>
          <span style={{ color: '#92400e', fontSize: 13 }}>
            — hệ thống sẽ tự xóa cảnh báo nếu máy kết nối lại và in tiếp
          </span>
        </div>
      )}

      {/* Upload-stalled banner */}
      {awaitingUploadReview.length > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ color: '#b45309', fontWeight: 700, fontSize: 14 }}>
            ⚠️ {awaitingUploadReview.length} máy in gặp sự cố nạp file — vui lòng kiểm tra trực tiếp máy
          </span>
        </div>
      )}

      {/* Confirmation banner */}
      {awaitingConfirmation.length > 0 && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ color: '#15803d', fontWeight: 700, fontSize: 14 }}>
            ✓ {awaitingConfirmation.length} máy in đang chờ xác nhận nghiệm thu
          </span>
          <button
            onClick={selectAll}
            style={{ background: '#ffffff', color: '#15803d', border: '1px solid #86efac', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Chọn tất cả
          </button>
          {selectedForReady.size > 0 && (
            <>
              <button
                onClick={deselectAll}
                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                Bỏ chọn
              </button>
              <button
                onClick={setReadyForSelected}
                style={{ background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: 4, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                ✓ Xác nhận Set Ready ({selectedForReady.size})
              </button>
            </>
          )}
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { key: 'ALL',      count: printers.length,        label: `Tất cả (${printers.length})`,             color: '#64748b' },
          { key: 'PRINTING', count: counts.PRINTING || 0,   label: `Đang in (${counts.PRINTING || 0})`,   color: STATUS_COLORS.PRINTING.text },
          { key: 'UPLOADING',count: counts.UPLOADING || 0,  label: `Đang nạp file (${counts.UPLOADING || 0})`, color: STATUS_COLORS.UPLOADING.text },
          { key: 'IDLE',     count: counts.IDLE || 0,       label: `Sẵn sàng (${counts.IDLE || 0})`,           color: STATUS_COLORS.IDLE.text },
          { key: 'FINISHED', count: counts.FINISHED || 0,   label: `Đã xong (${counts.FINISHED || 0})`,   color: STATUS_COLORS.FINISHED.text },
          { key: 'STOPPED',  count: counts.STOPPED || 0,    label: `Tạm dừng (${counts.STOPPED || 0})`,     color: STATUS_COLORS.STOPPED.text },
          { key: 'ERROR',    count: counts.ERROR || 0,      label: `Lỗi (${counts.ERROR || 0})`,         color: STATUS_COLORS.ERROR.text },
          { key: 'ATTENTION',count: counts.ATTENTION || 0,  label: `Cần chú ý (${counts.ATTENTION || 0})`, color: STATUS_COLORS.ATTENTION.text },
          { key: 'OFFLINE',  count: counts.OFFLINE || 0,    label: `Mất kết nối (${counts.OFFLINE || 0})`,     color: STATUS_COLORS.OFFLINE.text },
          ...(hasUnknown ? [{ key: 'UNKNOWN', count: 1, label: `Chưa rõ (${printers.filter(p => !KNOWN_STATUSES.has(p.status)).length})`, color: STATUS_COLORS.UNKNOWN.text }] : []),
        // Zero-count chips are noise — hide them unless that filter is currently active
        ].filter(({ key, count }) => key === 'ALL' || count > 0 || filter === key)
         .map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              background: filter === key ? '#da251d' : '#ffffff',
              color: filter === key ? '#ffffff' : color,
              border: `1px solid ${filter === key ? '#da251d' : '#e2e8f0'}`,
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: filter === key ? 700 : 600,
              boxShadow: filter === key ? '0 2px 4px rgba(218, 37, 29, 0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            {label}
          </button>
        ))}
        <input
          type="text"
          placeholder="Tìm tên máy / IP / cụm máy…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 20,
            padding: '4px 14px',
            color: '#0f172a',
            fontSize: 13,
            outline: 'none',
            flex: '1 1 180px',
            maxWidth: 280,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        />
      </div>

      {loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100 }} />
          ))}
        </div>
      )}
      {error && <p style={{ color: '#f87171' }}>Error: {error}</p>}
      {!loading && printers.length === 0 && (
        <EmptyState
          title="No printers yet"
          hint="Your fleet will appear here as live status cards. Add printers one at a time or import your whole farm from a CSV — both are on the Settings page."
          actionLabel="Go to Settings"
          actionTo="/settings"
        />
      )}

      {Object.entries(grouped).map(([model, group]) => (
        <div key={model} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            {MODEL_LABELS[model] || model} <span style={{ fontWeight: 600, color: '#64748b' }}>({group.length})</span>
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}>
            {group.map((printer) => (
              <PrinterCard
                key={printer.id}
                printer={printer}
                selected={selectedForReady.has(printer.id)}
                onToggleSelect={toggleSelect}
                onSetReady={setReady}
                onBadPrint={badPrint}
                onUploadFailed={uploadFailed}
                onDecommission={decommission}
                onLinkJob={openLinkJobModal}
                onOpenDetail={(id) => navigate(`/printers/${id}`)}
                canOperate={canOperate}
                canReportFailure={canReportFailure}
                canManagePrinters={canManagePrinters}
              />
            ))}
          </div>
        </div>
      ))}

      {failModalPrinter && (
        <FailModal
          isOpen={!!failModalPrinter}
          printer={failModalPrinter}
          operatorName={user?.display_name || user?.username}
          onClose={() => setFailModalPrinter(null)}
          onSubmit={handleFailModalSubmit}
        />
      )}
    </div>
  );
}
