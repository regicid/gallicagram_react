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

            <h2 style={{ marginTop: '1.5rem' }}>{t('Who are we?')}</h2>
            <p>
                <a href="https://regicid.github.io/" target="_blank" rel="noreferrer">Benoît de Courson</a> {t('about_benoit')}
            </p>
            <p>
                {t('about_benjamin')}
            </p>

            <h2 style={{ marginTop: '1.5rem' }}>{t('The project?')}</h2>
            <p>{t('about_project_p1')}</p>
            <ul>
                <li>{t('about_project_li1')} <a href="https://github.com/regicid/gallicagram_react/blob/main/public/corpus.tsv" target="_blank" rel="noreferrer">{t('here')}</a>.</li>
                <li>{t('about_project_li2_1')} <a href="https://www.gallicagram.com/swagger" target="_blank" rel="noreferrer">{t('here')}</a>{t('about_project_li2_2')}</li>
                <li>{t('about_project_li3_1')} <a href="https://github.com/regicid/gallicagram_react" target="_blank" rel="noreferrer">{t('here')}</a>.</li>
                <li>{t('about_project_li4')} <a href="https://pure.mpg.de/rest/items/item_3627544/component/file_3627545/content" target="_blank" rel="noreferrer">{t('this one')}</a>.</li>
            </ul>

            <h2 style={{ marginTop: '1.5rem' }}>{t('Acknowledgments?')}</h2>
            <p>{t('about_ack_p1')}</p>
            <p>{t('about_ack_p2')}</p>
            <p>{t('about_ack_p3')}</p>
            <p>{t('about_ack_p4')}</p>
        </div>
    );
}

export default AboutPage;
