/**
 * Shared in-process request statistics.
 * Extracted from index.js so it can be imported by adminController
 * without pulling in the server bootstrap code (listen, connectDB, etc.).
 * Tests import this directly to inspect or reset values.
 */
export const systemStats = {
  totalRequests: 0,
  totalResponseTimeMs: 0,
};
