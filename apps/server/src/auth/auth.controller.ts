import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { KakaoLoginDto } from './dto/kakao-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '이메일 회원가입' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '이메일 로그인' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('kakao')
  @ApiOperation({ summary: '카카오 로그인' })
  kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLogin(dto);
  }
}
