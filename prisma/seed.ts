import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg(new pg.Pool({ connectionString: process.env.DATABASE_URL })),
});

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !username || !password) throw new Error('ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD مطلوبة');

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { fullName: 'Admin', username, email, password: await bcrypt.hash(password, 10), role: 'ADMIN' },
  });
  console.log(`Admin ready: ${admin.email}`);
}

main().finally(() => prisma.$disconnect());
