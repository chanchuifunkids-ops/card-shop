export const metadata = {
    title: '⚡ Pokémon Card Shop',
    description: 'Buy and ship Pokémon cards with Next.js and Supabase',
  };
  
export default function RootLayout({ children }) {
return (
    <html lang="en">
    <body style={{ margin: 0, padding: 0, fontFamily: 'sans-serif' }}>
        {children}
    </body>
    </html>
);
}