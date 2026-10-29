import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';

export interface AuthUser {
  id: number;
  role: Role;
  sid: number;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    return field ? user?.[field] : user;
  },
);
