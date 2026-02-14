import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { PreparePaymentDto } from './dto/prepare-payment.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('prepare')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 세션 생성' })
  prepare(@Request() req: { user: { id: string } }, @Body() dto: PreparePaymentDto) {
    return this.paymentsService.preparePayment(req.user.id, dto);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'PortOne 웹훅 수신' })
  handleWebhook(@Body() payload: WebhookPayloadDto) {
    return this.paymentsService.handleWebhook(payload);
  }
}
