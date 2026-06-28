import WebSocket from 'ws';

async function testLongConn() {
  const username = 'tiktok';
  const apiKey = 'tk_ea4ff46c723149776d64ead0ea0b1ff042d6bd762f00453b';
  const url = `wss://api.tik.tools?uniqueId=${username}&apiKey=${apiKey}`;

  console.log(`Testing connection for url: ${url}`);
  const ws = new WebSocket(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  ws.on('open', () => {
    console.log('✅ WebSocket connection successfully opened!');
  });

  ws.on('message', (data) => {
    console.log('📩 Payload received:', data.toString());
  });

  ws.on('error', (err) => {
    console.log('❌ Error occurred:', err);
  });

  ws.on('close', (code, reason) => {
    console.log(`💤 WebSocket closed! Code: ${code} | Reason: ${reason ? reason.toString() : 'None'}`);
  });

  setTimeout(() => {
    console.log('Test completed. Closing connection...');
    ws.close();
  }, 10000);
}

testLongConn();
