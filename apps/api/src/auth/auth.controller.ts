import { Controller, Post, Delete, Get, Body, Query, UseGuards, HttpCode, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../workspace/decorators';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('users/search')
  @UseGuards(JwtAuthGuard)
  async searchUserByEmail(@Query('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email query parameter is required');
    }
    
    // Normalizar email: trim + lowercase
    const normalizedEmail = email.trim().toLowerCase();
    
    const user = await this.authService.findByEmail(normalizedEmail);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private authService: AuthService) {}

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: { id: string }): Promise<void> {
    await this.authService.deleteAccount(user.id);
  }
}
