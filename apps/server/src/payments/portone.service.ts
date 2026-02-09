import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PortoneService {
  private readonly logger = new Logger(PortoneService.name);
  private readonly baseUrl = 'https://api.portone.io';
  private readonly apiSecret: string;

  constructor(private configService: ConfigService) {
    this.apiSecret = this.configService.get<string>('PORTONE_API_SECRET', '');
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `PortOne ${this.apiSecret}`,
    };
  }

  async preRegister(paymentId: string, totalAmount: number, currency = 'KRW') {
    const url = `${this.baseUrl}/payments/${paymentId}/pre-register`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ totalAmount, currency }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`PortOne pre-register failed: ${response.status} ${body}`);
      throw new InternalServerErrorException('결제 사전등록에 실패했습니다');
    }

    return response.json();
  }

  async getPaymentDetail(paymentId: string) {
    const url = `${this.baseUrl}/payments/${paymentId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`PortOne getPaymentDetail failed: ${response.status} ${body}`);
      throw new InternalServerErrorException('결제 정보 조회에 실패했습니다');
    }

    return response.json();
  }

  async requestRefund(paymentId: string, amount: number, reason: string) {
    const url = `${this.baseUrl}/payments/${paymentId}/cancel`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ amount, reason }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`PortOne requestRefund failed: ${response.status} ${body}`);
      throw new InternalServerErrorException('환불 처리에 실패했습니다');
    }

    return response.json();
  }
}
