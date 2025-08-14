import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: undefined,
  redact: {
    paths: ['req.headers.authorization', 'token', 'refreshToken', 'email'],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const withReqId = (reqId: string) => logger.child({ reqId });

