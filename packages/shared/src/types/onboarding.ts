export interface OnboardingState {
  id: string;
  userId: string;
  onboardingVersion: number;
  completed: boolean;
  dismissed: boolean;
  checklist: Record<string, boolean>;
  tour: Record<string, TourState>;
  visitedRoutes: Record<string, boolean>;
  lastResetAt: string | null;
  resetCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface TourState {
  completed: boolean;
  dismissed: boolean;
  lastStepId: string | null;
}

export interface UpdateChecklistRequest {
  key: string;
  value: boolean;
}

export interface UpdateTourRequest {
  tourKey: string;
  dismissed?: boolean;
  completed?: boolean;
  lastStepId?: string;
}

export interface UpdateVisitedRouteRequest {
  key: string;
  value: boolean;
}
