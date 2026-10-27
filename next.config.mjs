/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // 화면은 정적 롤링페이퍼 페이지(public/index.html) 한 장이다
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/index.html' }] };
  },
};

export default nextConfig;
