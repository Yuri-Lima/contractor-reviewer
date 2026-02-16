import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../workspace/decorators';
import { OnboardingService } from './onboarding.service';
import type { UpdateChecklistRequest, UpdateTourRequest, UpdateVisitedRouteRequest } from '@contractai-review/shared';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getState(@CurrentUser() user: { id: string }) {
    return this.onboardingService.getOrCreateState(user.id);
  }

  @Patch('checklist')
  @HttpCode(HttpStatus.OK)
  async updateChecklist(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateChecklistRequest,
  ) {
    return this.onboardingService.updateChecklist(user.id, body);
  }

  @Patch('visited-routes')
  @HttpCode(HttpStatus.OK)
  async updateVisitedRoute(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateVisitedRouteRequest,
  ) {
    return this.onboardingService.updateVisitedRoute(user.id, body);
  }

  @Patch('tour')
  @HttpCode(HttpStatus.OK)
  async updateTour(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateTourRequest,
  ) {
    return this.onboardingService.updateTour(user.id, body);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@CurrentUser() user: { id: string }) {
    return this.onboardingService.complete(user.id);
  }

  @Post('dismiss')
  @HttpCode(HttpStatus.OK)
  async dismiss(@CurrentUser() user: { id: string }) {
    return this.onboardingService.dismiss(user.id);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(@CurrentUser() user: { id: string }) {
    return this.onboardingService.reset(user.id);
  }
}
