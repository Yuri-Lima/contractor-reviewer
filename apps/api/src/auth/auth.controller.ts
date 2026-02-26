import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import type { UpdateUserStorageRequest } from '@contractai-review/shared';
import { AuthService } from './auth.service';
import { ImageManagerService } from '../image-manager/image-manager.service';
import { UserStorageService } from '../storage/user-storage.service';
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
  constructor(
    private authService: AuthService,
    private imageManagerService: ImageManagerService,
    private userStorageService: UserStorageService,
  ) {}

  @Get()
  async getAccount(@CurrentUser() user: { id: string }) {
    const account = await this.authService.getAccount(user.id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadAvatar(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    await this.imageManagerService.uploadImage('avatar', user.id, file);
    const account = await this.authService.getAccount(user.id);
    return account;
  }

  @Get('avatar')
  async getAvatar(@CurrentUser() user: { id: string }, @Res() res: Response): Promise<void> {
    try {
      const { buffer, mimeType } = await this.imageManagerService.getImageBuffer('avatar', user.id);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(buffer);
    } catch {
      res.status(404).send();
    }
  }

  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@CurrentUser() user: { id: string }): Promise<void> {
    await this.imageManagerService.deleteImage('avatar', user.id);
  }

  @Get('storage')
  async getStorage(@CurrentUser() user: { id: string }) {
    return this.userStorageService.getConfig(user.id);
  }

  @Put('storage')
  async updateStorage(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateUserStorageRequest,
  ) {
    return this.userStorageService.updateConfig(user.id, body);
  }

  @Delete('storage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStorage(@CurrentUser() user: { id: string }): Promise<void> {
    await this.userStorageService.deleteConfig(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: { id: string }): Promise<void> {
    await this.imageManagerService.deleteImage('avatar', user.id);
    await this.userStorageService.deleteConfig(user.id);
    await this.authService.deleteAccount(user.id);
  }
}
