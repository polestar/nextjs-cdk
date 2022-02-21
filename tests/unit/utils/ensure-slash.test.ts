import ensureSlash from 'build/lib/ensureSlash';

describe('ensure-slash', () => {
  it('should include slash', () => {
    const test = '/namespace/_next/_data';

    expect(ensureSlash(test, 0)).toEqual(test);
  });

  it('should prepend slash', () => {
    const test = 'namespace/_next/_data';

    expect(ensureSlash(test, 0)).toEqual('/' + test);
  });
});
