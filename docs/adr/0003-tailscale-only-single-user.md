# Private over Tailscale, one user, SQLite

Status: accepted, 2026-10-03

Strike holds one person's health data and is used by that person. It runs as a single container on minicore with a SQLite database in `/home/chris/docker/data/strike`, reached from the iPhone and the Mac over Tailscale at `https://minicore.saanen-monitor.ts.net:3090` (Chris's choice over a public Cloudflare tunnel, 2026-10-03). It is not exposed to the internet.

Since 2026-10-07 it follows the fleet's pattern for self-hosted apps: the container publishes port 3090 on minicore's loopback only, and Tailscale Serve puts HTTPS with a Tailscale-issued certificate in front of it, on the tailnet only. Before that the port was plain HTTP on every interface, reachable from the home LAN, and the iOS app needed an App Transport Security exception for `ts.net` hosts; both are gone. Every API call still needs a bearer token (`STRIKE_TOKEN`), so a device on the tailnet isn't enough on its own.

SQLite fits one user and one process, and backs up as a single file: the server writes a daily snapshot to `/data/backups` and copies it to the NAS backup share when that is mounted.
