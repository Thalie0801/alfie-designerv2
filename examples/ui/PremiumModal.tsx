import React from 'react';

type Props = {
  open: boolean;
  woofsCost: number;
  onConfirm: () => void;
  onUseEco: () => void;
  onClose: () => void;
};

export default function PremiumModal({ open, woofsCost, onConfirm, onUseEco, onClose }: Props) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="ad-modal">
      <div className="ad-card">
        <h2>Ajouter un plan héro ?</h2>
        <p>Cette action consomme <strong>{woofsCost} Woof(s)</strong>.</p>
        <div className="ad-actions">
          <button onClick={onUseEco}>Voir version Éco</button>
          <button onClick={onConfirm}>Confirmer</button>
        </div>
        <button aria-label="Fermer" onClick={onClose} className="ad-close">×</button>
      </div>
      <style jsx>{`
        .ad-modal { position: fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.35); }
        .ad-card { background:#fff; padding:24px; border-radius:12px; width:100%; max-width:420px; box-shadow:0 10px 30px rgba(0,0,0,.15); }
        .ad-actions { display:flex; gap:12px; margin-top:16px; justify-content:flex-end; }
        .ad-close { position:absolute; top:12px; right:12px; background:transparent; border:none; font-size:24px; }
      `}</style>
    </div>
  );
}
