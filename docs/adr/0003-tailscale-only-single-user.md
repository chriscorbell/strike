# Private over Tailscale, one user, SQLite

Status: accepted, 2026-10-03

Strike holds one person's health data and is used by that person. It runs as a single container on minicore with a SQLite database in `/home/chris/docker/data/strike`, published on port 3090 and reached from the iPhone and the Mac over Tailscale at `http://minicore.tail047de3.ts.net:3090` (Chris's choice over a public Cloudflare tunnel, 2026-10-03). It is not exposed to the internet.

Every API call still needs a bearer token (`STRIKE_TOKEN`), because the port is also reachable from the home LAN. Traffic is plain HTTP inside the WireGuard tunnel; the iOS app has an App Transport Security exception for `ts.net` hosts.

SQLite fits one user and one process, and backs up as a single file: the server writes a daily snapshot to `/data/backups` and copies it to the NAS backup share when that is mounted.
