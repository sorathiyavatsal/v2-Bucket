// Hono context type definitions
import type { User } from '@repo/database';

export interface AppEnv {
  Variables: {
    user: User;
  };
}
