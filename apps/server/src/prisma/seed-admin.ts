import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();

  const email = process.env.ADMIN_EMAIL || 'admin@sooptalk.com';
  const password = process.env.ADMIN_PASSWORD || 'admin1234!';

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed },
    create: {
      email,
      password: hashed,
      name: '관리자',
      role: 'ADMIN',
      phoneNumber: '',
      instructorStatus: 'NONE',
    },
  });

  console.log(`Admin account ready: ${user.email} (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
