import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Find or create test tenant
  let tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { subdomain: 'dragon-academy' },
        { email: 'admin@dragonacademy.com' }
      ]
    }
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Школа единоборств',
        subdomain: 'dragon-academy',
        email: 'admin@dragonacademy.com',
        phone: '+1-555-0123',
        address: '123 Martial Arts Street, City, State 12345',
        settings: JSON.stringify({
          timezone: 'America/New_York',
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY'
        })
      }
    });
    console.log('✅ Created tenant:', tenant.name);
  } else {
    console.log('✅ Using existing tenant:', tenant.name);
  }

  // Create owner user
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  let owner = await prisma.user.findFirst({
    where: { email: 'owner@dragonacademy.com', tenantId: tenant.id }
  });
  
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        email: 'owner@dragonacademy.com',
        password: hashedPassword,
        firstName: 'Master',
        lastName: 'Chen',
        phone: '+1-555-0123',
        role: 'OWNER',
        tenantId: tenant.id
      }
    });
    console.log('✅ Created owner user:', owner.email);
  } else {
    console.log('✅ Owner user already exists:', owner.email);
  }

  // Create admin user
  let admin = await prisma.user.findFirst({
    where: { email: 'admin@dragonacademy.com', tenantId: tenant.id }
  });
  
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@dragonacademy.com',
        password: hashedPassword,
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '+1-555-0124',
        role: 'ADMIN',
        tenantId: tenant.id
      }
    });
    console.log('✅ Created admin user:', admin.email);
  } else {
    console.log('✅ Admin user already exists:', admin.email);
  }

  // Create trainer users
  let trainer1 = await prisma.user.findFirst({
    where: { email: 'trainer1@dragonacademy.com', tenantId: tenant.id }
  });
  
  if (!trainer1) {
    trainer1 = await prisma.user.create({
      data: {
        email: 'trainer1@dragonacademy.com',
        password: hashedPassword,
        firstName: 'Mike',
        lastName: 'Rodriguez',
        phone: '+1-555-0125',
        role: 'TRAINER',
        tenantId: tenant.id
      }
    });
    console.log('✅ Created trainer1 user:', trainer1.email);
  } else {
    console.log('✅ Trainer1 user already exists:', trainer1.email);
  }

  let trainer2 = await prisma.user.findFirst({
    where: { email: 'trainer2@dragonacademy.com', tenantId: tenant.id }
  });
  
  if (!trainer2) {
    trainer2 = await prisma.user.create({
      data: {
        email: 'trainer2@dragonacademy.com',
        password: hashedPassword,
        firstName: 'Lisa',
        lastName: 'Wang',
        phone: '+1-555-0126',
        role: 'TRAINER',
        tenantId: tenant.id
      }
    });
    console.log('✅ Created trainer2 user:', trainer2.email);
  } else {
    console.log('✅ Trainer2 user already exists:', trainer2.email);
  }

  // Create trainer profiles (or use existing)
  let trainerProfile1 = await prisma.trainer.findFirst({
    where: { userId: trainer1.id, tenantId: tenant.id }
  });
  if (!trainerProfile1) {
    trainerProfile1 = await prisma.trainer.create({
      data: {
        userId: trainer1.id,
        qualification: '5th Dan Black Belt, Certified Instructor',
        experience: 15,
        specialization: 'Karate, Self-Defense',
        salaryType: 'fixed',
        salaryAmount: 3500,
        tenantId: tenant.id
      }
    });
    console.log('✅ Created trainer1 profile');
  } else {
    console.log('✅ Trainer1 profile already exists');
  }

  let trainerProfile2 = await prisma.trainer.findFirst({
    where: { userId: trainer2.id, tenantId: tenant.id }
  });
  if (!trainerProfile2) {
    trainerProfile2 = await prisma.trainer.create({
      data: {
        userId: trainer2.id,
        qualification: '3rd Dan Black Belt, Youth Specialist',
        experience: 8,
        specialization: 'Taekwondo, Youth Programs',
        salaryType: 'percentage',
        salaryAmount: 30,
        tenantId: tenant.id
      }
    });
    console.log('✅ Created trainer2 profile');
  } else {
    console.log('✅ Trainer2 profile already exists');
  }

  // Create branches (or use existing)
  let branch1 = await prisma.branch.findFirst({
    where: { name: 'Main Dojo', tenantId: tenant.id }
  });
  if (!branch1) {
    branch1 = await prisma.branch.create({
      data: {
        name: 'Main Dojo',
        address: '123 Martial Arts Street, City, State 12345',
        phone: '+1-555-0123',
        email: 'main@dragonacademy.com',
        description: 'Main training facility with full equipment',
        tenantId: tenant.id
      }
    });
  }
  let branch2 = await prisma.branch.findFirst({
    where: { name: 'Westside Branch', tenantId: tenant.id }
  });
  if (!branch2) {
    branch2 = await prisma.branch.create({
      data: {
        name: 'Westside Branch',
        address: '456 West Street, City, State 12345',
        phone: '+1-555-0127',
        email: 'west@dragonacademy.com',
        description: 'Smaller facility for specialized training',
        tenantId: tenant.id
      }
    });
  }
  console.log('✅ Branches ready');

  // Create groups (or use existing)
  let group1 = await prisma.group.findFirst({
    where: { name: 'Adult Karate - Beginners', tenantId: tenant.id }
  });
  if (!group1) {
    group1 = await prisma.group.create({
      data: {
        name: 'Adult Karate - Beginners',
        description: 'Karate classes for adult beginners',
        maxMembers: 20,
        ageMin: 18,
        ageMax: 65,
        branchId: branch1.id,
        trainerId: trainerProfile1.id,
        tenantId: tenant.id
      }
    });
  }
  let group2 = await prisma.group.findFirst({
    where: { name: 'Youth Taekwondo - Intermediate', tenantId: tenant.id }
  });
  if (!group2) {
    group2 = await prisma.group.create({
      data: {
        name: 'Youth Taekwondo - Intermediate',
        description: 'Taekwondo classes for youth (ages 8-16)',
        maxMembers: 15,
        ageMin: 8,
        ageMax: 16,
        branchId: branch1.id,
        trainerId: trainerProfile2.id,
        tenantId: tenant.id
      }
    });
  }
  let group3 = await prisma.group.findFirst({
    where: { name: 'Advanced Karate', tenantId: tenant.id }
  });
  if (!group3) {
    group3 = await prisma.group.create({
      data: {
        name: 'Advanced Karate',
        description: 'Advanced karate techniques and sparring',
        maxMembers: 12,
        ageMin: 16,
        ageMax: 50,
        branchId: branch2.id,
        trainerId: trainerProfile1.id,
        tenantId: tenant.id
      }
    });
  }
  console.log('✅ Groups ready');

  console.log('✅ Created groups');

  // Create sample clients
  const clients = [
    {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@email.com',
      phone: '+1-555-1001',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'male',
      address: '789 Oak Street, City, State 12345',
      emergencyContact: 'Jane Smith',
      emergencyPhone: '+1-555-1002',
      medicalNotes: 'No known allergies'
    },
    {
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily.davis@email.com',
      phone: '+1-555-1003',
      dateOfBirth: new Date('2010-08-22'),
      gender: 'female',
      address: '321 Pine Street, City, State 12345',
      emergencyContact: 'Robert Davis',
      emergencyPhone: '+1-555-1004',
      medicalNotes: 'Asthma - inhaler available'
    },
    {
      firstName: 'David',
      lastName: 'Wilson',
      email: 'david.wilson@email.com',
      phone: '+1-555-1005',
      dateOfBirth: new Date('1985-12-03'),
      gender: 'male',
      address: '654 Maple Street, City, State 12345',
      emergencyContact: 'Mary Wilson',
      emergencyPhone: '+1-555-1006',
      medicalNotes: 'Previous knee injury - modified exercises'
    },
    {
      firstName: 'Sophia',
      lastName: 'Brown',
      email: 'sophia.brown@email.com',
      phone: '+1-555-1007',
      dateOfBirth: new Date('2012-03-18'),
      gender: 'female',
      address: '987 Cedar Street, City, State 12345',
      emergencyContact: 'Michael Brown',
      emergencyPhone: '+1-555-1008',
      medicalNotes: 'None'
    }
  ];

  const createdClients = [];
  for (const clientData of clients) {
    const client = await prisma.client.create({
      data: {
        ...clientData,
        tenantId: tenant.id
      }
    });
    createdClients.push(client);
  }

  console.log('✅ Created sample clients');

  // Create group memberships
  await prisma.groupMembership.create({
    data: {
      clientId: createdClients[0].id,
      groupId: group1.id
    }
  });

  await prisma.groupMembership.create({
    data: {
      clientId: createdClients[1].id,
      groupId: group2.id
    }
  });

  await prisma.groupMembership.create({
    data: {
      clientId: createdClients[2].id,
      groupId: group1.id
    }
  });

  await prisma.groupMembership.create({
    data: {
      clientId: createdClients[3].id,
      groupId: group2.id
    }
  });

  console.log('✅ Created group memberships');

  // Create membership types
  const monthlyMembership = await prisma.membership.create({
    data: {
      name: 'Monthly Unlimited',
      description: 'Unlimited access to all classes',
      price: 89.99,
      duration: 30,
      type: 'monthly',
      tenantId: tenant.id
    }
  });

  const quarterlyMembership = await prisma.membership.create({
    data: {
      name: 'Quarterly Package',
      description: '3 months of unlimited access',
      price: 249.99,
      duration: 90,
      type: 'quarterly',
      tenantId: tenant.id
    }
  });

  const yearlyMembership = await prisma.membership.create({
    data: {
      name: 'Annual Membership',
      description: 'Full year of unlimited access with 2 months free',
      price: 899.99,
      duration: 365,
      type: 'yearly',
      tenantId: tenant.id
    }
  });

  console.log('✅ Created membership types');

  // Create sample payments
  const payments = [
    {
      amount: 89.99,
      type: 'membership',
      status: 'paid',
      paymentMethod: 'card',
      clientId: createdClients[0].id,
      membershipId: monthlyMembership.id,
      paidAt: new Date(),
      tenantId: tenant.id
    },
    {
      amount: 249.99,
      type: 'membership',
      status: 'paid',
      paymentMethod: 'transfer',
      clientId: createdClients[1].id,
      membershipId: quarterlyMembership.id,
      paidAt: new Date(),
      tenantId: tenant.id
    },
    {
      amount: 25.00,
      type: 'single',
      status: 'paid',
      paymentMethod: 'cash',
      notes: 'Drop-in class',
      clientId: createdClients[2].id,
      paidAt: new Date(),
      tenantId: tenant.id
    }
  ];

  for (const paymentData of payments) {
    await prisma.payment.create({
      data: paymentData
    });
  }

  console.log('✅ Created sample payments');

  // Create sample achievements
  const achievements = [
    {
      title: 'Yellow Belt',
      description: 'First belt promotion',
      date: new Date('2023-06-15'),
      type: 'belt',
      clientId: createdClients[0].id
    },
    {
      title: 'Orange Belt',
      description: 'Second belt promotion',
      date: new Date('2023-09-20'),
      type: 'belt',
      clientId: createdClients[0].id
    },
    {
      title: 'White Belt',
      description: 'First belt promotion',
      date: new Date('2023-07-10'),
      type: 'belt',
      clientId: createdClients[1].id
    },
    {
      title: 'Tournament Winner',
      description: '1st place in youth tournament',
      date: new Date('2023-08-15'),
      type: 'award',
      clientId: createdClients[1].id
    }
  ];

  for (const achievementData of achievements) {
    await prisma.achievement.create({
      data: achievementData
    });
  }

  console.log('✅ Created sample achievements');

  // Create sample trainings for current week
  const today = new Date();
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Monday of current week

  const trainings = [
    {
      title: 'Adult Karate - Basic Techniques',
      description: 'Fundamental karate techniques and forms',
      startTime: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000), // Tuesday 18:00
      endTime: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000), // Tuesday 19:00
      isRecurring: true,
      recurrence: 'weekly',
      branchId: branch1.id,
      groupId: group1.id,
      trainerId: trainerProfile1.id,
      tenantId: tenant.id
    },
    {
      title: 'Youth Taekwondo - Forms Practice',
      description: 'Taekwondo forms and basic techniques',
      startTime: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000), // Tuesday 16:00
      endTime: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), // Tuesday 17:00
      isRecurring: true,
      recurrence: 'weekly',
      branchId: branch1.id,
      groupId: group2.id,
      trainerId: trainerProfile2.id,
      tenantId: tenant.id
    },
    {
      title: 'Advanced Karate - Sparring',
      description: 'Advanced sparring techniques and conditioning',
      startTime: new Date(currentWeekStart.getTime() + 2 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000), // Wednesday 19:00
      endTime: new Date(currentWeekStart.getTime() + 2 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000 + 30 * 60 * 1000), // Wednesday 20:30
      isRecurring: true,
      recurrence: 'weekly',
      branchId: branch2.id,
      groupId: group3.id,
      trainerId: trainerProfile1.id,
      tenantId: tenant.id
    },
    {
      title: 'Kids Karate - Fun Training',
      description: 'Fun karate training for kids',
      startTime: new Date(currentWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // Thursday 15:00
      endTime: new Date(currentWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000), // Thursday 16:00
      isRecurring: true,
      recurrence: 'weekly',
      branchId: branch1.id,
      groupId: group2.id,
      trainerId: trainerProfile2.id,
      tenantId: tenant.id
    },
    {
      title: 'Adult Self-Defense',
      description: 'Self-defense techniques and awareness',
      startTime: new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000 + 18 * 30 * 60 * 1000), // Friday 18:30
      endTime: new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000 + 19 * 30 * 60 * 1000), // Friday 19:30
      isRecurring: true,
      recurrence: 'weekly',
      branchId: branch2.id,
      groupId: group1.id,
      trainerId: trainerProfile1.id,
      tenantId: tenant.id
    }
  ];

  for (const trainingData of trainings) {
    await prisma.training.create({
      data: trainingData
    });
  }

  console.log('✅ Created sample trainings');

  // Create PromoCodeAdmin (Admin for managing marketers and promo codes)
  let promoCodeAdmin = await prisma.promoCodeAdmin.findFirst({
    where: { email: 'promo-admin@dragonacademy.com', tenantId: tenant.id }
  });
  
  if (!promoCodeAdmin) {
    promoCodeAdmin = await prisma.promoCodeAdmin.create({
      data: {
        name: 'Promo Code Manager',
        email: 'promo-admin@dragonacademy.com',
        password: hashedPassword,
        phone: '+1-555-0200',
        isActive: true,
        tenantId: tenant.id
      }
    });
    console.log('✅ Created promo code admin:', promoCodeAdmin.email);
  } else {
    console.log('✅ Promo code admin already exists:', promoCodeAdmin.email);
  }

  // Create Marketer
  let marketer = await prisma.marketer.findFirst({
    where: { email: 'marketer@dragonacademy.com', tenantId: tenant.id }
  });
  
  if (!marketer) {
    marketer = await prisma.marketer.create({
      data: {
        name: 'Marketing Specialist',
        email: 'marketer@dragonacademy.com',
        password: hashedPassword,
        phone: '+1-555-0201',
        type: 'MARKETER',
        isActive: true,
        tenantId: tenant.id
      }
    });
    console.log('✅ Created marketer:', marketer.email);
  } else {
    console.log('✅ Marketer already exists:', marketer.email);
  }

  // Create Media Partner (optional)
  let mediaPartner = await prisma.marketer.findFirst({
    where: { email: 'media-partner@dragonacademy.com', tenantId: tenant.id }
  });
  
  if (!mediaPartner) {
    mediaPartner = await prisma.marketer.create({
      data: {
        name: 'Media Partner',
        email: 'media-partner@dragonacademy.com',
        password: hashedPassword,
        phone: '+1-555-0202',
        type: 'MEDIA_PARTNER',
        isActive: true,
        tenantId: tenant.id
      }
    });
    console.log('✅ Created media partner:', mediaPartner.email);
  } else {
    console.log('✅ Media partner already exists:', mediaPartner.email);
  }

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Test Accounts:');
  console.log('Owner: owner@dragonacademy.com / password123');
  console.log('Admin: admin@dragonacademy.com / password123');
  console.log('Trainer 1: trainer1@dragonacademy.com / password123');
  console.log('Trainer 2: trainer2@dragonacademy.com / password123');
  console.log('Promo Code Admin: promo-admin@dragonacademy.com / password123');
  console.log('Marketer: marketer@dragonacademy.com / password123');
  console.log('Media Partner: media-partner@dragonacademy.com / password123');
  console.log('\n🏢 Tenant: dragon-academy');
  console.log('\n🔗 Login URLs:');
  console.log('Admin Panel: http://localhost:3000/login');
  console.log('Marketer Panel: http://localhost:3000/marketer/login');
  console.log('Promo Code Admin: http://localhost:3000/promo-code-admin/login');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
