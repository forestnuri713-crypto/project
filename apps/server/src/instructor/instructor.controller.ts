import { Body, Controller, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InstructorService } from './instructor.service';
import { UpdateSlugDto } from './dto/update-slug.dto';

@ApiTags('Instructor')
@Controller('instructor')
export class InstructorController {
  constructor(private instructorService: InstructorService) {}

  @Patch('slug')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '강사 슬러그 변경 (1회 제한)' })
  updateSlug(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateSlugDto,
  ) {
    return this.instructorService.updateSlug(req.user.id, dto.slug);
  }
}
