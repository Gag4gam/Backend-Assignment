import fs from 'node:fs';
import path from 'node:path';
const TARGET_URL = 'https://books.toscrape.com/catalogue/page-1.html'
const CACHE_DIR = 'cache';
const CACHE_FILE = path.join(CACHE_DIR, 'cataloue-page-1.html');


const HEADERS = {
    'User-Agent': 'FlyRankIntership-A5/1.0 (https://github.com/Gag4gam/Backend-Assignment)'
};

async function getPage() {
    if (fs.existsSync(CACHE_FILE)) {
        const html = fs.readFileSync(CACHE_FILE, 'utf-8');
        const size = Buffer.byteLength(html, 'utf-8');
        console.log(`CACHE HIT: Source:${CACHE_FILE} - Size (${size} bytes)`);
        return html;
    }

    try {
        const response = await fetch(TARGET_URL, {
            headers: HEADERS,
            signal: AbortSignal.timeout(10000)
        });
    
        if (response.status !== 200) {
            console.log(`Error: Received status code ${response.status} from ${TARGET_URL}`);
            return null;
        }

        const html = await response.text();

        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, html, 'utf-8');

        const size = Buffer.byteLength(html, 'utf-8');
        console.log(`FETCH - Status: ${response.status} - Saved to ${CACHE_FILE} - Size: ${size} bytes`);
        return html;
    } catch (error) {
        cosole.log(`Error fetching: ${error.message}`);
        return null;
    }

}

getPage();