# Reverse Proxy Deployment

Deployment reference for running `thru_oracle_api` behind an upstream reverse proxy (Nginx or Caddy). Covers trusted proxy allowlists (A-01), metrics access restriction (A-02), SSE connection capping (A-03), and CORS headers (A-04).

---

## 1. Security Controls (Scenario R5)

- **A-01 (X-Forwarded-For Spoofing)**: Client IP defaults to physical connection IP (`r.RemoteAddr`). `X-Forwarded-For` is parsed only when `r.RemoteAddr` matches trusted CIDRs passed to `--trusted-proxies`. Untrusted clients attempting header spoofing are rate-limited on their actual IP.
- **A-02 (Metrics Access)**: `/metrics` is restricted to loopback (`127.0.0.1`, `::1`) by default. External access requires `Authorization: Bearer <token>` configured via `--metrics-token` or `THRU_METRICS_TOKEN`.
- **A-03 (SSE Exhaustion)**: `/v1/stream` enforces concurrent connection limits per client IP (default: 4, configurable via `--max-sse-per-ip`) and globally (default: 256, configurable via `--max-sse-global`).
- **A-04 (CORS & Headers)**: Explicit origin validation via `--cors-origins`, security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'`), and request bodies capped at 64 KB via `http.MaxBytesReader`.

---

## 2. Configuration Parameters

| Flag | Environment Variable | Default | Description |
|---|---|---|---|
| `--trusted-proxies` | — | `""` | Comma-separated CIDRs of upstream proxies (e.g. `127.0.0.1/32,10.0.0.0/8`). |
| `--metrics-token` | `THRU_METRICS_TOKEN` | `""` | Bearer token required for non-loopback `/metrics` requests. |
| `--cors-origins` | — | `"*"` | Comma-separated list of allowed CORS origins. |
| `--max-sse-per-ip` | — | `4` | Max active SSE stream connections allowed per client IP. |
| `--max-sse-global` | — | `256` | Max total active SSE stream connections across all clients. |
| `--port` | — | `"8080"` | Internal listen port. |

---

## 3. Nginx Configuration

```nginx
# /etc/nginx/sites-available/thru-oracle.conf

upstream thru_oracle_backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name oracle.thru.org;

    ssl_certificate     /etc/letsencrypt/live/oracle.thru.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/oracle.thru.org/privkey.pem;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # REST Endpoints
    location / {
        proxy_pass http://thru_oracle_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 15s;
    }

    # SSE Streaming (buffering disabled for real-time delivery)
    location /v1/stream {
        proxy_pass http://thru_oracle_backend/v1/stream;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Scrape metrics locally or via private network only
    location /metrics {
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
        proxy_pass http://thru_oracle_backend/metrics;
    }
}
```

---

## 4. Caddy Configuration

```caddy
oracle.thru.org {
    # SSE stream route with instant flush
    @stream path /v1/stream
    handle @stream {
        reverse_proxy 127.0.0.1:8080 {
            flush_interval -1
        }
    }

    # Metrics restricted to loopback and private subnets
    @metrics path /metrics
    handle @metrics {
        @blocked not client_ip 127.0.0.1 ::1 10.0.0.0/8
        abort @blocked
        reverse_proxy 127.0.0.1:8080
    }

    handle {
        reverse_proxy 127.0.0.1:8080
    }
}
```

---

## 5. Systemd Service Unit

```ini
# /etc/systemd/system/thru-oracle-api.service

[Unit]
Description=Thru Quant Core Oracle API Daemon
After=network.target

[Service]
Type=simple
User=thru
WorkingDirectory=/opt/thru_quant_core
Environment=THRU_METRICS_TOKEN=insert_production_token_here
ExecStart=/opt/thru_quant_core/build/thru_oracle_api \
    --port 8080 \
    --network Betanet \
    --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
    --oracle-account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
    --trusted-proxies "127.0.0.1/32,10.0.0.0/8" \
    --max-sse-per-ip 4 \
    --max-sse-global 256
Restart=always
RestartSec=5s
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```
