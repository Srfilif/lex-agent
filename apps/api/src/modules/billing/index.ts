// Interfaz pública del módulo billing.
export * from './billing.module';
export { BillingForAgent } from './application/billing-for-agent';
export { AGENT_BILLING, type AgentBillingPort } from './application/ports';
export { EffectivePlanResolver } from './application/effective-plan';
export { modelosPermitidos, intEntitlement } from './domain/plan';
