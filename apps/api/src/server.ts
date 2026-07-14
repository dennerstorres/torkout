import { buildApp } from './app.js';
import { parseEnvironment } from './env.js';

const environment = parseEnvironment();
const app = buildApp();

await app.listen({ host: environment.HOST, port: environment.PORT });
