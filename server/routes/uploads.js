const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = (uploadsDir) => {
  const router = express.Router();
  const failuresDir = path.join(uploadsDir, 'failures');

  if (!fs.existsSync(failuresDir)) {
    fs.mkdirSync(failuresDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, failuresDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const cleanBase = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 30);
      cb(null, `fail_${Date.now()}_${cleanBase}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận tệp định dạng hình ảnh (JPG, PNG, WebP, GIF).'));
      }
    },
  });

  // POST /api/uploads/failure-photo or /api/uploads/image (multipart or base64)
  router.post(['/failure-photo', '/image', '/photo', '/base64'], (req, res) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Lỗi khi tải ảnh lên' });
      }

      if (req.file) {
        const photoUrl = `/uploads/failures/${req.file.filename}`;
        return res.json({
          ok: true,
          url: photoUrl,
          photo_url: photoUrl,
          filename: req.file.filename,
          size: req.file.size,
        });
      }

      // Check if base64 provided in json body
      const base64Data = req.body?.image || req.body?.image_base64 || req.body?.photo_base64;
      if (base64Data && typeof base64Data === 'string') {
        try {
          const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          let ext = '.jpg';
          let buffer;

          if (matches && matches.length === 3) {
            const mime = matches[1];
            if (mime.includes('png')) ext = '.png';
            else if (mime.includes('webp')) ext = '.webp';
            buffer = Buffer.from(matches[2], 'base64');
          } else {
            buffer = Buffer.from(base64Data, 'base64');
          }

          const filename = `fail_${Date.now()}_img${ext}`;
          const filePath = path.join(failuresDir, filename);
          fs.writeFileSync(filePath, buffer);

          const photoUrl = `/uploads/failures/${filename}`;
          return res.json({
            ok: true,
            url: photoUrl,
            photo_url: photoUrl,
            filename,
            size: buffer.length,
          });
        } catch (e) {
          return res.status(400).json({ error: 'Dữ liệu ảnh base64 không hợp lệ' });
        }
      }

      return res.status(400).json({ error: 'Vui lòng chọn ảnh cần tải lên' });
    });
  });

  return router;
};
