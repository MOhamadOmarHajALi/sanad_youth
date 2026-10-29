import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator/roles.docrator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // إذا لم يُحدد أدوار، المسار متاح للمسجلين فقط
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة');
    }

    return true;
  }
}