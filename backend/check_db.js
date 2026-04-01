const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const campaigns = await prisma.campaign.findMany({ select: { id: true, status: true }, take: 5 });
  console.log(JSON.stringify(campaigns, null, 2));
  await prisma.$disconnect();
}
main();
