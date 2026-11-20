# sunshyray

Sito portfolio e vetrina dei dipinti di **sunshyray**. È un sito statico ospitato su GitHub Pages: niente server e niente costi.

- `index.html`: il sito pubblico (bio, opere, contatti, in italiano e inglese)
- `admin.html`: lo **studio**, la pagina privata da cui si caricano le opere
- `data/opere.json`: l'elenco delle opere (lo modifica lo studio)
- `data/sito.json`: bio e contatti (lo modifica lo studio)
- `opere/`: le foto dei quadri

## Configurazione (una volta sola)

1. **Attiva GitHub Pages**: nel repo vai in *Settings → Pages → Build and deployment*, scegli *Deploy from a branch*, poi branch `main` e cartella `/ (root)`, e salva. Dopo un paio di minuti il sito è online su `https://<utente>.github.io/<repo>/`.
2. **Crea la chiave di accesso per lo studio**: vai su <https://github.com/settings/personal-access-tokens/new> e compila così:
   - *Token name*: `sunshyray studio`
   - *Expiration*: la scadenza più lunga possibile. Quando scade, basta crearne una nuova.
   - *Repository access*: **Only select repositories**, poi scegli questo repo
   - *Permissions → Repository permissions → Contents*: **Read and write**
   - Premi *Generate token* e copia la chiave, che inizia con `github_pat_…`.
3. Sul telefono di lei apri `https://<utente>.github.io/<repo>/admin.html` e incolla la chiave. Va fatto una volta sola. Poi aggiungi la pagina alla schermata Home ("Condividi → Aggiungi a Home"), così diventa come un'app.

> La chiave resta salvata solo nel browser di quel telefono o computer: non viene mai scritta nel repo. Non va condivisa con nessuno.

## Come si usa lo studio

- **＋ Nuova**: trascini o scegli la foto, scrivi titolo, descrizione, prezzo e gli altri dati, poi premi **Pubblica**. La foto viene ridimensionata in automatico.
- **Le mie opere**: qui puoi modificare un'opera, segnarla come venduta o disponibile, cambiare l'ordine con ↑ ↓ o eliminarla.
- **Bio**: testo della bio (IT/EN), Instagram, email e WhatsApp. I bottoni "Richiedi" sul sito usano questi contatti.

Dopo ogni modifica il sito si aggiorna in 1–2 minuti.

Le 6 opere `esempio-*` sono segnaposto: vanno eliminate dallo studio.

## Dominio personalizzato (facoltativo)

Se comprate un dominio (es. `sunshyray.art`), aggiungetelo in *Settings → Pages → Custom domain*. In quel caso scrivete `"utente/repo"` nel campo `repo` di `config.js`, così lo studio continua a trovare il repository.
