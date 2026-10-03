const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const actuals = await prisma.actual.findMany({ where: { month: 3 } });
  console.log('Month 3 Actuals:', actuals.length);
  const m1 = await prisma.actual.findMany({ where: { month: 1 } });
  console.log('Month 1 Actuals:', m1.length);
}
main().finally(() => prisma.$disconnect());
