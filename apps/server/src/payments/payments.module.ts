import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PortoneService } from './portone.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PortoneService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
