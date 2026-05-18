import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'sf-privacy-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="sf-privacy-backdrop">
    <div class="sf-privacy-modal" role="dialog" aria-modal="true" aria-labelledby="sf-privacy-title">
      <div class="sf-privacy-header">
        <h2 id="sf-privacy-title">Informativa sulla privacy</h2>
        <button class="sf-privacy-close" (click)="onClose()" aria-label="Chiudi">×</button>
      </div>

      <div class="sf-privacy-body">
        <p>Questa informativa descrive come SmartFare raccoglie, usa e condivide i dati personali quando usi l'applicazione.</p>

        <h3>Tipi di dati raccolti</h3>
        <ul>
          <li>Informazioni dell'account: nome, email, dati del profilo quando ti registri o accedi via Google.</li>
          <li>Contenuti caricati: foto/immagini/video di profilo e background che carichi; questi vengono memorizzati su Cloudinary.</li>
          <li>Dati delle attività e itinerari: ricerche, preferenze, itinerari che salvi per usare il servizio.</li>
          <li>Comunicazioni: messaggi o e-mail inviati tramite i servizi dell'app.</li>
        </ul>

        <h3>Servizi di terze parti</h3>
        <p>SmartFare si appoggia ai seguenti servizi esterni:</p>
        <ul>
          <li><strong>Cloudinary</strong> — usato per l'archiviazione e la distribuzione di immagini e video caricati dagli utenti. I file caricati vengono inviati al backend, che li salva su Cloudinary.</li>
          <li><strong>Google (Social Login)</strong> — l'accesso tramite Google può fornire il nome e l'email al nostro sistema per creare o autenticare il tuo account.</li>
        </ul>

        <h3>Cookie e tecnologie simili</h3>
        <p>Usiamo un cookie tecnico per memorizzare la tua scelta di consenso: <code>sf_cookie_consent</code>. Se accetti, memorizziamo la preferenza di consenso; se rifiuti, rispettiamo la scelta e non attiviamo cookie non essenziali.</p>

        <h3>Finalità del trattamento</h3>
        <ul>
          <li>Forniamo e manteniamo il servizio (autenticazione, salvataggio itinerari, caricamenti media).</li>
          <li>Gestiamo i file caricati e li rendiamo disponibili tramite Cloudinary.</li>
          <li>Se attivato, usiamo dati per analisi e miglioramento del servizio (nessun tracker esterno evidente nel codice sorgente principale, ma potrebbero esserci librerie opzionali di terze parti).</li>
        </ul>

        <h3>Base giuridica e diritti</h3>
        <p>La base giuridica per i trattamenti è l'esecuzione del servizio e il consenso per finalità di marketing/analisi. Puoi chiedere accesso, rettifica o cancellazione dei tuoi dati contattando il titolare (vedi contatti nell'app o backend). Per cancellare il tuo account, usa le funzionalità dell'app o contatta il supporto.</p>

        <h3>Contatti</h3>
        <p>Per richieste relative alla privacy contatta l'amministratore del servizio (indirizzo email disponibile nelle impostazioni o nel backend).</p>
      </div>

      <div class="sf-privacy-actions">
        <button class="btn btn-outline-secondary" (click)="onClose()">Chiudi</button>
      </div>
    </div>
  </div>
  `,
  styles: [
    `
    .sf-privacy-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    .sf-privacy-modal { background: #fff; width: min(900px, 95%); max-height: 80vh; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column; }
    .sf-privacy-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eee; }
    .sf-privacy-body { padding: 16px; overflow: auto; }
    .sf-privacy-close { background: transparent; border: none; font-size: 22px; line-height: 1; }
    .sf-privacy-actions { padding: 12px 16px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; }
    `
  ]
})
export class PrivacyModalComponent {
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
