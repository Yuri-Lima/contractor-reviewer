import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prompt } from '../entities/prompt.entity';
import { PromptService } from './prompt.service';
import { PromptsController } from './prompts.controller';
import { GlobalPromptsController } from './global-prompts.controller';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [TypeOrmModule.forFeature([Prompt]), WorkspaceModule],
  controllers: [PromptsController, GlobalPromptsController],
  providers: [PromptService],
  exports: [PromptService],
})
export class PromptsModule {}
