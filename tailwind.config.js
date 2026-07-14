/**
 * CalmCarry - Tailwind / NativeWind config.
 * Color values mirror src/theme/colors.ts (the canonical TS tokens).
 * The palette is LOCKED to The Glow Company brand - do not invent colors here.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#426768',
          tealDeep: '#365B59',
          sage: '#74A5A2',
          sageHover: '#466D6A',
          mint: '#D3EDEA',
          mintSoft: '#E7F3F0',
          cream: '#F2F1EB',
          slate: '#485453',
          coral: '#EF626C',
        },
        light: {
          bg: '#F4F3ED',
          wash: '#E7F3F0',
          surface: '#FFFFFF',
          title: '#2E3F3E',
          text: '#485453',
        },
        night: {
          deep: '#0E1817',
          base: '#15231F',
          elevated: '#1E302D',
          title: '#EAF2EF',
          text: '#9DB7B1',
          dim: '#5E7470',
          glow: '#8FC9BE',
        },
      },
      borderRadius: {
        card: '16px',
        orb: '20px',
      },
      fontFamily: {
        // Mirror src/theme/typography.ts EXACTLY - Poppins (body/UI) + Montserrat
        // (headings/display). NO serif (the old Fraunces entries were a forbidden,
        // never-loaded leftover). RN needs the exact @expo-google-fonts variant per weight.
        sans: ['Poppins_400Regular'],
        medium: ['Poppins_500Medium'],
        semibold: ['Poppins_600SemiBold'],
        bold: ['Poppins_700Bold'],
        heading: ['Montserrat_600SemiBold'],
        display: ['Montserrat_700Bold'],
      },
    },
  },
  plugins: [],
};
