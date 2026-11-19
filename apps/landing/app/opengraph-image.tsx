import { ImageResponse } from 'next/og';

export const alt =
  'Kelsyx — Derecho colombiano con la fuente a la vista';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f4f3ed',
          color: '#141814',
          padding: '54px 64px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(20,24,20,0.22)',
            paddingBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <svg width="46" height="46" viewBox="0 0 64 64">
              <rect width="64" height="64" fill="#141814" />
              <path
                d="M20 6v44M20 28L44 6M25 33L46 50"
                fill="none"
                stroke="#f4f3ed"
                strokeWidth="8.5"
              />
              <path d="M14 58h38" stroke="#91c7ab" strokeWidth="2.5" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Kelsyx
              </div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#6f786f',
                  marginTop: '4px',
                }}
              >
                Investigación jurídica
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#6f786f',
            }}
          >
            Colombia · Legal Intelligence
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: '62px',
              lineHeight: 1.03,
              letterSpacing: '-0.045em',
              fontWeight: 600,
            }}
          >
            Derecho colombiano,
          </div>
          <div
            style={{
              fontSize: '62px',
              lineHeight: 1.03,
              letterSpacing: '-0.045em',
              fontWeight: 600,
              color: '#1d5643',
              fontStyle: 'italic',
            }}
          >
            con la fuente a la vista.
          </div>
          <div
            style={{
              marginTop: '24px',
              fontSize: '19px',
              lineHeight: 1.5,
              color: '#4c554d',
              maxWidth: '800px',
            }}
          >
            Consulta normativa, jurisprudencia y contratos públicos. Cada afirmación relevante,
            enlazada al fragmento que la respalda.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '32px',
            fontSize: '10px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#6f786f',
            borderTop: '1px solid rgba(20,24,20,0.22)',
            paddingTop: '18px',
          }}
        >
          <span>Citas al fragmento</span>
          <span>Vigencia declarada</span>
          <span>SECOP II</span>
          <span>No es asesoría jurídica</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
