import { useState, useEffect, useCallback, useRef } from 'react';
import PollTimer from '../components/PollTimer';

const POLL_INTERVAL_MS = 15000;

// ── Constants ────────────────────────────────────────────────────────────────

const CELL_COLORS = {
  PRINTING:  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  IDLE:      { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
  FINISHED:  { bg: '#ecfdf5', text: '#15803d', border: '#a7f3d0' },
  STOPPED:   { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  PAUSED:    { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  ATTENTION: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  ERROR:     { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  OFFLINE:   { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
};

const STAT_CARDS = [
  { key: 'printing',    label: 'Đang in (Printing)',    color: '#1d4ed8', accent: '#3b82f6' },
  { key: 'idle',        label: 'Sẵn sàng (Idle)',        color: '#475569', accent: '#94a3b8' },
  { key: 'awaiting',    label: 'Chờ nghiệm thu (Sign-off)', color: '#15803d', accent: '#22c55e', help: 'Bản in đã xong đang chờ nhân viên kiểm tra nghiệm thu/báo lỗi trước khi điều phối lệnh tiếp theo' },
  { key: 'parts_today', label: 'Sản lượng hôm nay', color: '#c2410c', accent: '#ea580c' },
];

const LEGEND_ITEMS = [
  { label: 'Đang in', color: '#2563eb' },
  { label: 'Chờ nghiệm thu', color: '#16a34a' },
  { label: 'Sẵn sàng',     color: '#64748b' },
  { label: 'Tạm dừng',  color: '#ea580c' },
  { label: 'Lỗi / Hỏng',    color: '#da251d' },
  { label: 'Mất kết nối',  color: '#94a3b8' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellColors(printer) {
  // Held printer (awaiting operator sign-off) renders as green regardless of status.
  // Keep this condition identical to Fleet.jsx and Printers.jsx (see CLAUDE.md sync pairs).
  if (printer.is_held === 1 && (printer.status === 'FINISHED' || printer.status === 'IDLE' || printer.status === 'STOPPED')) {
    return CELL_COLORS.FINISHED;
  }
  return CELL_COLORS[printer.status] || CELL_COLORS.IDLE;
}

function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(secs) {
  if (!secs) return null;
  const MINUTE = 60, HOUR = 3600, DAY = 86400, WEEK = 604800;
  if (secs >= WEEK) {
    const w = Math.floor(secs / WEEK);
    const d = Math.floor((secs % WEEK) / DAY);
    return d > 0 ? `${w}wk ${d}d` : `${w}wk`;
  }
  if (secs >= DAY) {
    const d = Math.floor(secs / DAY);
    const h = Math.floor((secs % DAY) / HOUR);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  const h = Math.floor(secs / HOUR);
  const m = Math.floor((secs % HOUR) / MINUTE);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function formatMaterial(grams) {
  if (grams == null) return null;
  if (grams < 1000) return `${Math.round(grams)}g`;
  const kg = (grams / 1000).toFixed(2).replace(/\.?0+$/, '');
  return `${kg}kg`;
}

// ── Row-level status summary badges for the fleet grid ───────────────────────

const ROW_STATUSES = ['PRINTING', 'FINISHED', 'IDLE', 'ERROR', 'STOPPED', 'OFFLINE'];

function RowSummary({ group }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
      {ROW_STATUSES.map(s => {
        const count = group.filter(p => {
          const isAwaiting = p.is_held === 1 && (p.status === 'FINISHED' || p.status === 'IDLE' || p.status === 'STOPPED');
          if (s === 'FINISHED') return isAwaiting;
          return p.status === s && !isAwaiting;
        }).length;
        if (count === 0) return null;
        const c = CELL_COLORS[s] || CELL_COLORS.IDLE;
        const label = s === 'FINISHED' ? 'AWAITING' : s;
        return (
          <span key={s} style={{
            fontSize: 10, color: c.text, background: c.bg,
            border: `1px solid ${c.border}`, borderRadius: 3,
            padding: '1px 6px', fontWeight: 700,
          }}>
            {count} {label}
          </span>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data,  setData]  = useState(null);
  const [clock, setClock] = useState(new Date());
  const [allModels, setAllModels] = useState([]);
  const [lastPolled, setLastPolled] = useState(null);
  const dashRef = useRef(null);

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(setAllModels).catch(() => {});
  }, []);

  // 1-second clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Data fetch — 15s poll, matches Fleet page
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        setData(await res.json());
        setLastPolled(Date.now());
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  function enterTV() {
    dashRef.current?.requestFullscreen?.();
  }

  if (!data) {
    return (
      <div style={{
        background: '#f8fafc', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 16, fontWeight: 600,
      }}>
        Đang tải dữ liệu Trung tâm điều hành…
      </div>
    );
  }

  const { stats, printers, active_projects, recent_activity } = data;

  // Group printers by model for the fleet grid
  const modelOrder = allModels.map(m => m.model_id);
  const MODEL_LABELS = Object.fromEntries(allModels.map(m => [m.model_id, m.label]));
  MODEL_LABELS.other = 'Other';
  const grouped = modelOrder.reduce((acc, m) => {
    const g = printers.filter(p => p.model === m);
    if (g.length) acc[m] = g;
    return acc;
  }, {});
  const others = printers.filter(p => !modelOrder.includes(p.model));
  if (others.length) grouped['other'] = others;

  const utilPct = printers.length > 0
    ? Math.round((stats.printing / printers.length) * 100)
    : 0;

  return (
    <div
      ref={dashRef}
      style={{
        background: '#f8fafc',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#0f172a',
        userSelect: 'none',
      }}
    >

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        padding: '0 28px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>

        {/* Left: branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 4, height: 38, background: '#da251d', borderRadius: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: '0.02em', color: '#0f172a' }}>
              3D VINCONS WINDOW
            </div>
            <div style={{ fontSize: 11, color: '#da251d', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginTop: 1 }}>
              Trung tâm Điều hành Sản xuất In 3D
            </div>
          </div>
        </div>

        {/* Center: utilization */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, background: '#f1f5f9', padding: '6px 16px', borderRadius: 20 }}>
          <span style={{ fontSize: 12, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700 }}>
            Hiệu suất vận hành:
          </span>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#da251d', fontVariantNumeric: 'tabular-nums' }}>
            {utilPct}%
          </span>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            ({stats.printing} / {printers.length} máy)
          </span>
        </div>

        {/* Right: clock + TV mode button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {formatTime(clock)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, fontWeight: 500 }}>
              {formatDate(clock)}
            </div>
          </div>
          <PollTimer lastPolled={lastPolled} intervalMs={POLL_INTERVAL_MS} size={28} />
          <button
            onClick={enterTV}
            title="Chế độ toàn màn hình TV giám sát"
            style={{
              background: '#f8fafc', color: '#334155',
              border: '1px solid #cbd5e1', borderRadius: 6,
              padding: '7px 14px', fontSize: 12, cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ⛶ Chế độ TV
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {STAT_CARDS.map(({ key, label, color, accent, help }) => (
            <div key={key} title={help} style={{
              background: '#ffffff', borderRadius: 10,
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 18,
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${accent}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                fontSize: 44, fontWeight: 800, color, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {(stats[key] ?? 0).toLocaleString()}
              </div>
              <div style={{
                fontSize: 11, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700,
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── FLEET GRID ──────────────────────────────────────────────────── */}
        <div style={{ background: '#ffffff', borderRadius: 10, padding: '18px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{
            fontSize: 12, color: '#0f172a',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800,
            marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Tổng quan Trạng thái Dàn máy In</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, textTransform: 'none' }}>
              Tổng cộng {printers.length} máy in
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(grouped).map(([model, group]) => (
              <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

                {/* Model label */}
                <div style={{ width: 84, flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 700 }}>
                    {MODEL_LABELS[model] || model}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>×{group.length} máy</div>
                </div>

                {/* Printer cells */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                  {group.map(printer => {
                    const c = cellColors(printer);
                    return (
                      <div
                        key={printer.id}
                        title={`${printer.name} — ${printer.status}`}
                        style={{
                          width: 56, height: 44, borderRadius: 6,
                          background: c.bg, border: `1px solid ${c.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                          cursor: 'default',
                        }}
                      >
                        <span style={{
                          fontFamily: 'monospace', fontSize: 10, color: c.text,
                          fontWeight: 700,
                          textAlign: 'center', padding: '0 3px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          width: '100%',
                        }}>
                          {printer.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Per-row status summary */}
                <RowSummary group={group} />
              </div>
            ))}
          </div>

          {/* Color legend */}
          <div style={{
            display: 'flex', gap: 20, marginTop: 16,
            paddingTop: 14, borderTop: '1px solid #f1f5f9',
            flexWrap: 'wrap',
          }}>
            {LEGEND_ITEMS.map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACTIVE PROJECTS ─────────────────────────────────────────────── */}
        <div style={{ background: '#ffffff', borderRadius: 10, padding: '18px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{
            fontSize: 12, color: '#0f172a',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800,
            marginBottom: 16,
          }}>
            Dự án Đang Sản xuất (Active Projects)
          </div>

          {active_projects.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13, margin: 0, padding: '16px 0', textAlign: 'center' }}>
              Chưa có dự án nào đang kích hoạt sản xuất. Bạn có thể kích hoạt dự án trong mục "Dự án".
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {active_projects.map(proj => {
                const hasStats = (proj.elapsed_secs > 0) || (proj.material_used_grams > 0);

                return (
                  <div key={proj.id} style={{
                    background: '#f8fafc', borderRadius: 8, padding: '14px 16px', border: '1px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{proj.name}</span>
                      <span style={{
                        background: '#ecfdf5', color: '#15803d', border: '1px solid #bbf7d0',
                        borderRadius: 3, padding: '1px 7px',
                        fontSize: 10, fontWeight: 700,
                      }}>
                        ĐANG SẢN XUẤT
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {proj.parts.map(part => {
                        const activeQty    = part.active_qty || 0;
                        const scale        = Math.max(part.target_qty, part.completed_qty + activeQty);
                        const completedPct = scale > 0 ? (part.completed_qty / scale) * 100 : 0;
                        const activePct    = scale > 0 ? (activeQty / scale) * 100 : 0;
                        const isOver       = part.completed_qty + activeQty > part.target_qty;
                        const targetTickPct = isOver && scale > 0 ? (part.target_qty / scale) * 100 : null;
                        const pct = part.target_qty > 0
                          ? Math.round((part.completed_qty / part.target_qty) * 100)
                          : 0;
                        return (
                          <div key={part.id}>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              marginBottom: 4,
                            }}>
                              <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{part.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{part.completed_qty.toLocaleString()}</span>
                                  {activeQty > 0 && (
                                    <span style={{ color: '#2563eb' }}> +{activeQty.toLocaleString()}</span>
                                  )}
                                  <span style={{ color: '#64748b' }}>{' / '}{part.target_qty.toLocaleString()}</span>
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: part.status === 'closed' ? '#16a34a' : '#2563eb', minWidth: 34, textAlign: 'right' }}>
                                  {pct}%
                                </span>
                                {part.status === 'closed' && (
                                  <span style={{
                                    background: '#ecfdf5', color: '#15803d',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: 3, padding: '1px 5px',
                                    fontSize: 9, fontWeight: 700,
                                  }}>
                                    HOÀN TẤT
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ position: 'relative', background: '#e2e8f0', borderRadius: 4, height: 9 }}>
                              <div style={{
                                position: 'absolute', left: 0, top: 0, height: '100%',
                                width: `${completedPct}%`,
                                background: '#16a34a',
                                borderRadius: activePct > 0 ? '4px 0 0 4px' : 4,
                                transition: 'width 0.5s',
                              }} />
                              {activePct > 0 && (
                                <div style={{
                                  position: 'absolute', left: `${completedPct}%`, top: 0, height: '100%',
                                  width: `${activePct}%`,
                                  background: '#2563eb',
                                  borderRadius: '0 4px 4px 0',
                                  transition: 'width 0.5s',
                                }} />
                              )}
                              {targetTickPct !== null && (
                                <div style={{
                                  position: 'absolute', left: `${targetTickPct}%`, top: 0,
                                  width: 2, height: '100%',
                                  background: '#ea580c',
                                  transform: 'translateX(-50%)',
                                }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasStats && (
                      <div style={{
                        borderTop: '1px solid #e2e8f0', marginTop: 10, paddingTop: 8,
                        display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontWeight: 700, color: '#475569' }}>Thống kê:</span>
                        <span style={{ color: '#cbd5e1' }}>·</span>
                        {proj.elapsed_secs > 0 && (
                          <span style={{ color: '#64748b' }}>Thời gian: {formatDuration(proj.elapsed_secs)}</span>
                        )}
                        {proj.elapsed_secs > 0 && proj.material_used_grams > 0 && (
                          <span style={{ color: '#cbd5e1' }}>·</span>
                        )}
                        {proj.material_used_grams > 0 && (
                          <span style={{ color: '#7c3aed', fontWeight: 600 }}>Vật liệu: {formatMaterial(proj.material_used_grams)}</span>
                        )}
                        {proj.model_breakdown && proj.model_breakdown.length > 1 && (
                          <>
                            <span style={{ color: '#cbd5e1' }}>·</span>
                            <span style={{ color: '#64748b' }}>
                              Dòng máy: {proj.model_breakdown.map(m => m.printer_model).join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


