import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { EmailLoginDto } from './dto/email-login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '이메일/비밀번호 로그인' })
  emailLogin(@Body() dto: EmailLoginDto) {
    return this.authService.emailLogin(dto);
  }

  @Post('kakao')
  @ApiOperation({ summary: '카카오 로그인' })
  kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLogin(dto);
  }

  @Post('google')
  @ApiOperation({ summary: '구글 로그인' })
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('apply-instructor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '강사 신청 (PARENT → INSTRUCTOR 전환)' })
  applyAsInstructor(@Request() req: { user: { id: string } }) {
    return this.authService.applyAsInstructor(req.user.id);
  }
}
