import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfirm } from '../useConfirm';
import EmptyState from '../components/EmptyState';

// Colors match the Fleet page conventions: blue = printing, green = done.
// Cancelled gets a line-through as a non-color cue against Queued.
const JOB_STATUS = {
  queued:    { bg: '#f1f5f9', text: '#64748b', label: 'Chờ xếp lượt' },
  uploading: { bg: '#f5f3ff', text: '#7c3aed', label: 'Đang nạp file' },
  printing:  { bg: '#eff6ff', text: '#1d4ed8', label: 'Đang in' },
  awaiting:  { bg: '#ecfdf5', text: '#15803d', label: 'Chờ nghiệm thu' },
  finished:  { bg: '#ecfdf5', text: '#15803d', label: 'Hoàn thành' },
  failed:    { bg: '#fef2f2', text: '#da251d', label: 'Bản in lỗi' },
  cancelled: { bg: '#f1f5f9', text: '#94a3b8', label: 'Đã hủy', strike: true },
};

// The printer can be held (awaiting operator sign-off) while the job row is still
// 'printing' (e.g. a printer goes PRINTING -> IDLE directly between polls, with no
// observable FINISHED/STOPPED tick). The scheduler correctly holds the printer but has
// nothing to resolve the job against yet, so the row stays 'printing' until Set Ready
// or Bad Print is used. Display-only: never write this back as jobs.status.
function displayJobStatus(job) {
  if (job.status === 'printing' && job.printer_is_held === 1 && job.printer_status !== 'PRINTING') {
    return 'awaiting';
  }
  return job.status;
}

const STATUS_OPTIONS = ['all', 'queued', 'uploading', 'printing', 'finished', 'failed', 'cancelled'];

function formatTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startMs, endMs) {
  if (!startMs) return '—';
  const ms  = (endMs || Date.now()) - startMs;
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const selectSx = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '6px 12px',
  color: '#0f172a',
  fontSize: 13,
  outline: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

export default function Jobs() {
  const [confirm, confirmModal]   = useConfirm();
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [projects, setProjects]   = useState([]);
  const [printers, setPrinters]   = useState([]);

  // Filters live in the URL so they survive reloads and can be shared/bookmarked
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatus]   = useState(searchParams.get('status') || 'all');
  const [projectFilter, setProject] = useState(searchParams.get('project') || '');
  const [printerFilter, setPrinter] = useState(searchParams.get('printer') || '');

  useEffect(() => {
    const next = {};
    if (statusFilter !== 'all') next.status = statusFilter;
    if (projectFilter)          next.project = projectFilter;
    if (printerFilter)          next.printer = printerFilter;
    setSearchParams(next, { replace: true });
  }, [statusFilter, projectFilter, printerFilter, setSearchParams]);

  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter  !== 'all') params.set('status',     statusFilter);
    if (projectFilter)           params.set('project_id', projectFilter);
    if (printerFilter)           params.set('printer_id', printerFilter);

    try {
      const res  = await fetch(`/api/jobs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      setJobs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, projectFilter, printerFilter]);

  // Load filter option data once
  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
    fetch('/api/printers').then(r => r.json()).then(setPrinters).catch(() => {});
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  async function cancelJob(jobId) {
    const ok = await confirm({
      title: 'Hủy Lệnh In',
      message: 'Bạn có chắc chắn muốn xóa lệnh in này khỏi hàng đợi không?',
      confirmLabel: 'Hủy Lệnh',
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    fetchJobs();
  }

  return (
    <div>
      {confirmModal}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Hàng đợi Lệnh In (Job Queue)</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={statusFilter} onChange={(e) => setStatus(e.target.value)} style={selectSx}>
          <option value="all">Tất cả trạng thái</option>
          <option value="queued">Chờ xếp lượt (Queued)</option>
          <option value="uploading">Đang nạp file (Uploading)</option>
          <option value="printing">Đang in (Printing)</option>
          <option value="finished">Đã hoàn thành (Finished)</option>
          <option value="failed">Bản in lỗi (Failed)</option>
          <option value="cancelled">Đã hủy (Cancelled)</option>
        </select>

        <select value={projectFilter} onChange={(e) => setProject(e.target.value)} style={selectSx}>
          <option value="">Tất cả dự án</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select value={printerFilter} onChange={(e) => setPrinter(e.target.value)} style={selectSx}>
          <option value="">Tất cả máy in</option>
          {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <span style={{ color: '#64748b', fontSize: 13, marginLeft: 6, fontWeight: 600 }}>
          {jobs.length} lệnh in
        </span>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Đang tải danh sách lệnh in…</p>}
      {!loading && jobs.length === 0 && (
        statusFilter !== 'all' || projectFilter || printerFilter ? (
          <p style={{ color: '#64748b' }}>Không có lệnh in nào khớp với bộ lọc hiện tại.</p>
        ) : (
          <EmptyState
            title="Chưa có lệnh in nào"
            hint="Lệnh in sẽ được khởi tạo tự động khi một dự án ở trạng thái 'Đang chạy' và máy in tương thích đang rảnh rỗi."
            actionLabel="Xem danh sách dự án"
            actionTo="/projects"
          />
        )
      )}

      {/* Below 700px the table collapses to stacked cards */}
      <style>{`
        .jobs-cards { display: none; }
        @media (max-width: 700px) {
          .jobs-table-wrap { display: none; }
          .jobs-cards { display: flex; flex-direction: column; gap: 10px; }
        }
      `}</style>

      {jobs.length > 0 && (
        <div className="jobs-cards">
          {jobs.map(job => {
            const st = JOB_STATUS[displayJobStatus(job)] || { bg: '#f1f5f9', text: '#64748b', label: job.status };
            return (
              <div key={job.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#0f172a', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.part_name}</span>
                  <span style={{ background: st.bg, color: st.text, border: `1px solid ${st.text}30`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, textDecoration: st.strike ? 'line-through' : 'none' }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ color: '#475569', fontSize: 12, marginBottom: 4 }}>
                  {job.project_name} · {job.printer_name} <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>({job.printer_model})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12 }}>
                  <span>
                    {formatTime(job.started_at)}
                    {job.started_at && <> · {formatDuration(job.started_at, job.finished_at || null)}</>}
                  </span>
                  {job.status === 'queued' && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      style={{ background: '#fef2f2', color: '#da251d', border: '1px solid #fecaca', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Hủy lệnh
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="jobs-table-wrap" style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#475569', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>ID</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Chi tiết linh kiện</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Dự án</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Máy in</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Dòng máy</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Trạng thái</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Bắt đầu</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Thời lượng</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => {
                const st = JOB_STATUS[displayJobStatus(job)] || { bg: '#f1f5f9', text: '#64748b', label: job.status };
                return (
                  <tr
                    key={job.id}
                    style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}
                  >
                    <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>
                      #{job.id}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{job.part_name}</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{job.project_name}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{job.printer_name}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4,
                        padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', color: '#334155', fontWeight: 600,
                      }}>
                        {job.printer_model}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: st.bg, color: st.text, border: `1px solid ${st.text}30`, borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, textDecoration: st.strike ? 'line-through' : 'none' }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatTime(job.started_at)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>
                      {job.started_at
                        ? formatDuration(job.started_at, job.finished_at || null)
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {job.status === 'queued' && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          style={{
                            background: '#fef2f2', color: '#da251d', border: '1px solid #fecaca',
                            borderRadius: 4, padding: '4px 10px', fontSize: 12,
                            fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          Hủy lệnh
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
