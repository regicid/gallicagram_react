import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

// Bump this to show the dialog again, once, to every visitor after the next batch of news.
const RELEASE = '2026-10';
const STORAGE_KEY = 'gallicagram_whats_new_seen';

const NEWS = ['whats_new_cairn', 'whats_new_tv', 'whats_new_press', 'whats_new_majinbook', 'whats_new_syntax', 'whats_new_links', 'whats_new_speed'];

// Same people and links as the acknowledgements on the About page.
const CONTRIBUTORS = [
  { name: 'Elias Echikr', url: 'https://www.linkedin.com/in/elias-echikr-134a5b259/' },
  { name: 'Antoine Mazières', url: 'https://antonomase.fr/' },
  { name: 'Yann de Boisvilliers', url: 'https://www.linkedin.com/in/yann-de-boisvilliers-875ab8275/' },
];

// Storage can be missing or throw (private browsing, blocked site data): then the
// dialog simply shows on every visit rather than breaking the page.
const alreadySeen = () => {
  try { return localStorage.getItem(STORAGE_KEY) === RELEASE; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem(STORAGE_KEY, RELEASE); } catch { /* ignore */ }
};

const WhatsNewDialog = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !alreadySeen());

  const close = () => {
    markSeen();
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>{t('whats_new_title')}</DialogTitle>
      <DialogContent sx={{ pb: 0 }}>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.8, fontSize: '1.05rem' }}>
          {NEWS.map(key => <li key={key}>{t(key)}</li>)}
        </ul>
        <p style={{ margin: '1rem 0 0', fontStyle: 'italic' }}>
          {t('whats_new_thanks')}{' '}
          {CONTRIBUTORS.map(({ name, url }, i) => (
            <React.Fragment key={name}>
              {i > 0 && (i === CONTRIBUTORS.length - 1 ? ` ${t('whats_new_and')} ` : ', ')}
              <a href={url} target="_blank" rel="noreferrer">{name}</a>
            </React.Fragment>
          ))}
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} variant="contained">{t('whats_new_close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WhatsNewDialog;
