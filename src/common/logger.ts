class Logger {
  info(message: string) {
    this.log('INFO', message);
  }

  warn(message: string) {
    this.log('WARNING', message);
  }

  error(message: string, data?: unknown) {
    this.log('ERROR', message, data);
  }

  debug(message: string, data?: unknown) {
    this.log('DEBUG', message, data);
  }

  log(label: string, message: string, data: unknown = '') {
    const body = typeof data === 'string' ? data : JSON.stringify(data);

    console.log(`${`[${label}]`}: ${message}  ${body}`);
  }
}

export const logger = new Logger();
