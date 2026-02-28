import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController, AccountController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SuperadminService } from './superadmin.service';
import { User } from '../entities/user.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { Workspace } from '../entities/workspace.entity';
import { AssetManagerModule } from '../asset-manager/asset-manager.module';
import { UserStorageModule } from '../storage/user-storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, WorkspaceMember, Workspace]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'change-me-in-production-min-32-chars',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
    AssetManagerModule,
    UserStorageModule,
  ],
  controllers: [AuthController, AccountController],
  providers: [AuthService, JwtStrategy, SuperadminService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
