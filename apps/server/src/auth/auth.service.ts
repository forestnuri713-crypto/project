import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async kakaoLogin(dto: KakaoLoginDto) {
    const kakaoUser = await this.getKakaoUserInfo(dto.accessToken);
    const kakaoId = String(kakaoUser.id);
    const email = kakaoUser.kakao_account?.email;
    const nickname = kakaoUser.kakao_account?.profile?.nickname ?? '카카오 사용자';
    const profileImageUrl = kakaoUser.kakao_account?.profile?.profile_image_url;

    let user = await this.prisma.user.findUnique({ where: { kakaoId } });

    if (!user) {
      if (email) {
        user = await this.prisma.user.findUnique({ where: { email } });
      }

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { kakaoId, profileImageUrl },
        });
      } else {
        if (!email) {
          throw new UnauthorizedException('카카오 계정에 이메일 정보가 필요합니다');
        }
        user = await this.prisma.user.create({
          data: {
            email,
            kakaoId,
            name: nickname,
            profileImageUrl,
            phoneNumber: '',
            role: dto.role ?? 'PARENT',
          },
        });
      }
    }

    const token = this.generateToken(user);
    return {
      accessToken: token,
      user,
    };
  }

  private generateToken(user: { id: string; email: string; role: string }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('카카오 인증에 실패했습니다');
    }

    return response.json();
  }
}
