import { Module } from '@nestjs/common';
import { UsersModule } from '../Users/users.module';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkWebhooksController } from './clerk-webhooks.controller';

@Module({
  imports: [UsersModule],
  controllers: [ClerkWebhooksController],
  providers: [ClerkAuthGuard],
  exports: [ClerkAuthGuard],
})
export class ClerkModule {}
