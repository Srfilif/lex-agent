import { useEffect, useState } from 'react';
import { api, type Cobertura } from '../api';

// D1: pie con cobertura real del corpus (una sola carga, best-effort).
export default function CorpusFooter(): React.ReactElement {
  const [cob, setCob] = useState<Cobertura | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .cobertura()
      .then((c) => {
        if (vivo) setCob(c);
      })
      .catch(() => {
        if (vivo) setCob(null);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const corpus = cob ? `Corpus: ${cob.documentos} documentos · ${cob.fragmentos} fragmentos` : 'Corpus: no disponible';
  const algunaVerificada = (cob?.docs ?? []).some((d) => d.vigencia === 'vigencia_verificada');
  const vigencia = algunaVerificada
    ? 'Vigencia parcialmente verificada'
    : 'Vigencia normativa no verificada';
  return (
    <footer>
      <p>
        {vigencia} · {corpus} · SECOP sincronizado · Verifique las fuentes antes de actuar.
      </p>
    </footer>
  );
}
