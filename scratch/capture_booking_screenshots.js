const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetDir = path.resolve(__dirname, '..', 'screenshots');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

async function capture() {
  console.log("Starting Chrome remote debugging...");
  const chrome = spawn(chromePath, [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    '--force-device-scale-factor=1',
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  http.get('http://127.0.0.1:9222/json', async (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      const tabs = JSON.parse(data);
      const tab = tabs.find(t => t.url.includes('localhost:3000')) || tabs[0];
      const wsUrl = tab.webSocketDebuggerUrl;

      // We can use a lightweight WebSocket connection or fetch evaluation
      // Node 20 has built-in WebSocket support via import or global if flag, but let's check
      console.log('Connected to tab:', tab.title);
      chrome.kill();
    });
  });
}

capture();
