import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { PortoneService } from './portone.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PayoutsService, PortoneService],
  exports: [PaymentsService, PayoutsService],
})
export class PaymentsModule {}
