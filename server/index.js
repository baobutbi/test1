// Catch unhandled errors before anything else so they're always logged,
// even if Node exits before stdout is flushed (common on Windows).
process.on('uncaughtException', (err) => {
  process.stderr.write(`[FATAL] uncaughtException: ${err.stack || err}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[FATAL] unhandledRejection: ${reason?.stack || reason}\n`);
  process.exit(1);
});

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const { initDb }      = require('./db');
const PrinterPoller  = require('./poller');
const JobScheduler   = require('./scheduler');
const notifications  = require('./notifications');
const events         = require('./events');
const backup         = require('./backup');

const app  = express();

// Detect whether running in cloud preview sandbox (fixed port 3000) or locally on user machine
const isCloudSandbox = Boolean(process.env.APPLET_ID || process.env.DEFAULT_APP_PORT);
// On user's local machine, defaults to 3001 (or process.env.PORT / process.env.APP_PORT), avoiding conflict with port 3000
const PORT = isCloudSandbox
  ? 3000
  : (process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3001));

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
const failuresDir = path.join(uploadsDir, 'failures');
if (!fs.existsSync(failuresDir)) {
  fs.mkdirSync(failuresDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Server notifications — surfaced in the Settings UI
app.get('/api/notifications', (_req, res) => res.json(notifications.list()));
app.delete('/api/notifications/:id', (req, res) => {
  const ok = notifications.dismiss(parseInt(req.params.id, 10));
  if (!ok) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ok: true });
});

let serverInstance = null;

