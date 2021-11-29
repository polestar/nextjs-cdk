import { Event, RequiredServerFilesFiles } from 'types';

export const mockEvent = (
  url: string,
  headers?: { [key: string]: string },
): Event => {
  return {
    req: {
      headers: headers ?? {},
      url,
    } as any,
    res: {
      end: jest.fn(),
      setHeader: jest.fn(),
    } as any,
    responsePromise: new Promise(() => ({})),
  };
};

export const createRequiredServerFilesMock = (
  opt: Partial<RequiredServerFilesFiles> = {
    config: {
      assetPrefix: '',
    },
  },
): RequiredServerFilesFiles => {
  return {
    config: {
      assetPrefix: '',
    },
    ...opt,
  };
};
