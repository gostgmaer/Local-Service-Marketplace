import { Module } from '@nestjs/common';
import { ProposalController } from './controllers/proposal.controller';
import { ProposalService } from './services/proposal.service';
import { ProposalRepository } from './repositories/proposal.repository';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProposalController],
  providers: [ProposalService, ProposalRepository],
  exports: [ProposalService],
})
export class ProposalModule {}