async function startServer() {
  if (!isCloudSandbox) {
    // When running locally outside cloud sandbox, default to real hardware mode (DEMO_MODE=false)
    if (process.env.DEMO_MODE === undefined || process.env.DEMO_MODE === 'false' || process.env.DEMO_MODE === '0') {
      process.env.DEMO_MODE = 'false';
    } else if (process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'yes') {
      process.env.DEMO_MODE = 'true';
    }
  } else {
    // Inside cloud sandbox preview
    if (
      process.env.DEMO_MODE === undefined ||
      process.env.DEMO_MODE === '1' ||
      process.env.DEMO_MODE === 'true' ||
      process.env.DEMO_MODE === 'yes'
    ) {
      process.env.DEMO_MODE = 'true';
    }
  }

  const db = await initDb();

  // Auto-seed demo data on fresh start ONLY if DEMO_MODE is true
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM printers').get();
    if ((!row || row.c === 0) && process.env.DEMO_MODE === 'true') {
      console.log('[server] Fresh install detected in demo mode: seeding demo fleet...');
      const { seedDemo } = require('./seed-demo');
      seedDemo(db);
    }
  } catch (err) {
    console.error('[server] Error checking/seeding demo data:', err.message);
  }

  const { getAuthMiddleware } = require('./auth');
  app.use(getAuthMiddleware(db));

  const authRouter        = require('./routes/auth')(db);
  const usersRouter        = require('./routes/users')(db);
  const uploadsRouter      = require('./routes/uploads')(uploadsDir);
  const printersRouter     = require('./routes/printers')(db);
  const jobsRouter         = require('./routes/jobs')(db);
  const backupRouter       = require('./routes/backup')(db);
  const dashboardRouter    = require('./routes/dashboard')(db);
  const settingsRouter     = require('./routes/settings')(db);
  const modelsRouter       = require('./routes/models')(db);
  const groupsRouter       = require('./routes/groups')(db);
  const filamentsRouter    = require('./routes/filaments')(db);
  const printerJobsRouter  = require('./routes/printer-jobs')(db);

  // API routes
  app.use('/api/auth',            authRouter);
  app.use('/api/users',           usersRouter);
  app.use('/api/uploads',         uploadsRouter);
  app.use('/api/printers',        printersRouter);
  app.use('/api/printers/:id/jobs', printerJobsRouter);
  app.use('/api/jobs',            jobsRouter);
  app.use('/api/backup',          backupRouter);
  app.use('/api/dashboard',       dashboardRouter);
  app.use('/api/settings',        settingsRouter);
  app.use('/api/models',          modelsRouter);
  app.use('/api/groups',          groupsRouter);
  app.use('/api/filaments',       filamentsRouter);

  // Serve built React client (production mode)
  const clientDist = path.join(__dirname, '../client/dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    // SPA catch-all — non-API routes serve index.html
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('[server] Warning: client/dist/index.html not found. API routes will work, but client must be built.');
  }

  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Express running on http://0.0.0.0:${PORT}`);

    const poller    = new PrinterPoller(db);
    const scheduler = new JobScheduler(db, poller);

    // Mount projects, parts, and gcodes routers here so they have access to the scheduler
    app.use('/api/projects', require('./routes/projects')(db, scheduler));
    app.use('/api/parts',    require('./routes/parts')(db, scheduler));
    app.use('/api/gcodes',   require('./routes/gcodes')(db, scheduler));

    scheduler.start();
    poller.start();
    backup.start(db);

    poller.once('pollComplete', () => {
      console.log('[server] Initial poll complete — sweeping for idle printers');
      scheduler.sweepIdlePrinters();
    });

    // Dispatch trigger — called by the UI when a project is activated
    app.post('/api/scheduler/dispatch', (req, res) => {
      scheduler.sweepIdlePrinters();
      res.json({ ok: true });
    });

    // Bulk set-ready
    app.post('/api/printers/set-ready-batch', (req, res) => {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array required' });
      }
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE printers SET is_held = 0 WHERE id IN (${placeholders})`).run(...ids);
      const printers = db.prepare(`SELECT * FROM printers WHERE id IN (${placeholders}) AND is_active = 1`).all(...ids);
      const batchSetting = db.prepare("SELECT value FROM settings WHERE key = 'dispatch_batch_size'").get();
      const batchSize = batchSetting ? parseInt(batchSetting.value, 10) : 10;
      console.log(`[server] Batch set-ready: ${printers.length} printer(s), target concurrency ${batchSize}`);
      scheduler._sweepInBatches(printers).catch(err =>
        console.error('[scheduler] Batch set-ready sweep error:', err)
      );
      res.json({ ok: true, count: printers.length });
    });

    // Recommission a printer
    app.post('/api/printers/:id/recommission', (req, res) => {
      const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
      if (!printer) return res.status(404).json({ error: 'Printer not found' });
      db.prepare(`
        UPDATE printers
        SET is_active = 1, is_held = 0, decommissioned_at = NULL, decommission_note = NULL
        WHERE id = ?
      `).run(printer.id);
      events.insert(printer.id, 'recommission', req.body?.note ?? null);
      const updated = db.prepare('SELECT * FROM printers WHERE id = ?').get(printer.id);
      console.log(`[server] ${printer.name} recommissioned — dispatching...`);
      scheduler.scheduleForPrinter(updated);
      res.json(updated);
    });

    // Set a held printer ready
    app.post('/api/printers/:id/set-ready', (req, res) => {
      const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
      if (!printer) return res.status(404).json({ error: 'Printer not found' });

      const { confirmed_qty } = req.body || {};
      const now = Date.now();

      const uploadingJobEarly = db.prepare(
        "SELECT * FROM jobs WHERE printer_id = ? AND status = 'uploading' ORDER BY created_at DESC LIMIT 1"
      ).get(printer.id);

      const printingJobEarly = !uploadingJobEarly && db.prepare(
        "SELECT id FROM jobs WHERE printer_id = ? AND status = 'printing' ORDER BY started_at DESC LIMIT 1"
      ).get(printer.id);

      let finishedJob = (uploadingJobEarly || printingJobEarly) ? null : db.prepare(`
        SELECT * FROM jobs WHERE printer_id = ? AND status = 'finished'
        ORDER BY finished_at DESC LIMIT 1
      `).get(printer.id);

      if (finishedJob) {
        const newerCancelled = db.prepare(`
          SELECT 1 FROM jobs WHERE printer_id = ? AND status = 'cancelled' AND finished_at > ? LIMIT 1
        `).get(printer.id, finishedJob.finished_at);
        if (newerCancelled) finishedJob = null;
      }

      if (finishedJob) {
        if (confirmed_qty != null) {
          const confirmedQty = parseInt(confirmed_qty, 10);
          if (!isNaN(confirmedQty) && confirmedQty !== finishedJob.parts_per_plate) {
            const delta = confirmedQty - finishedJob.parts_per_plate;
            db.prepare(`
              UPDATE parts SET completed_qty = MAX(0, completed_qty + ?), updated_at = ? WHERE id = ?
            `).run(delta, now, finishedJob.part_id);

            const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(finishedJob.part_id);
            if (part.completed_qty < part.target_qty && part.status === 'closed') {
              db.prepare(`UPDATE parts SET status = 'open', updated_at = ? WHERE id = ?`).run(now, part.id);
              console.log(`[server] Part "${part.name}" reopened — confirmed qty reduced`);
            } else if (part.completed_qty >= part.target_qty && part.status === 'open') {
              db.prepare(`UPDATE parts SET status = 'closed', updated_at = ? WHERE id = ?`).run(now, part.id);
            }
            console.log(`[server] ${printer.name} confirmed ${confirmedQty}/${finishedJob.parts_per_plate} good (delta ${delta > 0 ? '+' : ''}${delta})`);
          }
        }
      } else {
        const printingJob = db.prepare(`
          SELECT * FROM jobs WHERE printer_id = ? AND status = 'printing'
          ORDER BY started_at DESC LIMIT 1
        `).get(printer.id);

        const activeJob = printingJob
          || db.prepare(`
              SELECT * FROM jobs WHERE printer_id = ? AND status = 'failed' AND finished_at > ?
              ORDER BY finished_at DESC LIMIT 1
            `).get(printer.id, scheduler.startedAt)
          || db.prepare(`
              SELECT * FROM jobs WHERE printer_id = ? AND status = 'cancelled'
              ORDER BY finished_at DESC LIMIT 1
            `).get(printer.id);

        if (activeJob) {
          if (printer.status === 'OFFLINE' && activeJob.status === 'printing') {
            console.log(`[server] ${printer.name} set ready from OFFLINE — job ${activeJob.id} still printing, no qty credited`);
          } else {
            const creditQty = (confirmed_qty != null && !isNaN(parseInt(confirmed_qty, 10)))
              ? parseInt(confirmed_qty, 10)
              : activeJob.parts_per_plate;

            db.prepare(`UPDATE jobs SET status = 'finished', finished_at = ? WHERE id = ?`)
              .run(now, activeJob.id);

            db.prepare(`
              UPDATE parts SET completed_qty = completed_qty + ?, updated_at = ? WHERE id = ?
            `).run(creditQty, now, activeJob.part_id);

            const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(activeJob.part_id);
            const label = printingJob ? 'missed-finish' : activeJob.status === 'cancelled' ? 'cancelled-confirmed-good' : 'MQTT-recovered finish';
            console.log(`[server] ${printer.name} ${label} confirmed good — Part "${part.name}" ${part.completed_qty}/${part.target_qty}`);

            if (part.completed_qty >= part.target_qty) {
              db.prepare(`UPDATE parts SET status = 'closed', updated_at = ? WHERE id = ?`).run(now, part.id);
              db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE part_id = ? AND status = 'queued'`).run(part.id);
              console.log(`[server] Part "${part.name}" closed (${part.completed_qty}/${part.target_qty})`);

              const openCount = db.prepare(`
                SELECT COUNT(*) AS count FROM parts WHERE project_id = ? AND status = 'open'
              `).get(part.project_id).count;
              if (openCount === 0) {
                db.prepare(`UPDATE projects SET status = 'completed', updated_at = ? WHERE id = ?`).run(now, part.project_id);
                console.log(`[server] Project ${part.project_id} completed!`);
              }
            }
          }
        } else {
          const uploadingJob = uploadingJobEarly;
          if (uploadingJob) {
            if (printer.status === 'FINISHED' || printer.status === 'IDLE') {
              const creditQty = (confirmed_qty != null && !isNaN(parseInt(confirmed_qty, 10)))
                ? parseInt(confirmed_qty, 10)
                : uploadingJob.parts_per_plate;
              db.prepare("UPDATE jobs SET status = 'finished', finished_at = ?, started_at = COALESCE(started_at, ?) WHERE id = ?")
                .run(now, now, uploadingJob.id);
              db.prepare("UPDATE parts SET completed_qty = completed_qty + ?, updated_at = ? WHERE id = ?")
                .run(creditQty, now, uploadingJob.part_id);
              const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(uploadingJob.part_id);
              console.log(`[server] ${printer.name} upload-stalled job ${uploadingJob.id} confirmed finished — Part "${part.name}" ${part.completed_qty}/${part.target_qty}`);
              if (part.completed_qty >= part.target_qty) {
                db.prepare(`UPDATE parts SET status = 'closed', updated_at = ? WHERE id = ?`).run(now, part.id);
                db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE part_id = ? AND status = 'queued'`).run(part.id);
                console.log(`[server] Part "${part.name}" closed (${part.completed_qty}/${part.target_qty})`);
                const openCount = db.prepare(
                  `SELECT COUNT(*) AS count FROM parts WHERE project_id = ? AND status = 'open'`
                ).get(part.project_id).count;
                if (openCount === 0) {
                  db.prepare(`UPDATE projects SET status = 'completed', updated_at = ? WHERE id = ?`).run(now, part.project_id);
                  console.log(`[server] Project ${part.project_id} completed!`);
                }
              }
            } else {
              db.prepare("UPDATE jobs SET status = 'printing', started_at = ? WHERE id = ?")
                .run(now, uploadingJob.id);
              console.log(`[server] ${printer.name} upload-stalled job ${uploadingJob.id} confirmed running by operator — changed to printing`);
            }
          }
        }
      }

      db.prepare('UPDATE printers SET is_held = 0 WHERE id = ?').run(printer.id);
      const updated = db.prepare('SELECT * FROM printers WHERE id = ?').get(printer.id);
      console.log(`[server] ${printer.name} set ready by operator — dispatching...`);
      scheduler.scheduleForPrinter(updated);
      res.json(updated);
    });
  });
}

startServer().catch(err => {
  console.error('[FATAL] Error during startServer:', err);
  process.exit(1);
});

module.exports = { app, server: serverInstance };
