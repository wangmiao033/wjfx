import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env optional */ }

const db = new PrismaClient();

const ADMIN = {
  name: 'admin',
  email: 'admin@wjfx.local',
  password: '911030',
};

async function main() {
  const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

  const user = await db.user.upsert({
    where: { email: ADMIN.email },
    update: {
      name: ADMIN.name,
      password: hashedPassword,
    },
    create: {
      email: ADMIN.email,
      name: ADMIN.name,
      password: hashedPassword,
    },
  });

  console.log('Admin account ready:');
  console.log(`  账号: ${user.name}`);
  console.log(`  邮箱: ${user.email}`);
  console.log(`  密码: ${ADMIN.password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
