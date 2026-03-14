const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
    const users = await prisma.users.findMany({
        select: { id: true, email: true, rewardPoints: true }
    });
    console.log("Users in DB:", users);

    const complaints = await prisma.complaints.findMany({
        select: { id: true, status: true, userId: true }
    });
    console.log("Total Complaints:", complaints.length);
}

checkUsers().catch(console.error).finally(() => prisma.$disconnect());
