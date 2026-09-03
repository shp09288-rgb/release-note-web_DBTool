import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "SW 버전 이력",
  description: "사이트별 SW 버전 및 버전별 적용 내역 조회",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/*
          Pretendard — parksystems.com 이 쓰는 서체. next/font 로 자체 호스팅하지 않고
          CDN 을 쓰는 이유는, 막혔을 때 globals.css 의 폴백(맑은 고딕)으로 조용히
          떨어지는 편이 낫기 때문이다. 배포 문서도 맑은 고딕을 쓴다.
        */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
