#!/usr/bin/env node
import { createMcpServer } from "./server.js";

const server = createMcpServer();
server.startStdio();
