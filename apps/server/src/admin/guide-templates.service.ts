import { Injectable, NotFoundException } from '@nestjs/common';
import { GuideKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuideTemplateDto } from './dto/create-guide-template.dto';
import { UpdateGuideTemplateDto } from './dto/update-guide-template.dto';

@Injectable()
export class GuideTemplatesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.guideTemplate.findMany({
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findByKind(kind: GuideKind) {
    return this.prisma.guideTemplate.findMany({
      where: { kind },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.guideTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('GuideTemplate not found');
    return template;
  }

  create(dto: CreateGuideTemplateDto) {
    return this.prisma.guideTemplate.create({
      data: {
        kind: dto.kind,
        title: dto.title,
        content: dto.content,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateGuideTemplateDto) {
    await this.findOne(id);
    return this.prisma.guideTemplate.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.guideTemplate.delete({ where: { id } });
  }
}
