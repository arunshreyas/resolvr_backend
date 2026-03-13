import { Module } from '@nestjs/common';
import { UsersModule } from '../Users/users.module';
import { AdminClerkGuard } from './admin-clerk.guard';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkWebhooksController } from './clerk-webhooks.controller';

@Module({
  imports: [UsersModule],
  controllers: [ClerkWebhooksController],
  providers: [ClerkAuthGuard, AdminClerkGuard],
  exports: [ClerkAuthGuard, AdminClerkGuard],
})
export class ClerkModule {}
