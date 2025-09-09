const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now(), env: process.env.NODE_ENV || 'dev' });
  });
  
app.listen(3000, () => console.log('Backend listening on http://localhost:3000'));
