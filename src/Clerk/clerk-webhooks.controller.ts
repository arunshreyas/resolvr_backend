import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookEvent } from '@clerk/backend/webhooks';
import { verifyWebhook } from '@clerk/express/webhooks';
import type { Request } from 'express';
import { UsersService } from '../Users/users.service';

@Controller('webhooks/clerk')
export class ClerkWebhooksController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() request: Request,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException('Missing Clerk webhook headers.');
    }

    const signingSecret = this.configService.get<string>(
      'CLERK_WEBHOOK_SIGNING_SECRET',
    );

    if (!signingSecret) {
      throw new BadRequestException(
        'CLERK_WEBHOOK_SIGNING_SECRET is not configured.',
      );
    }

    const event = await verifyWebhook(request, {
      signingSecret,
    });

    await this.handleEvent(event);

    return { received: true };
  }

  private async handleEvent(event: WebhookEvent) {
    if (event.type === 'user.deleted') {
      if (!event.data.id) {
        throw new BadRequestException(
          'Clerk user.deleted event is missing an id.',
        );
      }

      await this.usersService.deleteByClerkId(event.data.id);
      return;
    }

    if (event.type !== 'user.created' && event.type !== 'user.updated') {
      return;
    }

    const primaryEmail =
      event.data.email_addresses.find(
        (email) => email.id === event.data.primary_email_address_id,
      )?.email_address ?? event.data.email_addresses[0]?.email_address;

    if (!primaryEmail) {
      throw new BadRequestException(
        `Clerk user ${event.data.id} does not have an email address.`,
      );
    }

    const name = [event.data.first_name, event.data.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    await this.usersService.upsertFromClerk({
      clerkId: event.data.id,
      email: primaryEmail,
      name: name || undefined,
    });
  }
}
