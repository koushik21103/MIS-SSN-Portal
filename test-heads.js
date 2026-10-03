const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const heads = await prisma.accountHead.findMany();
  console.log('Account Heads:', heads.map(h => h.code));
}
main().finally(() => prisma.$disconnect());
