import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `당신은 숲 체험 / 자연 교육 프로그램의 메타데이터 분류 전문가입니다.

주어진 한국어 프로그램 설명을 읽고, 부모/이용자가 검색·필터링에 사용할 만한 한국어 키워드를 추출하세요.

규칙:
- 5~12개의 키워드를 반환합니다.
- 각 키워드는 짧은 명사 또는 명사구입니다 (예: "숲체험", "자연관찰", "곤충관찰", "공예/만들기", "안전교육").
- 일반적이고 모호한 표현(예: "좋다", "재미있다", "즐거운")은 제외합니다.
- 프로그램 대상 연령, 활동 유형, 장소 특징, 학습 주제를 두루 반영합니다.
- 중복되거나 의미가 거의 같은 키워드는 한 번만 포함합니다.
- 가능하면 일반적으로 통용되는 짧은 표현을 우선합니다.`;

@Injectable()
export class KeywordRecommenderService {
  private readonly logger = new Logger(KeywordRecommenderService.name);
  private readonly client: Anthropic | null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async recommend(description: string): Promise<string[]> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY 환경변수가 설정되어 있지 않습니다',
      );
    }

    const trimmed = description.trim();
    if (trimmed.length < 10) {
      throw new BadRequestException('설명이 너무 짧아 키워드를 추천할 수 없습니다');
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['keywords'],
              additionalProperties: false,
            },
          },
        },
        messages: [{ role: 'user', content: trimmed }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('키워드 추천 응답에 텍스트 블록이 없습니다');
      }

      const parsed = JSON.parse(textBlock.text) as { keywords?: unknown };
      const keywords = Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : [];

      const deduped = Array.from(new Set(keywords.map((k) => k.trim())));
      return deduped.slice(0, 12);
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        this.logger.error(`Anthropic API error ${err.status}: ${err.message}`);
        throw new ServiceUnavailableException('키워드 추천 서비스 호출에 실패했습니다');
      }
      throw err;
    }
  }
}
