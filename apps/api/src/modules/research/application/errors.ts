export class InvestigationNotFoundError extends Error {
  constructor() {
    super('investigación no encontrada');
    this.name = 'InvestigationNotFoundError';
  }
}
