import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function AboutPage() {
    const { t } = useTranslation();

    return (
        <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem',
            fontFamily: "'EB Garamond', Georgia, serif",
            lineHeight: '1.8',
        }}>
            <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontSize: '1rem' }}>
                ← {t('Back to Gallicagram')}
            </Link>
            <h1 style={{ marginTop: '1.5rem' }}>{t('Who are we?')}</h1>
        </div>
    );
}

export default AboutPage;
