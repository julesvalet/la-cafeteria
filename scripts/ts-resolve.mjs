export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/i.test(specifier)) {
    try {
      return await next(specifier + '.ts', context);
    } catch {
      /* not a .ts module — fall through to the default resolution */
    }
  }
  return next(specifier, context);
}
