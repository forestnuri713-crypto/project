import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('kakao')
  @ApiOperation({ summary: '카카오 로그인' })
  kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLogin(dto);
  }
}
