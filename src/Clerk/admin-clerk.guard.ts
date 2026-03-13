import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { UsersService } from '../Users/users.service';

@Injectable()
export class AdminClerkGuard extends ClerkAuthGuard {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super(configService);
  }

  async canActivate(context: Parameters<ClerkAuthGuard['canActivate']>[0]) {
    const isAuthenticated = await super.canActivate(context);

    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest<{
      clerkUserId?: string;
    }>();

    if (!request.clerkUserId) {
      throw new UnauthorizedException('Missing Clerk user id.');
    }

    const user = await this.usersService.findByClerkId(request.clerkUserId);

    if (!user) {
      throw new UnauthorizedException('No synced user found for this admin.');
    }

    const allowedEmails =
      process.env.ADMIN_EMAILS?.split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean) || [];
    const allowedClerkIds =
      process.env.ADMIN_CLERK_IDS?.split(',')
        .map((id) => id.trim())
        .filter(Boolean) || [];

    const isAdmin =
      allowedEmails.includes(user.email.toLowerCase()) ||
      (!!user.clerkId && allowedClerkIds.includes(user.clerkId));

    if (!isAdmin) {
      throw new UnauthorizedException(
        'This account is not allowed to access admin operations.',
      );
    }

    return true;
  }
}
