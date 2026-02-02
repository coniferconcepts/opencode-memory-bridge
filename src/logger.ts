/**
 * Enhanced logger for the memory plugin.
 * 
 * Responsibility:
 * - Route logs to OpenCode client.app.log when available.
 * - Respect verbosity levels (quiet, normal, verbose).
 * - Provide status and notification wrappers for better UX.
 */

export type Verbosity = 'quiet' | 'normal' | 'verbose';

export interface LoggerOptions {
  /** OpenCode client instance */
  client?: any;
  /** Verbosity level */
  verbosity?: Verbosity;
  /** Service name for logs */
  service?: string;
}

let currentClient: any = null;
let currentVerbosity: Verbosity = 'normal';
let currentService: string = 'claude-mem-bridge';

export const logger = {
  /**
   * Initialize the logger with OpenCode client and options.
   */
  init: (options: LoggerOptions) => {
    if (options.client) currentClient = options.client;
    if (options.verbosity) currentVerbosity = options.verbosity;
    if (options.service) currentService = options.service;
  },

  /**
   * Log info message. 
   * Hidden in 'quiet' mode.
   */
  info: (context: string, message: string, metadata?: any) => {
    if (currentVerbosity === 'quiet') return;
    
    if (currentClient?.app?.log) {
      void currentClient.app.log({
        body: {
          service: currentService,
          level: 'info',
          message: `[${context}] ${message}`,
          metadata
        }
      });
    } else {
      console.log(`[INFO] ${context} ${message}`, metadata || '');
    }
  },

  /**
   * Log warning message.
   * Hidden in 'quiet' mode unless it's critical.
   */
  warn: (context: string, message: string, metadata?: any) => {
    if (currentVerbosity === 'quiet') return;
    
    if (currentClient?.app?.log) {
      void currentClient.app.log({
        body: {
          service: currentService,
          level: 'warn',
          message: `[${context}] ${message}`,
          metadata
        }
      });
    } else {
      console.warn(`[WARN] ${context} ${message}`, metadata || '');
    }
  },

  /**
   * Log error message.
   * Always shown unless in extreme 'quiet' (but usually errors are important).
   */
  error: (context: string, message: string, metadata?: any) => {
    if (currentClient?.app?.log) {
      void currentClient.app.log({
        body: {
          service: currentService,
          level: 'error',
          message: `[${context}] ${message}`,
          metadata
        }
      });
    } else {
      console.error(`[ERROR] ${context} ${message}`, metadata || '');
    }
  },

  /**
   * Log debug message.
   * Only shown if CLAUDE_MEM_DEBUG env var is set or verbosity is 'verbose'.
   */
  debug: (context: string, message: string, metadata?: any) => {
    if (process.env.CLAUDE_MEM_DEBUG === 'true' || currentVerbosity === 'verbose') {
      if (currentClient?.app?.log) {
        void currentClient.app.log({
          body: {
            service: currentService,
            level: 'debug',
            message: `[${context}] ${message}`,
            metadata
          }
        });
      } else {
        console.debug(`[DEBUG] ${context} ${message}`, metadata || '');
      }
    }
  },

  /**
   * Show a transient status message in the OpenCode UI.
   * Useful for background tasks like extraction.
   */
  status: (message: string) => {
    if (currentVerbosity === 'quiet') return;

    if (currentClient?.app?.status) {
      void currentClient.app.status({ message });
    } else if (currentClient?.session?.status) {
      // Fallback to session.status if app.status is not available
      void currentClient.session.status({ message });
    }
  },

  /**
   * Show a notification/toast in the OpenCode UI.
   */
  notify: (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    if (currentVerbosity === 'quiet' && type === 'info') return;

    if (currentClient?.app?.notify) {
      void currentClient.app.notify({ message, type });
    } else {
      // Fallback to log if notify is not available
      logger.info('notify', `[${type.toUpperCase()}] ${message}`);
    }
  },

  /**
   * Create a child logger with a fixed context.
   */
  child: (context: string) => ({
    info: (message: string, metadata?: any) => logger.info(context, message, metadata),
    warn: (message: string, metadata?: any) => logger.warn(context, message, metadata),
    error: (message: string, metadata?: any) => logger.error(context, message, metadata),
    debug: (message: string, metadata?: any) => logger.debug(context, message, metadata),
    status: (message: string) => logger.status(message),
    notify: (message: string, type?: any) => logger.notify(message, type),
  })
};
