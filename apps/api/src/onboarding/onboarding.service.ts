import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOnboarding } from '../entities/user-onboarding.entity';
import { CHECKLIST_KEYS, ONBOARDING_VERSION, ROUTE_GUIDE_KEYS } from '@contractai-review/shared';
import type { UpdateChecklistRequest, UpdateTourRequest, UpdateVisitedRouteRequest } from '@contractai-review/shared';

const DEFAULT_CHECKLIST: Record<string, boolean> = Object.fromEntries(
  CHECKLIST_KEYS.map((key) => [key, false]),
);

const DEFAULT_VISITED_ROUTES: Record<string, boolean> = Object.fromEntries(
  ROUTE_GUIDE_KEYS.map((key) => [key, false]),
);

const DEFAULT_TOUR = {
  primary: {
    completed: false,
    dismissed: false,
    lastStepId: null as string | null,
  },
};

function toResponse(entity: UserOnboarding) {
  return {
    id: entity.id,
    userId: entity.userId,
    onboardingVersion: entity.onboardingVersion,
    completed: entity.completed,
    dismissed: entity.dismissed,
    checklist: entity.checklist ?? {},
    tour: entity.tour ?? {},
    visitedRoutes: entity.visitedRoutes ?? {},
    lastResetAt: entity.lastResetAt?.toISOString() ?? null,
    resetCount: entity.resetCount,
    updatedAt: entity.updatedAt.toISOString(),
    createdAt: entity.createdAt.toISOString(),
  };
}

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(UserOnboarding)
    private readonly repo: Repository<UserOnboarding>,
  ) {}

  async getOrCreateState(userId: string) {
    let entity = await this.repo.findOne({ where: { userId } });
    if (!entity) {
      entity = this.repo.create({
        userId,
        onboardingVersion: ONBOARDING_VERSION,
        completed: false,
        dismissed: false,
        checklist: { ...DEFAULT_CHECKLIST },
        tour: { ...DEFAULT_TOUR },
        visitedRoutes: { ...DEFAULT_VISITED_ROUTES },
      });
      await this.repo.save(entity);
    }
    return toResponse(entity);
  }

  async updateChecklist(userId: string, body: UpdateChecklistRequest) {
    const key = body.key;
    if (!CHECKLIST_KEYS.includes(key as (typeof CHECKLIST_KEYS)[number])) {
      throw new BadRequestException(`Invalid checklist key: ${key}`);
    }
    let entity = await this.repo.findOne({ where: { userId } });
    if (!entity) {
      entity = this.repo.create({
        userId,
        onboardingVersion: ONBOARDING_VERSION,
        completed: false,
        dismissed: false,
        checklist: { ...DEFAULT_CHECKLIST },
        tour: { ...DEFAULT_TOUR },
        visitedRoutes: { ...DEFAULT_VISITED_ROUTES },
      });
      await this.repo.save(entity);
    }
    const checklist = { ...(entity.checklist ?? {}), [key]: body.value };
    entity.checklist = checklist;
    await this.repo.save(entity);
    return toResponse(entity);
  }

  async updateVisitedRoute(userId: string, body: UpdateVisitedRouteRequest) {
    const key = body.key;
    if (!ROUTE_GUIDE_KEYS.includes(key as (typeof ROUTE_GUIDE_KEYS)[number])) {
      throw new BadRequestException(`Invalid route guide key: ${key}`);
    }
    let entity = await this.repo.findOne({ where: { userId } });
    if (!entity) {
      entity = this.repo.create({
        userId,
        onboardingVersion: ONBOARDING_VERSION,
        completed: false,
        dismissed: false,
        checklist: { ...DEFAULT_CHECKLIST },
        tour: { ...DEFAULT_TOUR },
        visitedRoutes: { ...DEFAULT_VISITED_ROUTES },
      });
      await this.repo.save(entity);
    }
    const visitedRoutes = { ...(entity.visitedRoutes ?? {}), [key]: body.value };
    entity.visitedRoutes = visitedRoutes;
    await this.repo.save(entity);
    return toResponse(entity);
  }

  async updateTour(userId: string, body: UpdateTourRequest) {
    let entity = await this.repo.findOne({ where: { userId } });
    if (!entity) {
      entity = this.repo.create({
        userId,
        onboardingVersion: ONBOARDING_VERSION,
        completed: false,
        dismissed: false,
        checklist: { ...DEFAULT_CHECKLIST },
        tour: { ...DEFAULT_TOUR },
        visitedRoutes: { ...DEFAULT_VISITED_ROUTES },
      });
      await this.repo.save(entity);
    }
    const tourKey = body.tourKey;
    const existing = (entity.tour ?? {})[tourKey] ?? {
      completed: false,
      dismissed: false,
      lastStepId: null,
    };
    const updated = {
      ...existing,
      ...(body.dismissed !== undefined && { dismissed: body.dismissed }),
      ...(body.completed !== undefined && { completed: body.completed }),
      ...(body.lastStepId !== undefined && { lastStepId: body.lastStepId }),
    };
    entity.tour = { ...(entity.tour ?? {}), [tourKey]: updated };
    await this.repo.save(entity);
    return toResponse(entity);
  }

  async complete(userId: string) {
    const entity = await this.repo.findOne({ where: { userId } });
    if (!entity) {
      const created = this.repo.create({
        userId,
        onboardingVersion: ONBOARDING_VERSION,
        completed: true,
        dismissed: false,
        checklist: { ...DEFAULT_CHECKLIST },
        tour: { ...DEFAULT_TOUR },
        visitedRoutes: { ...DEFAULT_VISITED_ROUTES },
      });
      await this.repo.save(created);
      return toResponse(created);
    }
    entity.completed = true;
    await this.repo.save(entity);
    return toResponse(entity);
  }

  async dismiss(userId: string) {
    const entity = await this.repo.findOne({ where: { userId } });
    if (!entity) {
      const created = this.repo.create({
        userId,
        onboardingVersion: ONBOARDING_VERSION,
        completed: false,
        dismissed: true,
        checklist: { ...DEFAULT_CHECKLIST },
        tour: { ...DEFAULT_TOUR },
        visitedRoutes: { ...DEFAULT_VISITED_ROUTES },
      });
      await this.repo.save(created);
      return toResponse(created);
    }
    entity.dismissed = true;
    await this.repo.save(entity);
    return toResponse(entity);
  }

  async reset(userId: string) {
    let entity = await this.repo.findOne({ where: { userId } });
    if (!entity) {
      entity = this.repo.create({
        userId,
        onboardingVersion: ONBOARDING_VERSION,
        completed: false,
        dismissed: false,
        checklist: { ...DEFAULT_CHECKLIST },
        tour: { primary: DEFAULT_TOUR.primary },
        visitedRoutes: { ...DEFAULT_VISITED_ROUTES },
        lastResetAt: new Date(),
        resetCount: 1,
      });
      await this.repo.save(entity);
      return toResponse(entity);
    }
    entity.completed = false;
    entity.dismissed = false;
    entity.checklist = { ...DEFAULT_CHECKLIST };
    entity.tour = { primary: { completed: false, dismissed: false, lastStepId: null } };
    entity.visitedRoutes = { ...DEFAULT_VISITED_ROUTES };
    entity.onboardingVersion = ONBOARDING_VERSION;
    entity.lastResetAt = new Date();
    entity.resetCount = (entity.resetCount ?? 0) + 1;
    await this.repo.save(entity);
    return toResponse(entity);
  }
}
