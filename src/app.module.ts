import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ComplaintsModule } from './Complaints/complaint.module';
import { UsersModule } from './Users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    ComplaintsModule,
  ],
})
export class AppModule {}
