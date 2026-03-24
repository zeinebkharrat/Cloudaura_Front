const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://raw.githubusercontent.com/riatelab/tunisie/master/data/TN-gouvernorats.geojson';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (data.includes('"type"')) {
            const dest = path.join(__dirname, 'src', 'assets', 'tunisia.json');
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, data);
            console.log('Success Downloaded');
        } else {
            console.log('Failed:', data.substring(0, 100));
        }
    });
}).on('error', (err) => console.error(err));
