const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
code = code.replace(/setGlobalMessage\("Dashboard synced with backend\."\);/g, '');
fs.writeFileSync('src/App.jsx', code);
console.log('Removed synced message');
