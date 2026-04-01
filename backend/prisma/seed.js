require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('@Hackmein@321???', 12);
  await prisma.user.upsert({
    where: { username: 'iamrealjewel' },
    update: {},
    create: { username: 'iamrealjewel', passwordHash: adminHash, role: 'ADMIN' },
  });
  console.log('✅ Admin user: iamrealjewel');

  // Create HR user
  const hrHash = await bcrypt.hash('hr@123456#', 12);
  await prisma.user.upsert({
    where: { username: 'hr' },
    update: {},
    create: { username: 'hr', passwordHash: hrHash, role: 'HR' },
  });
  console.log('✅ HR user: hr');

  // Seed default SMS Settings
  const defaults = [
    { key: 'api_token', value: 'Ispahani-c1f14263-de77-4a9d-8e59-36cafdb7da4c' },
    { key: 'sid', value: 'ISPAHANIAPI' },
    { key: 'api_endpoint', value: 'https://smsplus.sslwireless.com/api/v3/send-sms' },
  ];

  for (const setting of defaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Default SMS settings seeded');

  console.log('\n🎉 Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
