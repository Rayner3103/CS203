/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: "standalone"` builds a self-contained server.js for the Docker image
  // (frontend/Dockerfile runs `node server.js`). On Vercel it breaks routing —
  // every route 404s — so disable it there. Vercel sets VERCEL=1 during builds.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  // 👇 Allow your LAN/dev IPs during development
  allowedDevOrigins: ["http://192.168.5.1:3000"],
};

export default nextConfig;
