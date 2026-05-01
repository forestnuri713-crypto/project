import { Injectable } from '@nestjs/common';
import { GuideKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGuideTemplateDto } from './dto/upsert-guide-template.dto';

@Injectable()
export class GuideTemplatesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.guideTemplate.findMany({ orderBy: { kind: 'asc' } });
  }

  findOne(kind: GuideKind) {
    return this.prisma.guideTemplate.findUnique({ where: { kind } });
  }

  upsert(dto: UpsertGuideTemplateDto) {
    return this.prisma.guideTemplate.upsert({
      where: { kind: dto.kind },
      create: { kind: dto.kind, content: dto.content },
      update: { content: dto.content },
    });
  }
}
