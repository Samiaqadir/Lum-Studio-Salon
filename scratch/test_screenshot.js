const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetDir = path.resolve(__dirname, '..', 'screenshots');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

const desktopPng = path.join(targetDir, 'desktop_preview_1280.png');
const mobilePng = path.join(targetDir, 'mobile_preview_375.png');

console.log('Capturing Desktop Screenshot...');
const res1 = spawnSync(chromePath, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  `--screenshot=${desktopPng}`,
  '--window-size=1280,1000',
  '--virtual-time-budget=4000',
  'http://localhost:3000'
], { stdio: 'pipe' });

console.log('Desktop res:', res1.status, res1.stdout.toString(), res1.stderr.toString());
console.log('Desktop exists:', fs.existsSync(desktopPng));

console.log('Capturing Mobile Screenshot...');
const res2 = spawnSync(chromePath, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  `--screenshot=${mobilePng}`,
  '--window-size=375,812',
  '--virtual-time-budget=4000',
  'http://localhost:3000'
], { stdio: 'pipe' });

console.log('Mobile res:', res2.status, res2.stdout.toString(), res2.stderr.toString());
console.log('Mobile exists:', fs.existsSync(mobilePng));

const modalPng = path.join(targetDir, 'booking_modal_step1.png');
console.log('Capturing Booking Modal Step 1...');
spawnSync(chromePath, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  `--screenshot=${modalPng}`,
  '--window-size=1280,1000',
  '--virtual-time-budget=4000',
  'http://localhost:3000/?openBooking=1'
], { stdio: 'pipe' });
console.log('Modal exists:', fs.existsSync(modalPng));

const validationPng = path.join(targetDir, 'booking_validation_errors.png');
console.log('Capturing Validation Errors (Desktop)...');
spawnSync(chromePath, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  `--screenshot=${validationPng}`,
  '--window-size=1280,1000',
  '--virtual-time-budget=4000',
  'http://localhost:3000/?testValidation=1'
], { stdio: 'pipe' });
console.log('Validation Desktop exists:', fs.existsSync(validationPng));

const validationMobPng = path.join(targetDir, 'booking_validation_mobile.png');
console.log('Capturing Validation Errors (Mobile 375px)...');
spawnSync(chromePath, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  `--screenshot=${validationMobPng}`,
  '--window-size=375,812',
  '--virtual-time-budget=4000',
  'http://localhost:3000/?testValidation=1'
], { stdio: 'pipe' });
console.log('Validation Mobile exists:', fs.existsSync(validationMobPng));
