const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos desde el directorio public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para los favicons
app.get('/favicon.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'icon.png'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'icon.png'));
});

// Para todas las demás rutas, servir index.html (para SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
