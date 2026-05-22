#!/usr/bin/env node
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO = 'wangmiao033/wjfx';
const keyPath = '/home/z/.ssh/id_ed25519_github';

const localSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();

// Get remote refs
function getRemoteHead() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let data = Buffer.alloc(0);
    conn.on('ready', () => {
      conn.exec(`git-upload-pack '${REPO}.git'`, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
        stream.on('close', () => {
          conn.end();
          const text = data.toString('utf-8');
          let remoteHead = null;
          const match = text.match(/([0-9a-f]{40})\s+refs\/heads\/main/);
          if (match) remoteHead = match[1];
          if (!remoteHead) {
            const headMatch = text.match(/([0-9a-f]{40})\s+HEAD/);
            if (headMatch) remoteHead = headMatch[1];
          }
          resolve(remoteHead);
        });
        setTimeout(() => { stream.write('0000'); stream.write('0009done\n'); }, 2000);
      });
    });
    conn.on('error', reject);
    conn.connect({ host: 'github.com', port: 22, user: 'git', privateKey: fs.readFileSync(keyPath) });
  });
}

function push(remoteHead) {
  return new Promise((resolve, reject) => {
    let packData;
    try {
      packData = execSync('git pack-objects --thin --revs --stdout', {
        input: `${localSha}\n^${remoteHead}\n`,
      });
    } catch (e) {
      reject(e); return;
    }
    console.log(`Pack: ${(packData.length / 1024).toFixed(1)} KB`);

    const conn = new Client();
    let responseData = Buffer.alloc(0);
    conn.on('ready', () => {
      conn.exec(`git-receive-pack '${REPO}.git'`, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on('data', (chunk) => { responseData = Buffer.concat([responseData, chunk]); });
        stream.stderr.on('data', (chunk) => { process.stderr.write(chunk); });
        stream.on('close', (code) => {
          conn.end();
          const response = responseData.toString('utf-8');
          if (response.includes('ok refs/heads/main') || response.includes('unpack ok')) {
            console.log('✅ 推送成功！');
            resolve(true);
          } else {
            console.log('Response:', response);
            resolve(false);
          }
        });
        const capStr = 'report-status-v2 side-band-64k agent=git/ssh-push';
        const refLine = `${remoteHead} ${localSha} refs/heads/main\0${capStr}\n`;
        const pktRef = pktLine(refLine);
        stream.write(pktRef);
        stream.write('0000');
        stream.write(packData);
      });
    });
    conn.on('error', reject);
    conn.connect({ host: 'github.com', port: 22, user: 'git', privateKey: fs.readFileSync(keyPath) });
  });
}

function pktLine(data) {
  const len = Buffer.byteLength(data) + 4;
  return len.toString(16).padStart(4, '0') + data;
}

async function main() {
  try {
    const remoteHead = await getRemoteHead();
    console.log('Remote:', remoteHead);
    console.log('Local:', localSha);
    if (remoteHead === localSha) { console.log('Up to date!'); return; }
    const success = await push(remoteHead);
    process.exit(success ? 0 : 1);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
