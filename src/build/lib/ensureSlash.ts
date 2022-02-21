const ensureSlash = (target: string, index = 0): string =>
  target[index] != '/'
    ? [target.substring(0, index), '/', target.substring(index)].join('')
    : target;

export default ensureSlash;
