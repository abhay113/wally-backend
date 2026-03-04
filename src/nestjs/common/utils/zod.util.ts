import { ValidationError } from '../../../utils/errors';
import { z } from 'zod';

export function parseZod<T>(schema: z.ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ValidationError('Validation failed', { errors: result.error.issues });
  }
  return result.data;
}
