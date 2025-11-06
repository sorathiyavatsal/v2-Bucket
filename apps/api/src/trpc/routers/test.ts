// Test Router - Example tRPC router
import { router, publicProcedure, protectedProcedure } from '../init.js';
import { z } from 'zod';

export const testRouter = router({
  // Public procedure - anyone can call
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return {
        message: `Hello ${input.name || 'World'}!`,
        timestamp: new Date().toISOString(),
      };
    }),

  // Protected procedure - requires authentication
  getMe: protectedProcedure
    .query(({ ctx }) => {
      return {
        user: ctx.user,
      };
    }),

  // Example mutation
  echo: publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(({ input }) => {
      return {
        echo: input.text,
        length: input.text.length,
      };
    }),
});
