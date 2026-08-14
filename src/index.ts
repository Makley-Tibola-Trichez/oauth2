import { app } from './app';
import { config } from './config/env';
import { logger } from './shared/logging';

app.listen(config.port, () => {
  logger.info('Serviço iniciado', 'bootstrap', {
    ambiente: config.nodeEnv,
    porta: config.port,
    modoAdmin: config.adminAuthMode,
  });
});
