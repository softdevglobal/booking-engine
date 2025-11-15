/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	experimental: {
		serverActions: {
			bodySizeLimit: '2mb'
		}
	},
	async headers() {
		const headers = [];
		const allowed = process.env.EMBED_ALLOWED_ORIGINS && String(process.env.EMBED_ALLOWED_ORIGINS).trim();
		if (allowed) {
			const value = `frame-ancestors ${allowed.split(',').map(s => s.trim()).filter(Boolean).join(' ')}`;
			headers.push({
				source: "/embed",
				headers: [
					{ key: "Content-Security-Policy", value }
				]
			});
		}
		return headers;
	}
};

export default nextConfig;


