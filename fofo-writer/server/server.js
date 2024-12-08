import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import mime from 'mime';

const DATAPATH = process.env.DATA || './data';
const DISTPATH = process.env.DIST || './dist';

// make sure the data directory exists
if (!fs.existsSync(DATAPATH)) {
  fs.mkdirSync(DATAPATH);
}

// utility function to pull the data from a request
const server = http.createServer(async (req, res) => {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Handle API requests
  if (req.method === 'POST' && url.pathname === '/api/log') {
    // get the request body
    let data = '';
    for await (const chunk of req) {
      data += chunk;
    }
    let body = JSON.parse(data);

    // get the user_id from the data object
    const user_id = body.conditionData.user_id;
    if (! body.timestamp) {
      body.timestamp = new Date().toISOString();
    }

    // write the data to the user's logfile with a timestamp, separated by a form field separator
    fs.appendFileSync(`${DATAPATH}/${user_id}.log`, JSON.stringify(body) + '\n');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Handle static file requests
  if (url.pathname === '/') {
    url.pathname = '/index.html';
  }
  if (url.pathname.match(/^\/\d\d\d\//)) {
    url.pathname = '/index.html';
  }
  // clean up the pathname to avoid directory traversal
  const path = DISTPATH+url.pathname.split('/').filter(p => !p.startsWith('.')).join('/');
  // infer the content type from the file extension using mime library
  res.setHeader('Content-Type', mime.getType(path));
  try {
    // async pipe the file to the response
    fs.createReadStream(path).pipe(res);
  } catch (err) {
    // if the file doesn't exist, send a 404 response
    res.writeHead(404);
    res.end();
  } 
}, (err) => {
  console.error(err);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});