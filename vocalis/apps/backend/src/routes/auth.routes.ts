import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sqliteUserStore } from '../services/auth/sqliteUserStore';
import { logger } from '../utils/logger';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register - Register a new user account
router.post('/register', (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => e.message).join(', ');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errorMsg },
    });
  }

  const { email, name, password } = result.data;

  try {
    const user = sqliteUserStore.registerUser(email, name, password);
    logger.info('User registered successfully', { userId: user.id, email: user.email }, 'AuthRouter');

    return res.status(201).json({
      success: true,
      data: {
        user,
        message: 'Account created successfully',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return res.status(409).json({
      success: false,
      error: { code: 'USER_EXISTS', message },
    });
  }
});

// POST /api/auth/login - Authenticate user with email and password
router.post('/login', (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => e.message).join(', ');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errorMsg },
    });
  }

  const { email, password } = result.data;
  const user = sqliteUserStore.authenticate(email, password);

  if (!user) {
    // Check if user exists to give helpful feedback
    const exists = sqliteUserStore.getUserByEmail(email);
    if (!exists) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'No account found with this email. Please sign up.' },
      });
    }

    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect password. Please try again.' },
    });
  }

  logger.info('User logged in successfully', { userId: user.id, email: user.email }, 'AuthRouter');

  return res.status(200).json({
    success: true,
    data: {
      user,
      message: 'Signed in successfully',
    },
  });
});

// GET /api/auth/me - Get current user profile
router.get('/me', (req: Request, res: Response) => {
  const email = req.query.email as string | undefined;
  if (!email) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_EMAIL', message: 'Email query parameter is required' },
    });
  }

  const userRow = sqliteUserStore.getUserByEmail(email);
  if (!userRow) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: userRow.role,
        createdAt: userRow.created_at,
      },
    },
  });
});

export const authRouter = router;
