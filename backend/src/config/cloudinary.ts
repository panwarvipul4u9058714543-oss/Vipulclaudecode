import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';
import { logger } from './logger';

/**
 * Configures the Cloudinary SDK. If any of the three secrets is missing the
 * upload-signature endpoint will reject requests — but the rest of the app
 * still boots so local dev without Cloudinary keys is not blocked.
 */
export function initCloudinary(): void {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    logger.warn('Cloudinary env vars not set — image uploads disabled');
    return;
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  logger.info('cloudinary configured');
}

export function isCloudinaryReady(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

export { cloudinary };
