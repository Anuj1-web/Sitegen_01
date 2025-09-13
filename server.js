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

// Routes
app.get('/api/library/templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM library WHERE type=$1', ['template']);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/library/upload', upload.single('file'), async (req, res) => {
  try {
    const { type, name } = req.body;
    const content = req.file.buffer.toString('base64');
    let thumbnail = req.body.thumbnail || null;

    const result = await pool.query(
      'INSERT INTO library(name, type, content, thumbnail) VALUES($1,$2,$3,$4) RETURNING *',
      [name, type, content, thumbnail]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
