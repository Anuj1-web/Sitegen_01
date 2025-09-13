const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT
});

// GET all library items (for admin page)
app.get('/api/library/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM library ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE a library item by ID
app.delete('/api/library/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM library WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});


// Upload library item (file + optional thumbnail)
app.post('/api/library/upload', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const file = req.files['file']?.[0];
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const thumbnailFile = req.files['thumbnail']?.[0];
    const content = file.buffer.toString('base64');
    const thumbnail = thumbnailFile ? thumbnailFile.buffer.toString('base64') : null;
    const name = req.body.name || file.originalname;
    const type = req.body.type || 'template';

    const result = await pool.query(
      'INSERT INTO library(name, type, content, thumbnail) VALUES($1,$2,$3,$4) RETURNING *',
      [name, type, content, thumbnail]
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
