/**
 * Script para tornar um usuário Owner de um workspace
 * 
 * Uso:
 *   ts-node apps/api/src/scripts/make-user-owner.ts <workspaceId> <email>
 * 
 * Exemplo:
 *   ts-node apps/api/src/scripts/make-user-owner.ts 8dcfd81b-f493-4280-9173-0e37b454f654 y.m.lima19@gmail.com
 */

import { AppDataSource } from '../data-source';
import { User } from '../entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '../entities/workspace-member.entity';

async function makeUserOwner(workspaceId: string, email: string) {
  console.log(`\n🔧 Making user ${email} Owner of workspace ${workspaceId}...\n`);

  // Normalizar email
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`📧 Normalized email: ${normalizedEmail}`);

  // Conectar ao banco
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  console.log('✅ Database connected');

  try {
    // Buscar usuário por email
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .getOne();

    if (!user) {
      console.error(`❌ User with email ${normalizedEmail} not found`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.id} - ${user.email} - ${user.name || 'No name'}`);

    // Buscar membership
    const memberRepository = AppDataSource.getRepository(WorkspaceMember);
    const membership = await memberRepository.findOne({
      where: {
        workspaceId,
        userId: user.id,
      },
    });

    if (!membership) {
      console.error(`❌ User is not a member of workspace ${workspaceId}`);
      console.log(`💡 Adding user as Owner...`);
      
      // Adicionar como Owner
      const newMembership = memberRepository.create({
        workspaceId,
        userId: user.id,
        role: WorkspaceRole.OWNER,
      });
      await memberRepository.save(newMembership);
      console.log(`✅ User added as Owner`);
    } else {
      console.log(`📋 Current role: ${membership.role}`);
      
      if (membership.role === WorkspaceRole.OWNER) {
        console.log(`✅ User is already Owner`);
      } else {
        // Atualizar role para Owner
        membership.role = WorkspaceRole.OWNER;
        await memberRepository.save(membership);
        console.log(`✅ Role updated to OWNER`);
      }
    }

    console.log(`\n🎉 Success! User ${email} is now Owner of workspace ${workspaceId}\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

// Executar script
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: ts-node make-user-owner.ts <workspaceId> <email>');
  console.error('Example: ts-node make-user-owner.ts 8dcfd81b-f493-4280-9173-0e37b454f654 y.m.lima19@gmail.com');
  process.exit(1);
}

const [workspaceId, email] = args;
makeUserOwner(workspaceId, email).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
