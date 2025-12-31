import * as admin from 'firebase-admin';
import { Request, Response } from 'express';

export interface AuthenticatedRequest extends Request {
    uid: string;
    email?: string;
}

/**
 * Verifies Firebase Auth token from Authorization header.
 * Returns decoded token info or sends 401 response.
 */
export async function verifyAuth(
    req: Request,
    res: Response
): Promise<{ uid: string; email?: string } | null> {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
            error: 'Unauthorized',
            detail: { message: 'Missing or invalid Authorization header' },
        });
        return null;
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };
    } catch (error) {
        console.error('Auth verification failed:', error);
        res.status(401).json({
            error: 'Unauthorized',
            detail: { message: 'Invalid or expired token' },
        });
        return null;
    }
}
