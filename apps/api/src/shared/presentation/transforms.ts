// Transforms class-transformer compartidos por los DTOs de presentación.

// '' → undefined (equivale a "no enviado", como hacía el parseo manual).
export const toNumberOrUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? undefined : Number(value);
