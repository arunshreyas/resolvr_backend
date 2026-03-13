import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UsersModule } from '../Users/users.module';
import { ComplaintsController } from './complaint.controller';
import { ComplaintsService } from './complaint.service';

@Module({
  imports: [UsersModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService, PrismaService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
