import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clear existing data
  await prisma.notification.deleteMany({});
  await prisma.trustEvent.deleteMany({});
  await prisma.trustScore.deleteMany({});
  await prisma.lendingHistory.deleteMany({});
  await prisma.prebookQueue.deleteMany({});
  await prisma.request.deleteMany({});
  await prisma.hardwareItem.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.institutionalDomain.deleteMany({});

  // 2. Insert verified domain patterns
  await prisma.institutionalDomain.createMany({
    data: [
      { domainPattern: "%.edu" },
      { domainPattern: "%.edu.in" },
      { domainPattern: "%.ac.in" }
    ]
  });

  // 3. Create profiles
  // Provider (Lender)
  const provider = await prisma.profile.create({
    data: {
      name: "Professor Albert",
      fullName: "Albert Einstein",
      email: "albert@university.edu",
      password: "password123",
      role: "provider",
      status: "active",
      emailVerified: true,
      phone: "+1-555-0100",
      phoneVerified: true,
      collegeName: "Apex University",
      labName: "Robotics & IoT Lab",
      profileCompleted: true
    }
  });

  // Admin
  const admin = await prisma.profile.create({
    data: {
      name: "Admin Office",
      fullName: "System Admin",
      email: "lalartha317@gmail.com",
      password: "Harthal123",
      role: "admin",
      status: "active",
      emailVerified: true,
      phone: "+1-555-0199",
      phoneVerified: true,
      collegeName: "Apex University",
      profileCompleted: true
    }
  });

  // Student (Borrower with full verification)
  const student = await prisma.profile.create({
    data: {
      name: "Jane Doe",
      fullName: "Jane Margaret Doe",
      email: "jane@university.edu",
      password: "password123",
      role: "student",
      status: "active",
      emailVerified: true,
      phone: "+1-555-0122",
      phoneVerified: true,
      academicRole: "UG Student",
      collegeName: "Apex University",
      profileCompleted: true
    }
  });

  // Another student (Suspended/Restricted or low trust potential)
  const student2 = await prisma.profile.create({
    data: {
      name: "John Smith",
      fullName: "Johnathan Smith",
      email: "john@student.edu",
      password: "password123",
      role: "student",
      status: "active",
      emailVerified: true,
      phone: "+1-555-0133",
      phoneVerified: false,
      academicRole: "UG Student",
      collegeName: "Apex University",
      profileCompleted: true
    }
  });

  // 4. Create trust scores
  await prisma.trustScore.createMany({
    data: [
      {
        userId: student.id,
        score: 100,
        band: "trusted",
        totalBorrows: 5,
        onTimeReturns: 5,
        lateReturns: 0,
        damagesReported: 0
      },
      {
        userId: student2.id,
        score: 45, // Caution band (40-69)
        band: "caution",
        totalBorrows: 3,
        onTimeReturns: 1,
        lateReturns: 2,
        damagesReported: 0
      }
    ]
  });

  // 5. Create hardware items
  // High-value item
  const jetson = await prisma.hardwareItem.create({
    data: {
      ownerId: provider.id,
      name: "NVIDIA Jetson Nano 4GB",
      description: "Developer Kit for AI/deep learning pipelines and computer vision projects.",
      category: "Microcontrollers",
      quantityTotal: 4,
      quantityAvailable: 4,
      maxLendingDays: 14,
      isHighValue: true,
      imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop",
      status: "available"
    }
  });

  // Standard items
  const rpi = await prisma.hardwareItem.create({
    data: {
      ownerId: provider.id,
      name: "Raspberry Pi 4 Model B",
      description: "8GB RAM single-board computer for IoT nodes.",
      category: "Microcontrollers",
      quantityTotal: 10,
      quantityAvailable: 10,
      maxLendingDays: 10,
      isHighValue: false,
      imageUrl: "https://images.unsplash.com/photo-1602512017565-3c355dec4a4e?w=500&auto=format&fit=crop",
      status: "available"
    }
  });

  const sensor = await prisma.hardwareItem.create({
    data: {
      ownerId: provider.id,
      name: "HC-SR04 Ultrasonic Sensor",
      description: "Distance measurement sensor module.",
      category: "Sensors",
      quantityTotal: 15,
      quantityAvailable: 0, // Mock zero availability to test pre-booking logic
      maxLendingDays: 7,
      isHighValue: false,
      imageUrl: "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=500&auto=format&fit=crop",
      status: "available"
    }
  });

  // 6. Prebooks seeding
  await prisma.prebookQueue.create({
    data: {
      userId: student.id,
      hardwareId: sensor.id,
      position: 1,
      status: "waiting"
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
