const fs = require('fs');
const json = fs.readFileSync('src/assets/tunisia.json', 'utf8');
fs.writeFileSync('src/app/tunisia-map.ts', 'export const tunisiaGeoJson: any = ' + json + ';');
