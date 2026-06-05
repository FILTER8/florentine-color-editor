import './style.css';

export const metadata = {
  title: 'Florentine Color Editor',
  description: 'Fetch an on-chain tokenURI, recolor the image, and export PNG.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
