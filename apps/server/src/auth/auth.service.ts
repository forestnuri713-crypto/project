import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        role: dto.role,
      },
    });

    const token = this.generateToken(user);
    return {
      accessToken: token,
      user: this.excludePassword(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.password) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const token = this.generateToken(user);
    return {
      accessToken: token,
      user: this.excludePassword(user),
    };
  }

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
            role: 'PARENT',
          },
        });
      }
    }

    const token = this.generateToken(user);
    return {
      accessToken: token,
      user: this.excludePassword(user),
    };
  }

  private generateToken(user: { id: string; email: string; role: string }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private excludePassword(user: Record<string, unknown>) {
    const { password: _, ...rest } = user;
    return rest;
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
