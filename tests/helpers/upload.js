/**
 * Upload Helper
 * Provides a dummy 1x1 transparent PNG file buffer for testing file upload endpoints with Supertest.
 */

// Base64 representation of a 1x1 transparent PNG image
const DUMMY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Returns a Buffer of a 1x1 pixel PNG image.
 * This can be passed to Supertest's .attach() method.
 */
export function getDummyImageBuffer() {
  return Buffer.from(DUMMY_PNG_BASE64, 'base64');
}

/**
 * Returns the object structure required to simulate a multer file object
 * if you are testing middleware or controllers directly.
 */
export function getMockMulterFile(filename = 'test-image.png') {
  const buffer = getDummyImageBuffer();
  return {
    fieldname: 'image',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: buffer,
    size: buffer.length
  };
}
