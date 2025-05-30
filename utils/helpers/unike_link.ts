export function genUniqueLink(link: string) {
    return link.toLocaleLowerCase().replaceAll(" ",".").replace(/ñ/g, "n")
    .replace(/[^a-z0-9-]/g, "");
}
