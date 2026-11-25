import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ClientIp = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => ctx.switchToHttp().getRequest().ip ?? null,
);