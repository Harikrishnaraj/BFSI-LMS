import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe!123';

const users = [
  { email: 'admin@bfsi-lms.test', name: 'Ada Admin', role: 'admin', department: 'Compliance' },
  { email: 'instructor@bfsi-lms.test', name: 'Ivan Instructor', role: 'instructor', department: 'Risk' },
  { email: 'learner@bfsi-lms.test', name: 'Lena Learner', role: 'learner', department: 'Retail Banking' },
] as const;

const main = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts in production');
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Upsert so re-running the seed is safe.
  const [admin, instructor] = await Promise.all(
    users.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        create: { ...u, passwordHash },
        update: { name: u.name, role: u.role, department: u.department },
      })
    )
  );

  const courses = [
    {
      title: 'AML & KYC Fundamentals',
      description: 'Anti-money-laundering obligations and customer due diligence.',
      category: 'Compliance',
      status: 'published',
      isMandatory: true,
      complianceType: 'AML',
      targetAudience: 'All staff',
      ownerId: admin.id,
    },
    {
      title: 'Information Security Awareness',
      description: 'Phishing, data handling, and incident reporting.',
      category: 'Security',
      status: 'published',
      isMandatory: true,
      complianceType: 'InfoSec',
      targetAudience: 'All staff',
      ownerId: instructor.id,
    },
    {
      title: 'Credit Risk Basics',
      description: 'Draft module on credit exposure and provisioning.',
      category: 'Risk',
      status: 'draft',
      isMandatory: false,
      targetAudience: 'Risk analysts',
      ownerId: instructor.id,
    },
  ] as const;

  for (const course of courses) {
    const existing = await prisma.course.findFirst({ where: { title: course.title } });
    if (existing) {
      await prisma.course.update({ where: { id: existing.id }, data: course });
    } else {
      await prisma.course.create({ data: course });
    }
  }

  console.log(`Seeded ${users.length} users and ${courses.length} courses.`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
};

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
