import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { LoginAttemptRepository } from '../repositories/login-attempt.repository';
import { JwtService } from './jwt.service';
import { TokenService } from './token.service';
import { SignupDto } from '../dto/signup.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  TooManyRequestsException,
  NotFoundException,
} from '@/common/exceptions/http.exceptions';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  private readonly maxLoginAttempts: number;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly loginAttemptRepo: LoginAttemptRepository,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.maxLoginAttempts = parseInt(
      this.configService.get<string>('MAX_LOGIN_ATTEMPTS', '5'),
      10,
    );
  }

  async signup(signupDto: SignupDto, ipAddress?: string): Promise<AuthResponseDto> {
    const { email, password } = signupDto;

    this.logger.info('Signup attempt', { context: 'AuthService', email });

    // Check if user already exists
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      this.logger.warn('Signup failed: User already exists', {
        context: 'AuthService',
        email,
      });
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const user = await this.userRepo.create(email, passwordHash);

    // Generate email verification token (but don't send email in this basic implementation)
    const verificationToken = await this.tokenService.createEmailVerificationToken(user.id);
    
    this.logger.info('User created successfully', {
      context: 'AuthService',
      userId: user.id,
      email: user.email,
      verificationToken, // In production, this would be sent via email
    });

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = this.jwtService.generateRefreshToken(user.id, user.email, user.role);

    // Store refresh token in session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await this.sessionRepo.create(user.id, refreshToken, expiresAt, ipAddress);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
      },
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    this.logger.info('Login attempt', { context: 'AuthService', email, ipAddress });

    // Check failed login attempts
    const failedAttempts = await this.loginAttemptRepo.countRecentFailedAttempts(email);
    if (failedAttempts >= this.maxLoginAttempts) {
      this.logger.warn('Login blocked: Too many failed attempts', {
        context: 'AuthService',
        email,
        failedAttempts,
      });
      throw new TooManyRequestsException(
        'Too many failed login attempts. Please try again later.',
      );
    }

    // Find user
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.password_hash) {
      await this.loginAttemptRepo.create(email, false, ipAddress);
      this.logger.warn('Login failed: Invalid credentials', {
        context: 'AuthService',
        email,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await this.loginAttemptRepo.create(email, false, ipAddress);
      this.logger.warn('Login failed: Invalid password', {
        context: 'AuthService',
        email,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (user.status !== 'active') {
      this.logger.warn('Login failed: Account not active', {
        context: 'AuthService',
        email,
        status: user.status,
      });
      throw new UnauthorizedException('Account is not active');
    }

    // Record successful login
    await this.loginAttemptRepo.create(email, true, ipAddress);

    this.logger.info('Login successful', {
      context: 'AuthService',
      userId: user.id,
      email: user.email,
    });

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = this.jwtService.generateRefreshToken(user.id, user.email, user.role);

    // Store refresh token in session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await this.sessionRepo.create(user.id, refreshToken, expiresAt, ipAddress);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    this.logger.info('Logout attempt', { context: 'AuthService' });
    
    await this.sessionRepo.deleteByRefreshToken(refreshToken);
    
    this.logger.info('Logout successful', { context: 'AuthService' });
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verifyRefreshToken(refreshToken);

      // Check if session exists
      const session = await this.sessionRepo.findByRefreshToken(refreshToken);
      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if session is expired
      if (new Date() > new Date(session.expires_at)) {
        await this.sessionRepo.deleteByRefreshToken(refreshToken);
        throw new UnauthorizedException('Refresh token expired');
      }

      // Get user
      const user = await this.userRepo.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new access token
      const accessToken = this.jwtService.generateAccessToken(
        user.id,
        user.email,
        user.role,
      );

      return { accessToken };
    } catch (error) {
      this.logger.error('Refresh token failed', {
        context: 'AuthService',
        error: error.message,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    this.logger.info('Password reset requested', { context: 'AuthService', email });

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      this.logger.warn('Password reset requested for non-existent user', {
        context: 'AuthService',
        email,
      });
      return;
    }

    const resetToken = await this.tokenService.createPasswordResetToken(user.id);
    
    this.logger.info('Password reset token created', {
      context: 'AuthService',
      userId: user.id,
      resetToken, // In production, this would be sent via email
    });

    // In production, send email with reset link containing the token
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    this.logger.info('Password reset confirmation attempt', { context: 'AuthService' });

    const userId = await this.tokenService.verifyPasswordResetToken(token);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password
    await this.userRepo.updatePassword(userId, passwordHash);

    // Delete all sessions for this user (force re-login)
    await this.sessionRepo.deleteByUserId(userId);

    this.logger.info('Password reset successful', {
      context: 'AuthService',
      userId,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    this.logger.info('Email verification attempt', { context: 'AuthService' });

    const userId = await this.tokenService.verifyEmailToken(token);
    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.userRepo.verifyEmail(userId);

    this.logger.info('Email verified successfully', {
      context: 'AuthService',
      userId,
    });
  }
}
