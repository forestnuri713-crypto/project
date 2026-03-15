import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * 숲체험 업체 관리자(OWNER) 시드 스크립트
 *
 * 환경 변수:
 *   COMPANY_NAME          - 업체명 (기본값: '숲체험 교육센터')
 *   COMPANY_REGION_TAGS   - 지역 태그 JSON 배열 (기본값: '["경기","서울"]')
 *   COMPANY_ADMIN_EMAIL   - 관리자 이메일 (기본값: 'company-admin@sooptalk.com')
 *   COMPANY_ADMIN_PASSWORD- 관리자 비밀번호 (기본값: 'company1234!')
 *   COMPANY_ADMIN_NAME    - 관리자 이름 (기본값: '업체관리자')
 *   COMPANY_ADMIN_PHONE   - 관리자 전화번호 (기본값: '')
 */
async function main() {
  const prisma = new PrismaClient();

  const companyName = process.env.COMPANY_NAME || '숲체험 교육센터';
  const regionTags: string[] = JSON.parse(process.env.COMPANY_REGION_TAGS || '["경기","서울"]');
  const email = process.env.COMPANY_ADMIN_EMAIL || 'company-admin@sooptalk.com';
  const password = process.env.COMPANY_ADMIN_PASSWORD || 'company1234!';
  const name = process.env.COMPANY_ADMIN_NAME || '업체관리자';
  const phoneNumber = process.env.COMPANY_ADMIN_PHONE || '';

  const hashed = await bcrypt.hash(password, 10);

  // 1. 업체(Provider) 생성 또는 조회
  let provider = await prisma.provider.findFirst({
    where: { name: companyName },
  });

  if (!provider) {
    provider = await prisma.provider.create({
      data: {
        name: companyName,
        businessType: '숲체험',
        regionTags,
      },
    });
    console.log(`Provider created: ${provider.name} (id: ${provider.id})`);
  } else {
    console.log(`Provider already exists: ${provider.name} (id: ${provider.id})`);
  }

  // 2. 업체 관리자 계정(User) 생성 또는 업데이트
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashed,
      role: 'INSTRUCTOR',
      instructorStatus: 'APPROVED',
    },
    create: {
      email,
      password: hashed,
      name,
      role: 'INSTRUCTOR',
      phoneNumber,
      instructorStatus: 'APPROVED',
    },
  });
  console.log(`Company admin account ready: ${user.email} (id: ${user.id})`);

  // 3. 업체 멤버(ProviderMember) 연결 - OWNER 권한으로 등록
  const existingMembership = await prisma.providerMember.findUnique({
    where: {
      providerId_userId: {
        providerId: provider.id,
        userId: user.id,
      },
    },
  });

  if (!existingMembership) {
    await prisma.providerMember.create({
      data: {
        providerId: provider.id,
        userId: user.id,
        roleInProvider: 'OWNER',
        status: 'ACTIVE',
      },
    });
    console.log(`ProviderMember created: user ${user.id} → provider ${provider.id} (OWNER)`);
  } else {
    console.log(`ProviderMember already exists (role: ${existingMembership.roleInProvider})`);
  }

  console.log('\n✅ 업체 관리자 설정 완료');
  console.log(`   업체명    : ${provider.name}`);
  console.log(`   이메일    : ${user.email}`);
  console.log(`   비밀번호  : ${password}`);
  console.log(`   권한      : OWNER (프로그램 등록 가능)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
