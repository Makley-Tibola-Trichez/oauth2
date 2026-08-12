import { Elysia } from 'elysia';

const app = new Elysia().get('/health', () => ({ status: 'ok' })).listen(3000);

console.log(`Servidor no ar em http://${app.server?.hostname}:${app.server?.port}`);
