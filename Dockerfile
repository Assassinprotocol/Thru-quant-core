# syntax=docker/dockerfile:1
FROM golang:1.22-bookworm AS builder

WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download || true

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /build/thru_oracle_api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /build/feeder ./feeder

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /build/thru_oracle_api /app/thru_oracle_api
COPY --from=builder /build/feeder /app/feeder
COPY visualizer/ /app/visualizer/

USER 65532:65532

EXPOSE 8080

ENTRYPOINT ["/app/thru_oracle_api"]
CMD ["--port", "8080", "--static-dir", "/app/visualizer"]
