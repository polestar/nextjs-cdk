import chalk from 'chalk';

class Logger {
  info(message: string) {
    this.log('INFO', chalk.dim(message));
  }

  warn(message: string) {
    this.log('WARNING', chalk.yellow(message));
  }

  error(message: string, data?: unknown) {
    this.log('ERROR', message, data);
  }

  debug(message: string, data?: unknown) {
    this.log(chalk.blue('DEBUG'), message, data);
  }

  log(label: string, message: string, data: unknown = '') {
    const now = new Date().toISOString();
    const body = typeof data === 'string' ? data : JSON.stringify(data);

    console.log(`${chalk.dim(now)} ${`[${label}]`}: ${message + body}`);
  }
}

export const logger = new Logger();
