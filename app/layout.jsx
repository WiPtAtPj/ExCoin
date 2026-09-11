export const metadata = {
  title: '위즈덤하우스 임원 예산 조회 시스템',
  description: '임원 예산 및 사용 내역 조회 시스템',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
