/**
 * Formats a title string based on specific patterns.
 * 
 * Pattern 1: "YYYY Title" -> "Title (YYYY)"
 * Pattern 2: "YYYY-MM Title" -> "Title (YYYY)" (Dropping month to keep it clean, or could be (YYYY-MM))
 * 
 * @param {string} title - The raw title/name to format.
 * @returns {string} - The formatted title.
 */
export const formatLibraryTitle = (title) => {
    if (!title) return title;

    // Regex: Start with 4 digits (Year), optionally hyphen+2 digits (Month), then whitespace, then the rest (Name).
    // Uses \s* to be flexible with amount of whitespace.
    const regex = /^(\d{4})(?:-\d{2})?\s+(.+)$/;

    // Safety check for trimming
    const cleanTitle = title.trim();

    const match = cleanTitle.match(regex);
    if (match) {
        // match[1] is Year
        // match[2] is the rest (Name)
        return `${match[2]} Vol. ${match[1]}`;
    }

    return title;
};
