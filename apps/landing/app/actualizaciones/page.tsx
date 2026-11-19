import { execSync } from "child_process";

export default function UpdatesPage() {
  // Datos estáticos de los commits principales
  const updates = [
    {
      hash: "c313c10",
      title: "chore(dev): agrega runner local y actualiza documentación",
      date: "2026-11-04",
    },
    {
      hash: "30e8ef7",
      title: "feat(landing): añade sitio público con Next.js",
      date: "2026-11-04",
    },
    {
      hash: "28be296",
      title: "feat(web): migra la interfaz a shadcn/ui y renueva la navegación",
      date: "2026-11-04",
    },
    {
      hash: "7595da8",
      title: "refactor(api): modulariza dominios y añade soporte SQLite",
      date: "2026-11-04",
    },
    {
      hash: "latest",
      title: "feat(landing): agrega acerca de, contacto y licencia no comercial",
      date: "2026-11-17",
    },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '96px 0' }}>
      <h1 style={{
        fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif',
        fontSize: '3rem', fontWeight: '400', lineHeight: '1', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: '1.5rem',
      }}>
        Actualizaciones / Changelog
      </h1>
      <ul style={{ listStyle: 'none', padding: '0', margin: '0', display: 'grid', gap: '1.5rem', textAlign: 'left' }}>
        {updates.map((u) => (
          <li key={u.hash} style={{
            background: '#fff', border: '1px solid var(--rule)', borderRadius: '0', padding: '1.5rem',
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <h2 style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif',
                fontSize: '1.55rem', fontWeight: '400', letterSpacing: '-0.01em', margin: '0', color: 'var(--ink)',
              }}>
                {u.title}
              </h2>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', lineHeight: '1.75', color: 'var(--ink-soft)' }}>
                {u.date}
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--muted)' }}>
                {u.hash.slice(0, 7)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}