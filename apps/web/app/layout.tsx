import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FORMA — вещи для жизни',
  description:
    'Продуманные вещи для вашего дома. Мебель, свет, керамика и текстиль.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
