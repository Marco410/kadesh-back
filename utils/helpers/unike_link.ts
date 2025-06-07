export function genUniqueLink(link: string) {
    return link.toLowerCase().replace(/ñ/g, "n").replace(/\s+/g, ".");
}
