import { Request, Response } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message: `${req.method} ${req.path} is not a valid API endpoint`,
  });
}
