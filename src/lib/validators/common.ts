import { z } from 'zod';

export const idSchema = z.string().min(1);
export const isoCurrencySchema = z.string().length(3).toUpperCase();
