const { Client } = require('ssh2');
const fs = require('fs');
const key = fs.readFileSync('/home/z/.ssh/id_rsa', 'utf8');
const args = process.argv.slice(2);
let host = 'github.com', command = '';
if (args.length >= 1) { const p = args[0]; if (p.includes('@')) host = p.split('@')[1]; else host = p; }
if (args.length >= 2) command = args.slice(1).join(' ');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(command, (err, stream) => {
    if (err) { process.stderr.write(err.message+'\n'); conn.end(); process.exit(1); }
    process.stdin.pipe(stream);
    if (stream.stdout) stream.stdout.pipe(process.stdout); else stream.pipe(process.stdout);
    if (stream.stderr) stream.stderr.pipe(process.stderr);
    stream.on('exit', (code) => { conn.end(); process.exit(code||0); });
    stream.on('close', () => { conn.end(); });
  });
}).on('error', (err) => { process.stderr.write(err.message+'\n'); process.exit(1); });
process.stdin.on('end', () => {});
conn.connect({ host, port: 22, username: 'git', privateKey: key, timeout: 30000 });
