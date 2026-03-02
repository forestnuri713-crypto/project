import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async kakaoLogin(dto: KakaoLoginDto) {
    let kakaoAccessToken: string;

    if (dto.code) {
      kakaoAccessToken = await this.exchangeKakaoCode(dto.code, dto.redirectUri!);
    } else if (dto.accessToken) {
      kakaoAccessToken = dto.accessToken;
    } else {
      throw new BadRequestException('accessToken 또는 code가 필요합니다');
    }

    const kakaoUser = await this.getKakaoUserInfo(kakaoAccessToken);
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

  private generateToken(user: { id: string; email: string; role: string }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async exchangeKakaoCode(code: string, redirectUri: string): Promise<string> {
    const clientId = this.configService.get<string>('KAKAO_REST_API_KEY');
    if (!clientId) {
      throw new UnauthorizedException('KAKAO_REST_API_KEY가 설정되지 않았습니다');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(
        `카카오 토큰 교환 실패: ${response.status} ${JSON.stringify(data)} (redirect_uri: ${redirectUri})`,
      );
      throw new UnauthorizedException(
        `카카오 인가 코드 교환에 실패했습니다: ${data.error_description || data.error || response.status}`,
      );
    }

    return data.access_token;
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
