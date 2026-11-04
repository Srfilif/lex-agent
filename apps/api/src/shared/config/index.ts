// Interfaz pública de shared/config (regla 5: no importar internos desde fuera).
export { AppConfig, AuthConfig, TotpConfig, BillingConfig, CONFIG, loadAppConfig } from './app-config';
export { loadDotenv } from './dotenv';
export { ConfigModule } from './config.module';
