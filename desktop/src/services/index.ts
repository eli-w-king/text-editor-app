/**
 * Services barrel export.
 *
 * Re-exports all service modules so consumers can import from a single path:
 *   import { login, logout, getToken } from '@/services';
 */

export {
  login,
  register,
  logout,
  validateToken,
  getCurrentUser,
  getToken,
  getStoredUser,
  isAuthenticated,
} from './auth';

export type { User, AuthResponse } from './auth';
