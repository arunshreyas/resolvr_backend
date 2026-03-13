import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import type { Request } from 'express';
import { toStandardWebRequest } from './clerk-request';

type AuthenticatedRequest = Request & {
  clerkUserId?: string;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    const publishableKey = this.configService.get<string>(
      'CLERK_PUBLISHABLE_KEY',
    );

    if (!secretKey || !publishableKey) {
      throw new UnauthorizedException(
        'Clerk backend configuration is missing.',
      );
    }

    const clerkClient = createClerkClient({
      secretKey,
      publishableKey,
    });

    const authState = await clerkClient.authenticateRequest(
      toStandardWebRequest(request),
      {
        acceptsToken: 'session_token',
        authorizedParties: this.configService
          .get<string>('CLERK_AUTHORIZED_PARTIES')
          ?.split(',')
          .map((party) => party.trim())
          .filter(Boolean),
      },
    );

    if (!authState.isAuthenticated) {
      throw new UnauthorizedException(
        'Invalid or missing Clerk session token.',
      );
    }

    request.clerkUserId = authState.toAuth().userId;
    return true;
  }
}
