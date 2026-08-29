import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { cloudinary, isCloudinaryReady } from '../../config/cloudinary';
import { env } from '../../config/env';
import { errors } from '../../lib/errors';

export const uploadsRouter = Router();
uploadsRouter.use(authMiddleware);

/**
 * GET /api/v1/uploads/signature?folder=waste-app/pickups
 *
 * Returns a Cloudinary signature the Android app can use to upload an image
 * DIRECTLY to Cloudinary — no image bytes flow through our server. That
 * keeps this endpoint tiny and stateless even with heavy photo traffic.
 *
 * The app then sends the resulting `secure_url`s to POST /pickups.
 */
uploadsRouter.get('/signature', (req, res) => {
  if (!isCloudinaryReady()) {
    throw errors.internal('Cloudinary is not configured on the server');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder =
    typeof req.query.folder === 'string' && req.query.folder.length > 0
      ? sanitizeFolder(req.query.folder)
      : env.CLOUDINARY_UPLOAD_FOLDER;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET!,
  );

  res.json({
    timestamp,
    folder,
    signature,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
  });
});

function sanitizeFolder(input: string): string {
  // Cloudinary allows [a-zA-Z0-9/_-]; strip everything else.
  return input.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 128);
}
