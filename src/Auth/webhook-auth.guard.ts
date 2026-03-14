import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-api-key'];
    const expectedKey = this.configService.get<string>('CLERK_SECRET_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('Webhook secret is not configured.');
    }

    if (!providedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API key.');
    }

    return true;
  }
}
