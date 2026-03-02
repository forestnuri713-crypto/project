import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { generateUniqueSlug } from '../public/slug.utils';

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

interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
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
        const role = dto.role ?? 'PARENT';
        user = await this.prisma.user.create({
          data: {
            email,
            kakaoId,
            name: nickname,
            profileImageUrl,
            phoneNumber: '',
            role,
            instructorStatus: role === 'INSTRUCTOR' ? 'APPLIED' : 'NONE',
          },
        });

        // Generate slug after creation (uses persisted user.id for suffix)
        try {
          const slug = await generateUniqueSlug(this.prisma, user.name, user.id);
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { slug },
          });
        } catch {
          // Slug generation is best-effort; user creation still succeeds
        }
      }
    }

    const token = this.generateToken(user);
    return {
      accessToken: token,
      user,
    };
  }

  async applyAsInstructor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('관리자는 강사 신청을 할 수 없습니다');
    }

    if (user.instructorStatus === 'APPROVED') {
      throw new BadRequestException('이미 승인된 강사입니다');
    }

    if (user.instructorStatus === 'APPLIED') {
      throw new BadRequestException('이미 강사 신청 중입니다');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'INSTRUCTOR',
        instructorStatus: 'APPLIED',
        instructorStatusReason: null,
      },
    });

    const token = this.generateToken(updated);
    return { accessToken: token, user: updated };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const payload = await this.verifyGoogleIdToken(dto.idToken);
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? email;
    const profileImageUrl = payload.picture;

    let user = await this.prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        if (user.role !== 'ADMIN') {
          throw new UnauthorizedException('관리자 권한이 없습니다');
        }
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId, profileImageUrl: profileImageUrl ?? user.profileImageUrl },
        });
      } else {
        throw new UnauthorizedException(
          '등록된 관리자 계정이 없습니다. 먼저 관리자로 등록해주세요.',
        );
      }
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedException('관리자 권한이 없습니다');
    }

    const token = this.generateToken(user);
    return { accessToken: token, user };
  }

  private generateToken(user: { id: string; email: string; role: string }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException('Google 인증에 실패했습니다');
    }

    const payload: GoogleTokenPayload = await response.json();

    if (clientId && payload.aud !== clientId) {
      throw new UnauthorizedException('Google 클라이언트 ID가 일치하지 않습니다');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('이메일이 인증되지 않은 Google 계정입니다');
    }

    return payload;
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
