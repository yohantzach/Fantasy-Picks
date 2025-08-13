import http from 'http';

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/gameweek/current',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing gameweek endpoint...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(data);
      console.log('Response:', JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();
