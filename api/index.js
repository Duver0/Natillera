const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos desde el directorio public
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../assets')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Servir el HTML de la app para todas las rutas
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

module.exports = app;
