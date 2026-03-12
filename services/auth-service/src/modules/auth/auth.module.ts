import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { JwtService } from './services/jwt.service';
import { TokenService } from './services/token.service';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { EmailVerificationTokenRepository } from './repositories/email-verification-token.repository';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { LoginAttemptRepository } from './repositories/login-attempt.repository';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    TokenService,
    UserRepository,
    SessionRepository,
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    LoginAttemptRepository,
    JwtAuthGuard,
  ],
  exports: [JwtService, JwtAuthGuard],
})
export class AuthModule {}
