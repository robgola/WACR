/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "hsl(var(--color-primary-h), var(--color-primary-s), var(--color-primary-l))",
            }
        },
    },
    plugins: [],
}
