const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const upload = multer();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // all html, js, css in 'public'

// Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/client_db',
});

// ----------------- LIBRARY API -----------------

// Upload template/page/block/theme/subscription
app.post('/api/library/upload', upload.fields([{name:'file'}, {name:'thumbnail'}]), async (req,res)=>{
  try{
    const file = req.files['file'][0];
    const thumb = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

    let type = 'asset';
    if(file.originalname.endsWith('.zip')) type='template';
    else if(file.originalname.endsWith('.html')) type='page';
    else if(file.originalname.endsWith('.block')) type='block';
    else if(file.originalname.endsWith('.theme')) type='theme';
    else if(file.originalname.endsWith('.sub')) type='subscription';

    await pool.query(
      `INSERT INTO library(name,type,content,thumbnail) VALUES($1,$2,$3,$4)`,
      [file.originalname,type,file.buffer,thumb ? thumb.buffer : null]
    );
    res.json({success:true});
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// Get all templates for index page
app.get('/api/library/templates', async (req,res)=>{
  try{
    const result = await pool.query(`SELECT id,name,type,encode(thumbnail,'base64') as thumbnail FROM library WHERE type='template' ORDER BY created_at DESC`);
    res.json(result.rows);
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// Get template content by id for wizardmaker
app.get('/api/library/template/:id', async (req,res)=>{
  try{
    const result = await pool.query(`SELECT encode(content,'base64') as content FROM library WHERE id=$1`,[req.params.id]);
    if(result.rows.length==0) return res.status(404).json({error:'Template not found'});
    res.json({content: result.rows[0].content});
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// ----------------- COURSES & VIDEOS -----------------

app.get('/api/courses', async (req,res)=>{
  try{
    const result = await pool.query(`SELECT * FROM courses ORDER BY created_at DESC`);
    res.json(result.rows);
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

app.post('/api/courses', async (req,res)=>{
  try{
    const {title,description} = req.body;
    const result = await pool.query(`INSERT INTO courses(title,description) VALUES($1,$2) RETURNING *`,[title,description]);
    res.json(result.rows[0]);
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

app.get('/api/videos', async (req,res)=>{
  try{
    const result = await pool.query(`SELECT * FROM videos ORDER BY created_at DESC`);
    res.json(result.rows);
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

app.post('/api/videos', async (req,res)=>{
  try{
    const {course_id,title,url} = req.body;
    const result = await pool.query(`INSERT INTO videos(course_id,title,url) VALUES($1,$2,$3) RETURNING *`,[course_id,title,url]);
    res.json(result.rows[0]);
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
