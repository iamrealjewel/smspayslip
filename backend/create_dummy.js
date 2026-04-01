const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const upload = await prisma.upload.create({
    data: {
      filename: 'dummy.xlsx',
      storedPath: '/tmp/dummy.xlsx',
      rowCount: 10,
      userId: 1,
      status: 'VALIDATED'
    }
  });
  const campaign = await prisma.campaign.create({
    data: {
      uploadId: upload.id,
      userId: 1,
      total: 10,
      status: 'RUNNING'
    }
  });
  console.log(`Campaign created: ${campaign.id}`);
  await prisma.$disconnect();
}
main();
