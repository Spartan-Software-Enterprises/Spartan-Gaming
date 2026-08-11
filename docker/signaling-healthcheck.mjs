import http from 'node:http';
import https from 'node:https';

const transport = process.env.SPARTAN_SIGNALING_TLS_CERT ? https : http;
const request = transport.get(
  {
    hostname: '127.0.0.1',
    port: 8790,
    path: '/health',
    rejectUnauthorized: false,
  },
  (response) => {
    response.resume();
    response.once('end', () => process.exit(response.statusCode === 200 ? 0 : 1));
  },
);

request.setTimeout(4_000, () => request.destroy(new Error('healthcheck timed out')));
request.once('error', () => process.exit(1));
