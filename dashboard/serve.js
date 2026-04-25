const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`\n  Bido Dashboard running at http://localhost:${PORT}\n`);
});
