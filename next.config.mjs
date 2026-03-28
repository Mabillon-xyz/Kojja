/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    'd3-array',
    'd3-scale',
    'd3-shape',
    'd3-interpolate',
    'd3-color',
    'd3-format',
    'd3-time',
    'd3-time-format',
    'd3-path',
    'recharts',
  ],
}

export default nextConfig
