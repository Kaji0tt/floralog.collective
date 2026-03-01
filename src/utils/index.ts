
export function createPageUrl(pageName: string) {
    // pageName can include query parameters (e.g. "Home", "GenusDetail?id=1").
    // Keep the path casing as provided so it matches the route keys from pages.config.
    const [rawPath, search] = pageName.split("?", 2);
    const normalizedPath = '/' + rawPath.replace(/ /g, '-');
    return search ? `${normalizedPath}?${search}` : normalizedPath;
}