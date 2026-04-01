const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.campaign.update({ where: { id: 6 }, data: { status: 'RUNNING' } });
  console.log('Campaign 6 status set to RUNNING');
  await prisma.$disconnect();
}
main();
