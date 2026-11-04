// Interfaz pública del módulo billing.
export * from './billing.module';
export { BillingForAgent } from './application/billing-for-agent';
export { EffectivePlanResolver } from './application/effective-plan';
export { modelosPermitidos, intEntitlement } from './domain/plan';
