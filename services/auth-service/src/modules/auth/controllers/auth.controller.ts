import { Controller, Post, Body, Ip, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuthService } from '../services/auth.service';
import { SignupDto } from '../dto/signup.dto';
import { LoginDto } from '../dto/login.dto';
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from '../dto/password-reset-confirm.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Post('signup')
  async signup(
    @Body() signupDto: SignupDto,
    @Ip() ipAddress: string,
  ): Promise<AuthResponseDto> {
    this.logger.info('POST /auth/signup', {
      context: 'AuthController',
      email: signupDto.email,
      ipAddress,
    });
    return this.authService.signup(signupDto, ipAddress);
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
  ): Promise<AuthResponseDto> {
    this.logger.info('POST /auth/login', {
      context: 'AuthController',
      email: loginDto.email,
      ipAddress,
    });
    return this.authService.login(loginDto, ipAddress);
  }

  @Post('logout')
  async logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ message: string }> {
    this.logger.info('POST /auth/logout', { context: 'AuthController' });
    await this.authService.logout(refreshTokenDto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    this.logger.info('POST /auth/refresh', { context: 'AuthController' });
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Post('password-reset/request')
  async requestPasswordReset(
    @Body() passwordResetRequestDto: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    this.logger.info('POST /auth/password-reset/request', {
      context: 'AuthController',
      email: passwordResetRequestDto.email,
    });
    await this.authService.requestPasswordReset(passwordResetRequestDto.email);
    return { message: 'Password reset email sent if account exists' };
  }

  @Post('password-reset/confirm')
  async confirmPasswordReset(
    @Body() passwordResetConfirmDto: PasswordResetConfirmDto,
  ): Promise<{ message: string }> {
    this.logger.info('POST /auth/password-reset/confirm', {
      context: 'AuthController',
    });
    await this.authService.confirmPasswordReset(
      passwordResetConfirmDto.token,
      passwordResetConfirmDto.newPassword,
    );
    return { message: 'Password reset successful' };
  }
}
